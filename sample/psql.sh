#!/bin/bash

set -e

current_dir=$(pwd)
cd "$(dirname "$0")"

# shellcheck source=/dev/null
[ ! "$CI_MODE" ] && source ".env"

cd "$current_dir"

psql "postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@$POSTGRES_HOST/$POSTGRES_DB" "$@"
