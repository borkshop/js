#!/usr/bin/env bash
set -euxo pipefail

desc=$(git describe --always)
build_dir=$(pwd)/build
git worktree list | grep "$build_dir"

rm -fv "$build_dir"/* || true
npm run build

cd "$build_dir"
git add -A
git commit -m "build $desc"
