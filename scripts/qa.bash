#!/usr/bin/env bash

# qa.bash puts the Kabash on bugs! (or the Kibosh if you prefer)
#
# Stop merging your dev branch into main, rather just run qa.bash!
#
# Really it's just a convenience for running tests between every commit since a
# referent last branch. After each test pass, the referent branch is updated to
# point at the newly verified commit.
#
# If the tests fail, the rebase halts at the point of failure; $USER may then:
# - simply fix the bug and `git rebase --continue`
# - abort the rebase, having already advanced the referent branch through any
#   passing commits, and proceed with development; a likely direction would be to
#   re-order the remaining branch delta to defer any failing commits
# - un-pick the last commit, using `git rebase --edit-todo` to resequence
#   problem points in-situ
#
# If no referent branch name is given as first arg, "main" is used by default.
#
# Any additional arguments are passed to git-rebase. In particular, user may
# wish to pass `-i` through, having a chance to $EDITOR the QA rebase plan.
# This can be used to insert break points for manual verification, such as play
# testing.
#
# $USER is, as always, on the hook for providing an up to date dev branch,
# typically by first pulling and rebasing against latest upstream main.
#
# If $USER prefers to QA through something like a release candidate branch,
# this can also be easily done:
#
#   git branch -f rc main  # create or update a verification branch
#   scripts/qa.bash rc     # and QA through it rather than directly on main
#

last=${1:-main}
shift

# NOTE: use of 'nohop ... >foo' is necessary to squash any test output pagers
# (e.g. as used by ava) from trying to be "helpful".

exec git rebase \
  --exec "nohup yarn ci >ci.out" \
  --exec "git branch -f '$last'" \
  "$last" "$@"
