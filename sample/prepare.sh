#!/bin/bash

set -e

cd "$(dirname "$0")"

sql_file=$(mktemp)

{
    cat initialize.pgsql
    cat definitions/domain/*.pgsql
    cat definitions/table/*.pgsql
    cat definitions/view/*.pgsql
    cat definitions/materialized_view/*.pgsql
    cat definitions/type/*.pgsql
    cat definitions/index/*.pgsql
    cat definitions/procedure/*.pgsql
    cat definitions/function/*.pgsql
    cat definitions/trigger/*.pgsql
} >> "$sql_file"

if ${DRYRUN:-false}; then
    cat "$sql_file"
else
    ./psql.sh --set "ON_ERROR_STOP=1" -f "$sql_file"
fi

rm "$sql_file"
