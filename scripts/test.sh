#!/usr/bin/env sh

set -e

source_directory="./test"
temp_directory="./.tmp"
destination_directory="$temp_directory"
coverage_directory="dist/coverage"

npm run prepublish
rm -rf "$temp_directory" "$coverage_directory"
babel -s -d "$destination_directory" "$source_directory"
istanbul cover \
    --dir $coverage_directory \
    node_modules/.bin/_mocha \
    -- \
    -R spec \
    "$destination_directory/_init.js" \
    "$destination_directory/**/*Spec.js" \

