#!/usr/bin/env bash
set -euxo pipefail

desc=$(git describe --always)
build_dir=$(pwd)/build
git worktree list | grep "$build_dir"

yarn snowpack build --out "$build_dir/$desc" --clean --sourceMaps

cd "$build_dir"

if prior=$(grep '<meta.*refresh' index.html | grep -o 'url=[^/]*' | cut -d= -f2); then
    sed -i -e "s/$prior/$desc/g" index.html
fi

git add -A
git commit -m "build $desc"
