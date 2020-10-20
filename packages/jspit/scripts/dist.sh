#!/usr/bin/env bash
set -euxo pipefail

# ensure the build directory is setup as a secondary working tree
build_dir=$(pwd)/dist
git worktree list | grep "$build_dir"

desc=$(git describe --always)

# enter and clean the build tree
pushd "$build_dir"
git checkout -f
git clean -df
popd

# actually build
out_dir="$build_dir/$desc"
yarn snowpack build --out "$out_dir" --clean --sourceMaps

# instantiate the index page (rather than say a client-side redirect)
sed \
  -e "s~base href=\".\"~base href=\"$desc/\"~" \
  <"$out_dir/index.html" \
  >"$build_dir/index.html"

# enter and commit the built tree
pushd "$build_dir"
git add -A
git commit -m "build $desc"
popd
