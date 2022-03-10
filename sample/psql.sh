#!/bin/bash

set -e

current_dir=$(pwd)
cd "$(dirname "$0")"

# shellcheck source=/dev/null
source ".env"

cd "$current_dir"

psql "postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost/$POSTGRES_DB" "$@"
