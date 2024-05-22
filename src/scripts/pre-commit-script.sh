#!/usr/bin/env bash
set -e

# Because pre-commit is unable to run hooks in a subdirectory (see
# https://github.com/pre-commit/pre-commit/issues/1417), we must do it
# ourselves by cd'ing to the directory and modifying the list of staged
# files ourselves (which defeats the point of pre-commit's plugin system).

if (($# == 0)); then
	# There are no staged files - there is nothing to do here.
	exit 0
fi

cd src
set -- "${@/#/../}" # Prepends '../' to each staged file
echo VV "$@" VV
prettier --no-color --log-level=warn --write "$@"
