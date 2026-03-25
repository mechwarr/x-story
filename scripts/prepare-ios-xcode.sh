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

# 步驟 2: 同步專案版號（app.json / iOS 原生檔）
echo -e "${BLUE}🔄 步驟 2: 同步專案版號到 iOS 原生專案...${NC}"

# 以 android versionCode 作為 iOS buildNumber 的單一來源，避免多處不同步
VERSION_CODE=$(node -e "const fs=require('fs'); const p='./android/gradle.properties'; const t=fs.readFileSync(p,'utf8'); const m=t.match(/^VERSION_CODE=(\d+)/m); if(!m){process.exit(1)}; process.stdout.write(m[1]);")
VERSION_NAME=$(node -p "require('./app.json').expo.version")

node - "$VERSION_NAME" "$VERSION_CODE" <<'NODE'
const fs = require('fs');
const path = require('path');

const versionName = process.argv[2];
const buildNumber = process.argv[3];
const root = process.cwd();
const iosRoot = path.join(root, 'ios');

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, c) => fs.writeFileSync(p, c, 'utf8');

// 1) 同步 app.json（Expo 會以此生成原生版本欄位）
const appJsonPath = path.join(root, 'app.json');
const appJson = JSON.parse(read(appJsonPath));
appJson.expo = appJson.expo || {};
appJson.expo.version = versionName;
appJson.expo.ios = appJson.expo.ios || {};
appJson.expo.ios.buildNumber = String(buildNumber);
appJson.expo.android = appJson.expo.android || {};
appJson.expo.android.versionCode = Number(buildNumber);
write(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');

// 2) 同步所有 iOS Xcode 專案 pbxproj（避免專案改名後漏更新）
if (fs.existsSync(iosRoot)) {
  const entries = fs.readdirSync(iosRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.endsWith('.xcodeproj')) continue;
    const pbxprojPath = path.join(iosRoot, entry.name, 'project.pbxproj');
    if (!fs.existsSync(pbxprojPath)) continue;
    const pbxproj = read(pbxprojPath)
      .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${versionName};`)
      .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${buildNumber};`);
    write(pbxprojPath, pbxproj);
  }

  // 3) 同步所有 iOS app 目錄中的 Info.plist（保險）
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const plistPath = path.join(iosRoot, entry.name, 'Info.plist');
    if (!fs.existsSync(plistPath)) continue;
    let plist = read(plistPath);
    plist = plist.replace(
      /<key>CFBundleShortVersionString<\/key>\s*<string>[^<]+<\/string>/,
      `<key>CFBundleShortVersionString</key>\n\t<string>${versionName}</string>`
    );
    plist = plist.replace(
      /<key>CFBundleVersion<\/key>\s*<string>[^<]+<\/string>/,
      `<key>CFBundleVersion</key>\n\t<string>${buildNumber}</string>`
    );
    write(plistPath, plist);
  }
}
NODE

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 專案版號同步失敗${NC}"
    exit 1
fi

echo -e "   版本名稱: ${VERSION_NAME}"
echo -e "   Build Number: ${VERSION_CODE}"
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
if [[ "$XCODE_MAJOR_VERSION" =~ ^[0-9]+$ ]] && [ "$XCODE_MAJOR_VERSION" -lt 16 ]; then
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

# Expo prebuild 可能重建並更換 workspace 名稱，優先使用舊名稱，否則自動偵測
if [ -d "ios/storyappv2.xcworkspace" ]; then
    XCODE_PROJECT="ios/storyappv2.xcworkspace"
else
    XCODE_PROJECT=$(ls -d ios/*.xcworkspace 2>/dev/null | head -n 1)
fi

if [ -z "$XCODE_PROJECT" ] || [ ! -d "$XCODE_PROJECT" ]; then
    echo -e "${RED}❌ 找不到任何 Xcode workspace（ios/*.xcworkspace）${NC}"
    echo -e "${YELLOW}   請先確認 Expo prebuild 與 pod install 是否成功${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 準備完成！${NC}\n"

echo -e "${GREEN}📦 版本資訊:${NC}"
echo -e "   版本名稱: ${VERSION_NAME}"
echo -e "   Build Number: ${VERSION_CODE}"
echo -e "   jsbundle: ios/storyappv2/main.jsbundle (${JSBUNDLE_SIZE})\n"

echo -e "${BLUE}📤 下一步操作：${NC}"
echo -e "   1. 在 Xcode 中打開專案："
echo -e "      ${GREEN}open ${XCODE_PROJECT}${NC}"
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

