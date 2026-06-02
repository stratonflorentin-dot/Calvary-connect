Param()
Set-StrictMode -Version Latest

# Run from repository root. Requires git and GitHub CLI (gh) authenticated.
$repo = "stratonflorentin-dot/Calvary-connect"
# Use SSH or HTTPS as preferred
$remoteUrl = "git@github.com:$repo.git"
# $remoteUrl = "https://github.com/$repo.git"
$branch = "calvary/fix-icons-supabase-$(Get-Date -Format 'yyyyMMdd-HHmm')"
$commitMsg = "Apply icon fallback and Supabase query fixes"
$prTitle = $commitMsg
$prBodyFile = ".github/PR_BODY.md"

Write-Host "Preparing branch: $branch"

if (-not (git rev-parse --is-inside-work-tree 2>$null)) {
    Write-Error "Not a git repo. Run this from the project root."
    exit 1
}

git add -A
$null = git diff --cached --quiet; if ($LASTEXITCODE -eq 0) { Write-Host "No changes to commit. Exiting."; exit 0 }

git commit -m $commitMsg

git checkout -b $branch

try { git remote get-url origin > $null 2>&1; Write-Host "Using existing 'origin' remote." } catch { git remote add origin $remoteUrl; Write-Host "Added origin -> $remoteUrl" }

git push -u origin $branch

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "gh CLI not found. Install and authenticate, then run:`n gh pr create --title \"$prTitle\" --body-file $prBodyFile --base main --head $branch --repo $repo"
    exit 0
}

try { gh auth status > $null 2>&1 } catch { Write-Host "Please run 'gh auth login' to authenticate."; exit 1 }

gh pr create --title $prTitle --body-file $prBodyFile --base main --head $branch --repo $repo | Out-Null; Write-Host "PR created."
