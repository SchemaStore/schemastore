#!/usr/bin/env bash
set -eo pipefail

schema=$1

PATH="$PWD/node_modules/.bin:$PATH"

# For a specific schema, generate a coverage report in src/temp/coverage/report/index.html
# Example: via 'make' to generate coverage report for schema-catalog.json
# npm run coverage schema-catalog.json
c8 grunt local_coverage "--SchemaName=$schema"
c8 report -r html -o temp/coverage/report
echo "Full HTML report files stored in 'src/temp/coverage/report/index.html'"
