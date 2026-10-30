$ErrorActionPreference = "Stop"

# ==========================================
# НАЛАШТУВАННЯ
# ==========================================

$RepoPath = "E:\Projects-ChatGPT"
$BackupBranch = "apps-script-backup"

# Службові файли навмисно зберігаємо ПОЗА Git repository
$RuntimePath = "E:\Projects-ChatGPT-Backup"

$LogFile =
    Join-Path `
        $RuntimePath `
        "apps-script-backup.log"

$LockFile =
    Join-Path `
        $RuntimePath `
        "apps-script-backup.lock"


# ==========================================
# ЛОГ
# ==========================================

function Write-Log {

    param (
        [string]$Message,
        [string]$Level = "INFO"
    )

    $timestamp =
        Get-Date -Format "yyyy-MM-dd HH:mm:ss"

    $line =
        "$timestamp [$Level] $Message"

    Write-Host $line

    Add-Content `
        -Path $LogFile `
        -Value $line
}


# ==========================================
# ЗАПУСК КОМАНДИ З ПЕРЕВІРКОЮ
# ==========================================

function Invoke-CommandChecked {

    param (
        [string]$Command,
        [string[]]$Arguments
    )

    Write-Log (
        "Executing: " +
        $Command +
        " " +
        ($Arguments -join " ")
    )

    & $Command @Arguments

    if ($LASTEXITCODE -ne 0) {

        throw (
            "$Command failed with exit code " +
            $LASTEXITCODE
        )
    }
}


# ==========================================
# СЛУЖБОВА ПАПКА
# ==========================================

if (
    -not (
        Test-Path $RuntimePath
    )
) {

    New-Item `
        -ItemType Directory `
        -Path $RuntimePath `
        -Force |
        Out-Null
}


Write-Log "========================================"
Write-Log "GKD Apps Script backup started"
Write-Log "Repository: $RepoPath"


# ==========================================
# LOCK
# ==========================================

if (
    Test-Path $LockFile
) {

    Write-Log `
        "Another backup instance appears to be running." `
        "ERROR"

    Write-Log `
        "Lock file: $LockFile" `
        "ERROR"

    exit 10
}


New-Item `
    -ItemType File `
    -Path $LockFile `
    -Force |
    Out-Null


$currentBranch = $null
$backupSucceeded = $false


try {

    # ==========================================
    # REPOSITORY
    # ==========================================

    if (
        -not (
            Test-Path $RepoPath
        )
    ) {

        throw "Repository path does not exist."
    }


    Set-Location $RepoPath


    # ==========================================
    # GIT / CLASP
    # ==========================================

    if (
        -not (
            Get-Command git `
                -ErrorAction SilentlyContinue
        )
    ) {

        throw "Git is not available."
    }


    if (
        -not (
            Get-Command clasp `
                -ErrorAction SilentlyContinue
        )
    ) {

        throw "clasp is not available."
    }


    if (
        -not (
            Test-Path (
                Join-Path $RepoPath ".git"
            )
        )
    ) {

        throw "$RepoPath is not a Git repository."
    }


    if (
        -not (
            Test-Path (
                Join-Path $RepoPath ".clasp.json"
            )
        )
    ) {

        throw ".clasp.json not found."
    }


    # ==========================================
    # ПОТОЧНА ГІЛКА
    # ==========================================

    $currentBranch =
        (
            git branch --show-current
        ).Trim()


    if (
        [string]::IsNullOrWhiteSpace(
            $currentBranch
        )
    ) {

        throw "Cannot determine current Git branch."
    }


    Write-Log (
        "Current branch: " +
        $currentBranch
    )


    # ==========================================
    # ЗАХИСТ НЕЗАКОМІЧЕНОЇ РОБОТИ
    # ==========================================

    $localChanges =
        git status --porcelain


    if (
        -not (
            [string]::IsNullOrWhiteSpace(
                $localChanges
            )
        )
    ) {

        Write-Log `
            "Local repository contains uncommitted changes." `
            "WARNING"

        foreach (
            $change in $localChanges
        ) {

            Write-Log `
                $change `
                "WARNING"
        }


        throw (
            "Backup cancelled to protect local work."
        )
    }


    # ==========================================
    # FETCH
    # ==========================================

    Invoke-CommandChecked `
        "git" `
        @(
            "fetch",
            "origin"
        )


    # ==========================================
    # BACKUP BRANCH
    # ==========================================

    $localBackupBranch =
        git branch `
            --list `
            $BackupBranch


    if (
        [string]::IsNullOrWhiteSpace(
            $localBackupBranch
        )
    ) {

        Write-Log (
            "Creating backup branch: " +
            $BackupBranch
        )


        Invoke-CommandChecked `
            "git" `
            @(
                "checkout",
                "-b",
                $BackupBranch
            )
    }
    else {

        Invoke-CommandChecked `
            "git" `
            @(
                "checkout",
                $BackupBranch
            )
    }


    # ==========================================
    # REMOTE BACKUP BRANCH
    # ==========================================

    $remoteBackup =
        git ls-remote `
            --heads `
            origin `
            $BackupBranch


    if (
        -not (
            [string]::IsNullOrWhiteSpace(
                $remoteBackup
            )
        )
    ) {

        Write-Log (
            "Updating remote backup branch."
        )


        Invoke-CommandChecked `
            "git" `
            @(
                "pull",
                "--ff-only",
                "origin",
                $BackupBranch
            )
    }


    # ==========================================
    # APPS SCRIPT → LOCAL
    # ==========================================

    Write-Log (
        "Pulling current Apps Script HEAD."
    )


    Invoke-CommandChecked `
        "clasp" `
        @(
            "pull"
        )


    # ==========================================
    # ПЕРЕВІРКА ЗМІН
    # ==========================================

    $appsScriptChanges =
        git status --porcelain


    if (
        [string]::IsNullOrWhiteSpace(
            $appsScriptChanges
        )
    ) {

        Write-Log (
            "No Apps Script changes found."
        )


        # Створюємо remote branch,
        # якщо вона ще не існує.

        if (
            [string]::IsNullOrWhiteSpace(
                $remoteBackup
            )
        ) {

            Write-Log (
                "Creating remote backup branch."
            )


            Invoke-CommandChecked `
                "git" `
                @(
                    "push",
                    "-u",
                    "origin",
                    $BackupBranch
                )
        }


        $backupSucceeded = $true

    }
    else {

        Write-Log (
            "Apps Script changes detected:"
        )


        foreach (
            $change in $appsScriptChanges
        ) {

            Write-Log `
                $change `
                "CHANGE"
        }


        # ==========================================
        # COMMIT
        # ==========================================

        Invoke-CommandChecked `
            "git" `
            @(
                "add",
                "."
            )


        $timestamp =
            Get-Date `
                -Format "yyyy-MM-dd HH:mm:ss"


        $commitMessage =
            "Automatic Apps Script backup $timestamp"


        Invoke-CommandChecked `
            "git" `
            @(
                "commit",
                "-m",
                $commitMessage
            )


        # ==========================================
        # PUSH
        # ==========================================

        Invoke-CommandChecked `
            "git" `
            @(
                "push",
                "-u",
                "origin",
                $BackupBranch
            )


        Write-Log (
            "Backup successfully pushed to GitHub."
        )


        Write-Log (
            "Branch: " +
            $BackupBranch
        )


        $backupSucceeded = $true
    }

}


catch {

    Write-Log `
        $_.Exception.Message `
        "ERROR"

    Write-Log `
        "Backup FAILED." `
        "ERROR"
}


finally {

    # ==========================================
    # ПОВЕРНЕННЯ НА ПОЧАТКОВУ ГІЛКУ
    # ==========================================

    try {

        Set-Location $RepoPath


        if (
            -not (
                [string]::IsNullOrWhiteSpace(
                    $currentBranch
                )
            )
        ) {

            $nowBranch =
                (
                    git branch --show-current
                ).Trim()


            if (
                $nowBranch -ne $currentBranch
            ) {

                & git checkout $currentBranch


                if ($LASTEXITCODE -ne 0) {

                    throw (
                        "git checkout $currentBranch failed."
                    )
                }


                $verifiedBranch =
                    (
                        git branch --show-current
                    ).Trim()


                if (
                    $verifiedBranch -ne
                    $currentBranch
                ) {

                    throw (
                        "Expected branch " +
                        $currentBranch +
                        ", actual branch " +
                        $verifiedBranch
                    )
                }


                Write-Log (
                    "Returned to branch: " +
                    $currentBranch
                )
            }
        }
    }
    catch {

        Write-Log `
            (
                "Cannot return to original branch: " +
                $_.Exception.Message
            ) `
            "ERROR"

        $backupSucceeded = $false
    }


    # ==========================================
    # ВИДАЛЯЄМО LOCK
    # ==========================================

    if (
        Test-Path $LockFile
    ) {

        Remove-Item `
            $LockFile `
            -Force
    }


    Write-Log (
        "GKD Apps Script backup finished."
    )

    Write-Log "========================================"
}


# ==========================================
# EXIT CODE ДЛЯ TASK SCHEDULER
# ==========================================

if ($backupSucceeded) {

    exit 0
}
else {

    exit 1
}