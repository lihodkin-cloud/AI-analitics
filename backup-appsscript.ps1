$ErrorActionPreference = "Stop"

$RepoPath = "E:\Projects-ChatGPT"
$BackupBranch = "apps-script-backup"

Set-Location $RepoPath

Write-Host "=== GKD Apps Script backup started ==="
Write-Host "Repository: $RepoPath"

# 1. Перевіряємо, чи немає незбережених локальних змін
$localChanges = git status --porcelain

if (-not [string]::IsNullOrWhiteSpace($localChanges)) {
    Write-Host ""
    Write-Host "Backup cancelled."
    Write-Host "Local repository has uncommitted changes:"
    Write-Host $localChanges
    exit 1
}

# 2. Запам'ятовуємо поточну гілку
$currentBranch = git branch --show-current

if ([string]::IsNullOrWhiteSpace($currentBranch)) {
    throw "Cannot determine current Git branch."
}

Write-Host "Current branch: $currentBranch"

# 3. Перевіряємо, чи існує локальна backup-гілка
$branchExists = git branch --list $BackupBranch

if ([string]::IsNullOrWhiteSpace($branchExists)) {

    Write-Host "Creating backup branch: $BackupBranch"

    git checkout -b $BackupBranch

    if ($LASTEXITCODE -ne 0) {
        throw "Cannot create backup branch."
    }

} else {

    git checkout $BackupBranch

    if ($LASTEXITCODE -ne 0) {
        throw "Cannot switch to backup branch."
    }
}

# 4. Оновлюємо backup-гілку з GitHub, якщо вона вже існує там
git fetch origin

$remoteBackupExists =
    git ls-remote --heads origin $BackupBranch

if (-not [string]::IsNullOrWhiteSpace($remoteBackupExists)) {

    git pull --ff-only origin $BackupBranch

    if ($LASTEXITCODE -ne 0) {
        throw "Cannot update remote backup branch."
    }
}

# 5. Забираємо фактичний поточний код із Apps Script
Write-Host "Running clasp pull..."

clasp pull

if ($LASTEXITCODE -ne 0) {
    throw "clasp pull failed."
}

# 6. Перевіряємо, чи щось реально змінилось
$changes = git status --porcelain

if ([string]::IsNullOrWhiteSpace($changes)) {

    Write-Host "No Apps Script changes found."

    # Повертаємося у вихідну гілку
    git checkout $currentBranch

    exit 0
}

Write-Host ""
Write-Host "Apps Script changes detected:"
Write-Host $changes

# 7. Додаємо зміни
git add .

# 8. Створюємо автоматичний commit
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

git commit -m "Automatic Apps Script backup $timestamp"

if ($LASTEXITCODE -ne 0) {
    throw "git commit failed."
}

# 9. Відправляємо backup у GitHub
git push -u origin $BackupBranch

if ($LASTEXITCODE -ne 0) {
    throw "git push failed."
}

Write-Host ""
Write-Host "Backup successfully pushed to GitHub."
Write-Host "Branch: $BackupBranch"

# 10. Повертаємося у вихідну робочу гілку
git checkout $currentBranch

if ($LASTEXITCODE -ne 0) {
    throw "Backup succeeded, but cannot return to branch $currentBranch."
}

Write-Host "Returned to branch: $currentBranch"
Write-Host "=== Backup completed successfully ==="