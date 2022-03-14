#!/bin/bash

set -e

cd "$(dirname "$0")"

sql_file=$(mktemp)

{
    cat initialize.pgsql
    cat definitions/tables/*.pgsql
    cat definitions/views/*.pgsql
    cat definitions/types/*.pgsql
    cat definitions/stored/*.pgsql
} >> "$sql_file"

if ${DRYRUN:-false}; then
    cat "$sql_file"
else
    ./psql.sh --set "ON_ERROR_STOP=1" -f "$sql_file"
fi

rm "$sql_file"
