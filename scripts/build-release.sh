#!/bin/bash

# Release 版本構建腳本（已棄用，請使用 build-google-play.sh）
# 此腳本保留用於向後兼容
# 建議使用：./scripts/build-google-play.sh

set -e  # 遇到錯誤立即退出

# 顏色輸出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 開始構建 Release 版本...${NC}\n"

# 檢查參數
VERSION_TYPE=${1:-patch}  # 預設為 patch

if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
    echo -e "${YELLOW}⚠️  警告: 無效的版本類型 '$VERSION_TYPE'，使用預設值 'patch'${NC}"
    VERSION_TYPE=patch
fi

# 步驟 1: 遞增版本號
echo -e "${BLUE}📝 步驟 1: 遞增版本號 (${VERSION_TYPE})...${NC}"
node scripts/bump-version.js "$VERSION_TYPE"

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}❌ 版本號更新失敗${NC}"
    exit 1
fi

echo ""

# 步驟 2: 清理之前的構建
echo -e "${BLUE}🧹 步驟 2: 清理之前的構建...${NC}"
cd android
./gradlew clean

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}❌ 清理失敗${NC}"
    exit 1
fi

echo ""

# 步驟 3: 構建 Release AAB
echo -e "${BLUE}📦 步驟 3: 構建 Release AAB...${NC}"
./gradlew bundleRelease

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}❌ AAB 構建失敗${NC}"
    exit 1
fi

echo ""

# 步驟 4: 顯示構建結果
echo -e "${GREEN}✅ 構建完成！${NC}\n"

# 讀取版本號
VERSION_CODE=$(grep -oP 'versionCode\s+\K\d+' app/build.gradle)
VERSION_NAME=$(grep -oP 'versionName\s+"\K[^"]+' app/build.gradle)

echo -e "${GREEN}📦 版本資訊:${NC}"
echo -e "   版本名稱: ${VERSION_NAME}"
echo -e "   版本代碼: ${VERSION_CODE}\n"

echo -e "${GREEN}📁 構建產物:${NC}"
echo -e "   AAB: ${GREEN}android/app/build/outputs/bundle/release/app-release.aab${NC}"
echo -e "   Mapping: ${GREEN}android/app/mapping/mapping-${VERSION_NAME}-${VERSION_CODE}.txt${NC}\n"

echo -e "${BLUE}📤 下一步:${NC}"
echo -e "   1. 上傳 AAB 到 Google Play Console"
echo -e "   2. 上傳 mapping 文件到對應的版本"
echo -e "   3. 填寫版本資訊並發布\n"

cd ..

