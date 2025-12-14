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
echo -e "${BLUE}🧹 步驟 2: 清理之前的構建...${NC}"
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

