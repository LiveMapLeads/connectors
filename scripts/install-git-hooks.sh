#!/usr/bin/env bash
# install-git-hooks.sh — install this repo's version-controlled git hooks
# (.githooks/*) into .git/hooks/ WITHOUT clobbering hooks installed by other
# tooling (e.g. the dcg `pre-commit` scanner). Idempotent; re-run any time.
#
# Why a copy instead of `core.hooksPath`: setting core.hooksPath would redirect
# ALL hooks to .githooks and silently disable the externally-managed dcg
# pre-commit hook. Installing per-file leaves other hooks intact.
#
# Run once per clone:  bash scripts/install-git-hooks.sh
set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
src="$repo_root/.githooks"
# Resolve the hooks dir via git, not a hardcoded "$repo_root/.git/hooks": in a
# linked worktree `.git` is a file (gitdir pointer), so the literal path fails.
# `--git-path hooks` returns the correct absolute dir in every layout.
dst="$(git rev-parse --git-path hooks)"

[ -d "$src" ] || { echo "no .githooks/ dir — nothing to install"; exit 0; }
mkdir -p "$dst"

for hook in "$src"/*; do
  name=$(basename "$hook")
  target="$dst/$name"
  if [ -e "$target" ] && ! grep -q "version-controlled git hooks (.githooks" "$target" 2>/dev/null; then
    # An unrelated (externally-managed) hook already lives here — don't overwrite.
    echo "skip $name: a non-.githooks hook already exists at $target (left untouched)"
    continue
  fi
  cp "$hook" "$target"
  chmod +x "$target"
  echo "installed $name -> $target"
done
echo "done. (dcg pre-commit and any other external hooks were left intact.)"
