#!/usr/bin/env bash
set -euxo pipefail

n=${1:-10}

# ensure the build directory is setup as a secondary working tree
build_dir=$(pwd)/dist
git worktree list | grep "$build_dir"

# enter and clean the build tree
pushd "$build_dir"
git checkout -f
git clean -df
popd

# sort builds descending by build time and prune after the Nth
builds=$(mktemp)
find "$build_dir" -type d -d 1 \
| xargs -n1 basename \
>"$builds"
paste \
  <(<"$builds" xargs git show --no-patch --pretty='format:%ct') \
  "$builds" \
| sort -rk1 \
| tail -n+"$n" \
| while read t version; do

  # prune a build
  pushd "$build_dir"
  git rm -rf "$version"
  git commit -m "prune $version"
  popd

done

rm "$builds"
