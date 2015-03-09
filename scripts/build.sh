#!/usr/bin/env sh

source_directory="./src"
destination_directory="./dist/lib"

set -e

rm -rf "$destination_directory"
babel -s -d "$destination_directory" "$source_directory"
