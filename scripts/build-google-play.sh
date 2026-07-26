#!/bin/bash

# Google Play 發布構建腳本
# 生成 AAB 檔案用於上傳到 Google Play Console

set -e  # 遇到錯誤立即退出

# 顏色輸出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 開始構建 Google Play 發布版本 (AAB)...${NC}\n"

# 檢查參數
VERSION_TYPE=${1:-patch}  # 預設為 patch

if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major|skip)$ ]]; then
    echo -e "${YELLOW}⚠️  警告: 無效的版本類型 '$VERSION_TYPE'，使用預設值 'patch'${NC}"
    VERSION_TYPE=patch
fi

# 步驟 0: 單一實例鎖
# 同一個專案不能有兩個 Gradle 建置並行：後啟動的那個一執行 clean／--stop，
# 就會對前一個送出停止指令，前一個當場死在「當下正在跑的任務」上
#（症狀：Gradle build daemon has been stopped: stop command received，
#  或 CMake／mergeResources／R8 每次錯在不同地方）。這裡直接擋掉第二個實例，
# 順便避免版號被重覆 bump。
LOCK_DIR="/tmp/x-story-build-google-play.lock"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    LOCK_PID=$(cat "$LOCK_DIR/pid" 2>/dev/null || echo '')
    if [ -n "$LOCK_PID" ] && kill -0 "$LOCK_PID" 2>/dev/null; then
        echo -e "${RED}❌ 已有另一個建置正在執行（PID ${LOCK_PID}）${NC}"
        echo -e "${YELLOW}   請等它跑完，或先結束它再重跑；兩個建置並行會互相殺掉。${NC}"
        exit 1
    fi
    # 鎖是上一次被中斷留下的殘骸 → 接手
    echo -e "${YELLOW}⚠️  清除上次中斷留下的建置鎖${NC}"
    rm -rf "$LOCK_DIR" && mkdir "$LOCK_DIR"
fi
echo $$ > "$LOCK_DIR/pid"
trap 'rm -rf "$LOCK_DIR"' EXIT

# 步驟 1: 遞增版本號（可選）
if [ "$VERSION_TYPE" != "skip" ]; then
    echo -e "${BLUE}📝 步驟 1: 遞增版本號 (${VERSION_TYPE})...${NC}"
    node scripts/bump-version.js "$VERSION_TYPE"
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ 版本號更新失敗${NC}"
        exit 1
    fi
    echo ""
else
    echo -e "${YELLOW}⏭️  跳過版本號更新${NC}\n"
fi

# 步驟 2: 清理之前的構建
#
# ⚠️ 前置清理（2026-07 加入）：native 建置的「殘留狀態」會造成每次位置都不同的假故障，
#    典型症狀有三種，根因都一樣：
#      a) CMake Error: Imported target "ReactAndroid::jsi" includes non-existent path
#         .../transforms/<hash>/transformed/jetified-react-android-<ver>-debug/prefab/...
#         → CMake/ninja 會把 ~/.gradle transforms 的「絕對路徑」寫死進 .cxx 快取；
#           該 transform 被 Gradle 回收後路徑就失效，連 ./gradlew clean 都會掛。
#      b) ninja: error: loading 'build.ninja': No such file or directory
#      c) java.io.FileNotFoundException: .../cxx/RelWithDebInfo/<hash>/logs/<abi>/build_stdout_targets.txt
#         → 被中斷（Ctrl-C／關視窗／kill）的建置留下半完成的 .cxx。
#    解法固定：把 .cxx 全部清掉讓 CMake 重新產生（daemon 由上面的單一實例鎖把關，不盲目砍）。
#    註：只清 .cxx，不動 node_modules/*/android/build，避免把已產好的 codegen 標頭
#        （例如 rnscreens 的 EventEmitters.h）砍掉而觸發編譯期找不到標頭。
echo -e "${BLUE}🧹 步驟 2: 清理之前的構建（含 daemon 與 CMake 殘留狀態）...${NC}"
cd android
# 上一次被中斷的建置可能留下 gradlew client，其關閉時送出的 stop 會誤殺剛啟動的 daemon。
# 只清掉「本專案 wrapper 的殘留 client」，不動 daemon 本身——
# 盲目 pkill GradleDaemon 會連別的專案（或使用者自己開的）建置一起殺掉。
# 上面的單一實例鎖已保證此刻沒有另一個本專案建置在跑。
echo -e "${YELLOW}   ⏹  清除殘留的 gradlew client...${NC}"
pkill -f "org.gradle.appname=gradlew.*x-story/android" 2>/dev/null || true
sleep 2
cd ..
echo -e "${YELLOW}   🧽 清除殘留的 CMake 快取（.cxx）...${NC}"
find node_modules android -maxdepth 6 -type d -name .cxx -prune -exec rm -rf {} + 2>/dev/null || true
rm -rf android/app/build/intermediates/cxx
cd android
./gradlew clean

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 清理失敗${NC}"
    exit 1
fi

echo ""

# 步驟 3: 構建 Release AAB（用於 Google Play）
echo -e "${BLUE}📦 步驟 3: 構建 Release AAB (用於 Google Play)...${NC}"
echo -e "${YELLOW}   ⚠️  此構建會啟用 ProGuard/R8 以縮減應用程式大小${NC}\n"

./gradlew bundleRelease

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ AAB 構建失敗${NC}"
    exit 1
fi

echo ""

# 步驟 4: 顯示構建結果
echo -e "${GREEN}✅ 構建完成！${NC}\n"

# 讀取版本號（兼容 macOS 和 Linux）
# 從 defaultConfig 區塊中提取版本號
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - 使用 awk 更可靠
    VERSION_CODE=$(awk '/defaultConfig/,/}/ {if (/versionCode/) {gsub(/[^0-9]/, "", $NF); print $NF; exit}}' app/build.gradle)
    VERSION_NAME=$(awk '/defaultConfig/,/}/ {if (/versionName/) {gsub(/"/, "", $NF); print $NF; exit}}' app/build.gradle)
else
    # Linux
    VERSION_CODE=$(grep -A 10 'defaultConfig' app/build.gradle | grep 'versionCode' | head -1 | grep -oP '\d+')
    VERSION_NAME=$(grep -A 10 'defaultConfig' app/build.gradle | grep 'versionName' | head -1 | grep -oP '"[^"]+"' | tr -d '"')
fi

echo -e "${GREEN}📦 版本資訊:${NC}"
echo -e "   版本名稱: ${VERSION_NAME}"
echo -e "   版本代碼: ${VERSION_CODE}\n"

echo -e "${GREEN}📁 構建產物:${NC}"
echo -e "   ${GREEN}AAB (Google Play):${NC} android/app/build/outputs/bundle/release/app-release.aab"
echo -e "   ${GREEN}Mapping 文件:${NC} android/app/mapping/mapping-${VERSION_NAME}-${VERSION_CODE}.txt\n"

echo -e "${BLUE}📤 下一步:${NC}"
echo -e "   1. 上傳 AAB 到 Google Play Console"
echo -e "   2. 上傳 mapping 文件到對應的版本"
echo -e "   3. 填寫版本資訊並發布\n"

cd ..

