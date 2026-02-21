#!/bin/bash
# 不依賴 npm、不依賴終端機當前目錄，可用絕對路徑執行
# 當 npm 出現 ENOENT uv_cwd 時可用此方式執行
# 用法: bash /Volumes/SSD990/projects/react-native/x-story/scripts/run-prepare-ios-xcode.sh
#   或: bash scripts/run-prepare-ios-xcode.sh  （在專案根目錄下）

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT" || { echo "錯誤: 無法進入專案目錄 $PROJECT_ROOT"; exit 1; }
exec "$SCRIPT_DIR/prepare-ios-xcode.sh" "$@"
