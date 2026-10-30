$ErrorActionPreference = "Stop"

# ==============================
# НАЛАШТУВАННЯ
# ==============================

$RepoPath = "E:\Projects-ChatGPT"
$BackupBranch = "apps-script-backup"

$LogDirectory = Join-Path $RepoPath "logs"
$LogFile = Join-Path $LogDirectory "apps-script-backup.log"

$LockFile = Join-Path $RepoPath ".apps-script-backup.lock"

# ==============================
# ДОПОМІЖНІ ФУНКЦІЇ
# ==============================

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
            "$Command failed " +
            "with exit code " +
            $LASTEXITCODE
        )
    }
}


# ==============================
# ПІДГОТОВКА
# ==============================

if (
    -not (
        Test-Path $LogDirectory
    )
) {

    New-Item `
        -ItemType Directory `
        -Path $LogDirectory `
        -Force |
        Out-Null
}


Write-Log "========================================"
Write-Log "GKD Apps Script backup started"
Write-Log "Repository: $RepoPath"


# ==============================
# ЗАХИСТ ВІД ПАРАЛЕЛЬНОГО ЗАПУСКУ
# ==============================

if (
    Test-Path $LockFile
) {

    Write-Log `
        "Backup already running or previous run ended incorrectly." `
        "ERROR"

    Write-Log `
        "Lock file exists: $LockFile" `
        "ERROR"

    exit 10
}


New-Item `
    -ItemType File `
    -Path $LockFile `
    -Force |
    Out-Null


$currentBranch = $null


try {

    # ==============================
    # ПЕРЕХІД У REPOSITORY
    # ==============================

    if (
        -not (
            Test-Path $RepoPath
        )
    ) {

        throw "Repository path does not exist."
    }


    Set-Location $RepoPath


    # ==============================
    # ПЕРЕВІРКА GIT
    # ==============================

    if (
        -not (
            Get-Command git `
                -ErrorAction SilentlyContinue
        )
    ) {

        throw "Git is not available."
    }


    # ==============================
    # ПЕРЕВІРКА CLASP
    # ==============================

    if (
        -not (
            Get-Command clasp `
                -ErrorAction SilentlyContinue
        )
    ) {

        throw "clasp is not available."
    }


    # ==============================
    # ПЕРЕВІРКА .git
    # ==============================

    if (
        -not (
            Test-Path (
                Join-Path $RepoPath ".git"
            )
        )
    ) {

        throw (
            "$RepoPath is not a Git repository."
        )
    }


    # ==============================
    # ПЕРЕВІРКА .clasp.json
    # ==============================

    $ClaspConfig =
        Join-Path `
            $RepoPath `
            ".clasp.json"


    if (
        -not (
            Test-Path $ClaspConfig
        )
    ) {

        throw (
            ".clasp.json not found. " +
            "Cannot identify Apps Script project."
        )
    }


    # ==============================
    # ПОТОЧНА ГІЛКА
    # ==============================

    $currentBranch =
        (
            git branch --show-current
        ).Trim()


    if (
        [string]::IsNullOrWhiteSpace(
            $currentBranch
        )
    ) {

        throw (
            "Cannot determine current Git branch."
        )
    }


    Write-Log (
        "Current branch: " +
        $currentBranch
    )


    # ==============================
    # ЗАХИСТ ЛОКАЛЬНОЇ РОБОТИ
    # ==============================

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

        Write-Log `
            $localChanges `
            "WARNING"

        Write-Log `
            "Backup cancelled to protect local work." `
            "WARNING"

        exit 20
    }


    # ==============================
    # FETCH REMOTE
    # ==============================

    Invoke-CommandChecked `
        "git" `
        @(
            "fetch",
            "origin"
        )


    # ==============================
    # ЧИ ІСНУЄ BACKUP BRANCH
    # ==============================

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
            "Creating local backup branch: " +
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


    # ==============================
    # ЧИ Є BACKUP BRANCH НА GITHUB
    # ==============================

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


    # ==============================
    # CLASP PULL
    # ==============================

    Write-Log (
        "Pulling current Apps Script HEAD."
    )


    Invoke-CommandChecked `
        "clasp" `
        @(
            "pull"
        )


    # ==============================
    # ПЕРЕВІРКА ЗМІН
    # ==============================

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


        # Якщо backup-гілки ще немає
        # на GitHub — створюємо її.

        if (
            [string]::IsNullOrWhiteSpace(
                $remoteBackup
            )
        ) {

            Write-Log (
                "Remote backup branch does not exist. " +
                "Creating it."
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


        Write-Log (
            "Backup finished. No new commit required."
        )

        exit 0
    }


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


    # ==============================
    # COMMIT
    # ==============================

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


    # ==============================
    # PUSH
    # ==============================

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


    exit 0
}


catch {

    Write-Log `
        $_.Exception.Message `
        "ERROR"

    Write-Log `
        "Backup FAILED." `
        "ERROR"

    exit 1
}


finally {

    # ==============================
    # ПОВЕРНЕННЯ НА РОБОЧУ ГІЛКУ
    # ==============================

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
                $nowBranch -ne
                $currentBranch
            ) {

                git checkout $currentBranch |
                    Out-Null


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
    }


    # ==============================
    # ВИДАЛЕННЯ LOCK
    # ==============================

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