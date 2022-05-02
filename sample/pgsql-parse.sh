#!/bin/bash

set -e

cd "$(dirname "$0")"

for file in definitions/**/*.pgsql; do
    if [ "$file" -nt "$file.json" ]; then
        echo "Parse: $file"
        npx pgsql-parser "$file" > "$file.json"
    fi
done
