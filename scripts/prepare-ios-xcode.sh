#!/bin/bash

# iOS Xcode 專案準備腳本
# 生成 jsbundle 並準備好 Xcode 專案供手動建置

set -e  # 遇到錯誤立即退出

# 顏色輸出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🍎 準備 iOS Xcode 專案...${NC}\n"

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

# 步驟 2: 讀取當前版本號
echo -e "${BLUE}📦 步驟 2: 讀取版本資訊...${NC}"
VERSION_NAME=$(node -p "require('./app.json').expo.version")
echo -e "   版本名稱: ${VERSION_NAME}"
echo ""

# 步驟 2.5: 檢查 Xcode 和 iOS SDK 版本
echo -e "${BLUE}🔍 步驟 2.5: 檢查 Xcode 和 iOS SDK 版本...${NC}"

# 檢查 Xcode 是否安裝
if ! command -v xcodebuild &> /dev/null; then
    echo -e "${RED}❌ Xcode 未安裝或未在 PATH 中${NC}"
    echo -e "${YELLOW}   請從 App Store 安裝 Xcode${NC}"
    exit 1
fi

# 獲取 Xcode 版本
XCODE_VERSION=$(xcodebuild -version | head -n 1 | sed 's/Xcode //')
XCODE_BUILD=$(xcodebuild -version | tail -n 1 | sed 's/Build version //')

# 獲取 iOS SDK 版本
IOS_SDK_VERSION=$(xcodebuild -showsdks | grep -i "iphoneos" | tail -n 1 | sed 's/.*iphoneos\([0-9.]*\).*/\1/')

if [ -z "$IOS_SDK_VERSION" ]; then
    # 如果上面的方法失敗，嘗試另一種方法
    IOS_SDK_VERSION=$(xcodebuild -showsdks | grep -i "iphoneos" | awk '{print $NF}' | tail -n 1)
fi

echo -e "   Xcode 版本: ${GREEN}${XCODE_VERSION}${NC} (Build ${XCODE_BUILD})"
if [ -n "$IOS_SDK_VERSION" ]; then
    echo -e "   iOS SDK 版本: ${GREEN}${IOS_SDK_VERSION}${NC}"
else
    echo -e "   ${YELLOW}⚠️  無法確定 iOS SDK 版本${NC}"
fi

# 檢查是否為較舊的 Xcode 版本（警告）
XCODE_MAJOR_VERSION=$(echo "$XCODE_VERSION" | cut -d. -f1)
if [ "$XCODE_MAJOR_VERSION" -lt 16 ]; then
    echo -e "   ${YELLOW}⚠️  警告: 您使用的是較舊的 Xcode 版本${NC}"
    echo -e "   ${YELLOW}   建議更新到最新版本的 Xcode 以使用最新的 iOS SDK${NC}"
    echo -e "   ${YELLOW}   從 2026 年 4 月開始，需要 iOS 26 SDK (Xcode 26)${NC}"
fi

echo ""

# 步驟 3: 清理舊的 jsbundle
echo -e "${BLUE}🧹 步驟 3: 清理舊的 jsbundle...${NC}"
if [ -f "ios/main.jsbundle" ]; then
    rm -f ios/main.jsbundle
    echo -e "   ✅ 已刪除舊的 jsbundle (ios/main.jsbundle)"
fi
if [ -f "ios/storyappv2/main.jsbundle" ]; then
    rm -f ios/storyappv2/main.jsbundle
    echo -e "   ✅ 已刪除舊的 jsbundle (ios/storyappv2/main.jsbundle)"
fi
echo ""

# 步驟 4: 生成 jsbundle
echo -e "${BLUE}📦 步驟 4: 生成 JavaScript Bundle (jsbundle)...${NC}"
echo -e "${YELLOW}   ⚠️  這可能需要幾分鐘時間${NC}\n"

# 獲取 entry file
PROJECT_ROOT=$(pwd)

# 方法 1: 嘗試使用 package.json 中的 main 欄位解析實際文件路徑
MAIN_ENTRY=$(node -p "require('./package.json').main" 2>/dev/null)
if [ -n "$MAIN_ENTRY" ]; then
    ENTRY_FILE=$(node -e "try { console.log(require.resolve('$MAIN_ENTRY')); } catch(e) { console.log(''); }" 2>/dev/null)
fi

# 方法 2: 如果方法 1 失敗，嘗試直接執行 resolveAppEntry 腳本
if [ -z "$ENTRY_FILE" ] || [ ! -f "$ENTRY_FILE" ]; then
    RESOLVE_SCRIPT="node_modules/expo/scripts/resolveAppEntry.js"
    if [ -f "$RESOLVE_SCRIPT" ]; then
        ENTRY_FILE=$(node "$RESOLVE_SCRIPT" "$PROJECT_ROOT" ios absolute 2>/dev/null | tail -n 1)
    fi
fi

# 方法 3: 如果還是失敗，使用預設值
if [ -z "$ENTRY_FILE" ] || [ ! -f "$ENTRY_FILE" ]; then
    if [ -f "index.js" ]; then
        ENTRY_FILE="$PROJECT_ROOT/index.js"
    elif [ -f "node_modules/expo-router/entry.js" ]; then
        ENTRY_FILE="$PROJECT_ROOT/node_modules/expo-router/entry.js"
    fi
fi

# 最終檢查
if [ -z "$ENTRY_FILE" ] || [ ! -f "$ENTRY_FILE" ]; then
    echo -e "${RED}❌ 無法找到 entry file${NC}"
    echo -e "${YELLOW}   請確認專案配置正確${NC}"
    exit 1
fi

echo -e "${BLUE}   Entry file: ${ENTRY_FILE}${NC}\n"

# Xcode 專案引用的是 ios/main.jsbundle，所以生成到這個位置
JSBUNDLE_OUTPUT="ios/main.jsbundle"

# 使用 react-native bundle 生成 jsbundle（適用於 Expo 專案）
npx react-native bundle \
    --platform ios \
    --dev false \
    --entry-file "$ENTRY_FILE" \
    --bundle-output "$JSBUNDLE_OUTPUT" \
    --assets-dest ios/storyappv2/ \
    --minify true \
    --reset-cache

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ jsbundle 生成失敗${NC}"
    exit 1
fi

# 檢查 jsbundle 是否生成成功
if [ ! -f "$JSBUNDLE_OUTPUT" ]; then
    echo -e "${RED}❌ 找不到生成的 jsbundle 文件: ${JSBUNDLE_OUTPUT}${NC}"
    exit 1
fi

echo -e "${GREEN}   ✅ jsbundle 生成成功: ${JSBUNDLE_OUTPUT}${NC}"
JSBUNDLE_SIZE=$(du -h "$JSBUNDLE_OUTPUT" | cut -f1)
echo -e "   📊 檔案大小: ${JSBUNDLE_SIZE}\n"

# 確保 jsbundle 在 Xcode 專案中可見（如果需要，也可以複製到 storyappv2 目錄作為備份）
if [ ! -f "ios/storyappv2/main.jsbundle" ]; then
    cp "$JSBUNDLE_OUTPUT" ios/storyappv2/main.jsbundle
    echo -e "${GREEN}   ✅ 已複製 jsbundle 到 ios/storyappv2/main.jsbundle（備份）${NC}\n"
fi

# 步驟 5: 安裝 CocoaPods 依賴
echo -e "${BLUE}📦 步驟 5: 安裝 CocoaPods 依賴...${NC}"
cd ios

if ! command -v pod &> /dev/null; then
    echo -e "${YELLOW}⚠️  CocoaPods 未安裝，請先安裝：${NC}"
    echo -e "${BLUE}   sudo gem install cocoapods${NC}"
    cd ..
    exit 1
fi

echo -e "${YELLOW}   ⚠️  這可能需要幾分鐘時間...${NC}\n"

# 設置 UTF-8 編碼以避免 CocoaPods 錯誤
export LANG=en_US.UTF-8
pod install

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ CocoaPods 安裝失敗${NC}"
    cd ..
    exit 1
fi

cd ..
echo -e "${GREEN}   ✅ CocoaPods 依賴安裝完成${NC}\n"

# 步驟 5.5: 保護 WeChat 原生模組文件（防止被覆蓋）
echo -e "${BLUE}🔒 步驟 5.5: 保護 WeChat 原生模組文件...${NC}"
if [ -f "scripts/protect-wechat-files.sh" ]; then
  source scripts/protect-wechat-files.sh
else
  echo -e "${YELLOW}   ⚠️  保護腳本不存在，跳過${NC}\n"
fi

# 步驟 6: 打開 Xcode
echo -e "${BLUE}🚀 步驟 6: 準備打開 Xcode...${NC}\n"

XCODE_PROJECT="ios/storyappv2.xcworkspace"

if [ ! -d "$XCODE_PROJECT" ]; then
    echo -e "${RED}❌ 找不到 Xcode workspace: ${XCODE_PROJECT}${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 準備完成！${NC}\n"

echo -e "${GREEN}📦 版本資訊:${NC}"
echo -e "   版本名稱: ${VERSION_NAME}"
echo -e "   jsbundle: ios/storyappv2/main.jsbundle (${JSBUNDLE_SIZE})\n"

echo -e "${BLUE}📤 下一步操作：${NC}"
echo -e "   1. 在 Xcode 中打開專案："
echo -e "      ${GREEN}open ios/storyappv2.xcworkspace${NC}"
echo ""
echo -e "   2. 在 Xcode 中："
echo -e "      - 選擇正確的 Team 和 Provisioning Profile"
echo -e "      - 選擇 Product → Scheme → storyappv2"
echo -e "      - 選擇 Product → Destination → Any iOS Device (arm64)"
echo -e "      - ${YELLOW}重要: 確認使用最新版本的 Xcode 進行構建${NC}"
echo -e "      - 點擊 Product → Archive 來建置"
echo ""
echo -e "   3. 建置完成後："
echo -e "      - 在 Organizer 中選擇 Archive"
echo -e "      - 點擊 'Distribute App' 上傳到 App Store"
echo ""
echo -e "   ${YELLOW}📌 關於 iOS SDK 版本：${NC}"
echo -e "      - 當前使用的 iOS SDK 版本取決於您本地安裝的 Xcode 版本"
echo -e "      - 如果收到 ITMS-90725 警告，請確保使用最新版本的 Xcode"
echo -e "      - 從 2026 年 4 月開始，需要 iOS 26 SDK (Xcode 26)"
echo -e "      - 檢查 Xcode 版本: ${GREEN}xcodebuild -version${NC}"
echo -e "      - 檢查 iOS SDK 版本: ${GREEN}xcodebuild -showsdks | grep iphoneos${NC}"
echo ""

# 詢問是否要打開 Xcode
read -p "是否現在打開 Xcode? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}正在打開 Xcode...${NC}"
    open "$XCODE_PROJECT"
    echo -e "${GREEN}✅ Xcode 已打開${NC}\n"
else
    echo -e "${YELLOW}您可以稍後手動打開: open ${XCODE_PROJECT}${NC}\n"
fi

