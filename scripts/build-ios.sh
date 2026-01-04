#!/bin/bash

# iOS 發布構建腳本
# 使用 EAS Build 生成 iOS 版本用於上傳到 App Store

set -e  # 遇到錯誤立即退出

# 顏色輸出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🍎 開始構建 iOS 發布版本...${NC}\n"

# 檢查參數
VERSION_TYPE=${1:-patch}  # 預設為 patch
BUILD_PROFILE=${2:-production}  # 預設為 production

if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major|skip)$ ]]; then
    echo -e "${YELLOW}⚠️  警告: 無效的版本類型 '$VERSION_TYPE'，使用預設值 'patch'${NC}"
    VERSION_TYPE=patch
fi

if [[ ! "$BUILD_PROFILE" =~ ^(production|preview|development)$ ]]; then
    echo -e "${YELLOW}⚠️  警告: 無效的建置配置檔 '$BUILD_PROFILE'，使用預設值 'production'${NC}"
    BUILD_PROFILE=production
fi

# 檢查 EAS CLI 是否已安裝
if ! command -v eas &> /dev/null; then
    echo -e "${RED}❌ EAS CLI 未安裝${NC}"
    echo -e "${YELLOW}   請執行: npm install -g eas-cli${NC}"
    exit 1
fi

# 檢查是否已登入 EAS
if ! eas whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  未登入 EAS，請先登入${NC}"
    echo -e "${BLUE}   執行: eas login${NC}"
    exit 1
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

# 步驟 2: 讀取當前版本號
echo -e "${BLUE}📦 步驟 2: 讀取版本資訊...${NC}"
VERSION_NAME=$(node -p "require('./app.json').expo.version")
echo -e "   版本名稱: ${VERSION_NAME}"
echo ""

# 步驟 3: 檢查並重新配置憑證（如果需要）
echo -e "${BLUE}🔐 步驟 3: 檢查 iOS 憑證配置...${NC}"
echo -e "${YELLOW}   如果遇到 Sign in with Apple capability 錯誤，將嘗試重新配置憑證${NC}\n"

# 嘗試重新配置憑證（僅在非互動模式下）
echo -e "${BLUE}   正在檢查憑證狀態...${NC}"
eas credentials --platform ios --non-interactive > /dev/null 2>&1 || true

echo ""

# 步驟 4: 執行 EAS Build
echo -e "${BLUE}🔨 步驟 4: 開始 EAS Build (配置檔: ${BUILD_PROFILE})...${NC}"
echo -e "${YELLOW}   ⚠️  此過程可能需要 10-30 分鐘，請耐心等待${NC}"
echo -e "${YELLOW}   ⚠️  如果遇到 Sign in with Apple 錯誤，請參考以下解決方案：${NC}"
echo -e "${YELLOW}      1. 前往 Apple Developer Portal 啟用 Sign in with Apple capability${NC}"
echo -e "${YELLOW}      2. 或執行: eas credentials --platform ios${NC}\n"

eas build --platform ios --profile "$BUILD_PROFILE" --non-interactive

BUILD_EXIT_CODE=$?

if [ $BUILD_EXIT_CODE -ne 0 ]; then
    echo ""
    echo -e "${RED}❌ iOS 建置失敗${NC}\n"
    
    # 檢查是否為 Sign in with Apple 相關錯誤
    echo -e "${YELLOW}💡 可能的解決方案：${NC}"
    echo -e "${YELLOW}   如果錯誤訊息包含 'Sign in with Apple' 或 'applesignin'：${NC}"
    echo ""
    echo -e "${BLUE}   方案 1: 在 Apple Developer Portal 中啟用 Sign in with Apple${NC}"
    echo -e "      1. 前往 https://developer.apple.com/account/resources/identifiers/list"
    echo -e "      2. 選擇 App ID: com.rueiyang.story"
    echo -e "      3. 啟用 'Sign in with Apple' capability"
    echo -e "      4. 儲存變更"
    echo ""
    echo -e "${BLUE}   方案 2: 使用 EAS 重新配置憑證${NC}"
    echo -e "      執行: ${GREEN}eas credentials --platform ios${NC}"
    echo -e "      然後選擇 'Set up new credentials' 或 'Update existing credentials'"
    echo ""
    echo -e "${BLUE}   方案 3: 刪除現有憑證並重新生成${NC}"
    echo -e "      執行: ${GREEN}eas credentials --platform ios${NC}"
    echo -e "      選擇 'Remove credentials' 然後重新建立"
    echo ""
    
    exit 1
fi

echo ""
echo -e "${GREEN}✅ 建置完成！${NC}\n"

echo -e "${GREEN}📦 版本資訊:${NC}"
echo -e "   版本名稱: ${VERSION_NAME}\n"

echo -e "${BLUE}📤 下一步:${NC}"
echo -e "   1. 前往 EAS Dashboard 下載建置產物"
echo -e "   2. 或使用以下指令提交到 App Store:"
echo -e "      ${GREEN}eas submit --platform ios${NC}"
echo -e "   3. 在 App Store Connect 中完成版本發布流程\n"

