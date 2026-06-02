#!/usr/bin/env bash
set -euo pipefail

# Usage: run from repository root. Requires git and GitHub CLI (gh) authenticated.
# Adjust REPO variable if you want a different target repo.

REPO="stratonflorentin-dot/Calvary-connect"
REMOTE_URL="https://github.com/${REPO}.git"    # change to SSH if preferred: git@github.com:${REPO}.git
BRANCH="calvary/fix-icons-supabase-$(date +%Y%m%d-%H%M)"
COMMIT_MSG="Apply icon fallback and Supabase query fixes"
PR_TITLE="$COMMIT_MSG"
PR_BODY_FILE=".github/PR_BODY.md"

echo "Preparing branch: $BRANCH"

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "Not a git repo. Run from project root."; exit 1; }

git add -A
if git diff --cached --quiet; then
  echo "No changes to commit. Exiting.";
  exit 0
fi

git commit -m "$COMMIT_MSG"

# create branch
git checkout -b "$BRANCH"

# add origin if missing
if git remote get-url origin >/dev/null 2>&1; then
  echo "Using existing origin: $(git remote get-url origin)"
else
  git remote add origin "$REMOTE_URL"
  echo "Added origin -> $REMOTE_URL"
fi

git push -u origin "$BRANCH"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI not found. Install and authenticate, then run:" \
       "gh pr create --title \"$PR_TITLE\" --body-file $PR_BODY_FILE --base main --head $BRANCH --repo $REPO"
  exit 0
fi

gh auth status >/dev/null 2>&1 || { echo "Please run 'gh auth login' to authenticate."; exit 1; }

gh pr create --title "$PR_TITLE" --body-file "$PR_BODY_FILE" --base main --head "$BRANCH" --repo "$REPO" && echo "PR created."
