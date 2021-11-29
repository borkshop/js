# Keeping Main Green

## TL;DR

- Run toplevel `yarn ci` on every commit
  - `git rebase -x` can be useful to automate this
  - there's also `scripts/qa.bash` that can automate picking a topic branch
    into main while running ci between every commit

## Exposition

In borkshop CI is currently voluntary, not compulsory.

Therefore it is incumbent on each coborker to ensure that they do not break other's toys.

Each workspace may opt in to its own level of validation:
- most at least use `tsc` to type check and lint all their code
- some define automated tests, typically orchestrated by `ava`
- and some even enforce coverage requirements of those automated tests

Every workspace must define a `ci` script that runs such things.

The toplevel `package.json` then provides a `ci` script that dispatches to all
workspaces' `ci` scripts.

While developing a coborker may just run whatever workspace-local things make
sense, like `tsc` or `ava`.

However once they have a branch ready for main, they should run something like:

    git rebase -x 'yarn ci' main

to validate each commit.

This is of course best done on a recently fetched main; if a coboker later
finds that upstream main has moved, they should reset their local main to
remote, and fully rebase/revalidate any candidate work.

One particularly useful pattern can be to keep a local `rc` branch, which
tracks "the last validated commit". One can crate/use such a branch by running
this from a dev topic branch:

    git rebase -x 'yarn ci' -x 'git branch -f rc' main

This will update an `rc` branch to point at each progressively tested commit.
If the rebase is later aborted (or otherwise modified to skip subsequent i
tests), the `rc` branch will remain pointed at the last validated commit.

There is `scripts/qa.bash` fwiw that further expounds on and documents this pattern.
