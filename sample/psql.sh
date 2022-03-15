#!/bin/bash

set -e

current_dir=$(pwd)
cd "$(dirname "$0")"

# shellcheck source=/dev/null
if ! "$CI_MODE"; then
    source ".env"
fi

cd "$current_dir"

psql "postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@$POSTGRES_HOST:${POSTGRES_PORT:-5432}/$POSTGRES_DB" "$@"
