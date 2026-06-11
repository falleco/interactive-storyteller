#!/bin/bash

set -eu

SCRIPT_NAME="$0"
BASE_DIR="$( cd "$(dirname "$0")" ; pwd -P )"

platform="${1:-}"
preset=""

case "$platform" in
    android)
        preset="Android"
    ;;
    ios)
        preset="iOS"
    ;;
    *)
        echo "Usage: $0 <android|ios>"
        exit 1
esac

$BASE_DIR/export_godot.sh --target "$BASE_DIR/../apps/mobile" --name demo --preset "$preset" --project $BASE_DIR/demo --platform $platform
$BASE_DIR/export_godot.sh --target "$BASE_DIR/../apps/mobile" --name fit-puzzle --preset "$preset" --project $BASE_DIR/fit-puzzle --platform $platform
$BASE_DIR/export_godot.sh --target "$BASE_DIR/../apps/mobile" --name word-puzzle --preset "$preset" --project $BASE_DIR/word-puzzle --platform $platform
$BASE_DIR/export_godot.sh --target "$BASE_DIR/../apps/mobile" --name nail-paint --preset "$preset" --project $BASE_DIR/nail-paint --platform $platform
