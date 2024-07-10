#!/usr/bin/env bash
set -eo pipefail

if ! git diff-index --quiet HEAD --; then
	echo "ERROR: Dirty repository found"
	git status --porcelain
	exit 1
fi
