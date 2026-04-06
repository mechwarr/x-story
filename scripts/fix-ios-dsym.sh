#!/bin/bash

# iOS dSYM 修復腳本
# 確保 hermes.framework 的 dSYM 被正確包含在 Archive 中

set -e

# 顏色輸出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 修復 iOS Hermes dSYM 設定...${NC}\n"

PROJECT_FILE="ios/xStory.xcodeproj/project.pbxproj"

# 檢查專案文件是否存在
if [ ! -f "$PROJECT_FILE" ]; then
    echo -e "${RED}❌ 找不到 Xcode 專案文件: ${PROJECT_FILE}${NC}"
    exit 1
fi

# 檢查是否已經設置了 DEBUG_INFORMATION_FORMAT
echo -e "${BLUE}📋 步驟 1: 檢查 Debug Information Format 設定...${NC}"
if grep -qE 'DEBUG_INFORMATION_FORMAT = ("dwarf-with-dsym"|dwarf-with-dsym)' "$PROJECT_FILE"; then
    echo -e "${GREEN}✅ Release 配置已正確設置 DEBUG_INFORMATION_FORMAT = dwarf-with-dsym${NC}"
else
    echo -e "${YELLOW}⚠️  未找到正確的 DEBUG_INFORMATION_FORMAT 設置${NC}"
    echo -e "${BLUE}   請在 Xcode 中手動設置：${NC}"
    echo -e "   1. 打開 Xcode 專案"
    echo -e "   2. 選擇 Target 'xStory' → Build Settings"
    echo -e "   3. 搜尋 'Debug Information Format'"
    echo -e "   4. 將 Release 配置設為 'DWARF with dSYM File'"
    echo ""
fi

# 檢查 hermes dSYM 位置
echo -e "${BLUE}📋 步驟 2: 檢查 hermes.framework dSYM 位置...${NC}"

HERMES_DSYM_PATHS=(
    "ios/Pods/hermes-engine/Pre-built/dSYMs/hermes.framework.dSYM"
    "ios/Pods/hermes-engine/dSYMs/hermes.framework.dSYM"
    "${PODS_ROOT}/hermes-engine/Pre-built/dSYMs/hermes.framework.dSYM"
    "${PODS_ROOT}/hermes-engine/dSYMs/hermes.framework.dSYM"
)

HERMES_DSYM_FOUND=""
for path in "${HERMES_DSYM_PATHS[@]}"; do
    # 展開環境變數
    expanded_path=$(eval echo "$path" 2>/dev/null || echo "$path")
    if [ -d "$expanded_path" ]; then
        HERMES_DSYM_FOUND="$expanded_path"
        echo -e "${GREEN}✅ 找到 hermes dSYM: ${expanded_path}${NC}"
        break
    fi
done

if [ -z "$HERMES_DSYM_FOUND" ]; then
    echo -e "${YELLOW}⚠️  未找到 hermes dSYM${NC}"
    echo -e "${BLUE}   可能的位置：${NC}"
    for path in "${HERMES_DSYM_PATHS[@]}"; do
        echo -e "   - ${path}"
    done
    echo ""
    echo -e "${YELLOW}   如果 dSYM 不存在，請執行:${NC}"
    echo -e "   ${GREEN}cd ios && pod install${NC}"
    echo ""
fi

# 檢查是否已經有複製 Hermes dSYM 的 Build Phase
echo -e "${BLUE}📋 步驟 3: 檢查 Build Phase 設定...${NC}"
if grep -q "Generate Hermes dSYM\|Copy Hermes dSYM\|hermes.framework.dSYM" "$PROJECT_FILE"; then
    echo -e "${GREEN}✅ 已找到 Hermes dSYM 相關的 Build Phase${NC}"
else
    echo -e "${YELLOW}⚠️  未找到 Hermes dSYM 的 Build Phase（專案應含「Generate Hermes dSYM」Run Script）${NC}"
    echo ""
    echo -e "${BLUE}📝 需要手動添加 Build Phase：${NC}"
    echo -e "${YELLOW}   方法 1: 在 Xcode 中手動添加（推薦）${NC}"
    echo -e "   1. 打開 Xcode 專案"
    echo -e "   2. 選擇 Target 'xStory' → Build Phases"
    echo -e "   3. 點擊左上角 '+' → New Run Script Phase"
    echo -e "   4. 將新 Phase 拖到 'Bundle React Native code and images' 之後"
    echo -e "   5. 命名為 'Copy Hermes dSYM'"
    echo -e "   6. 在腳本區域添加以下內容："
    echo ""
    echo -e "${GREEN}# 複製 hermes.framework 的 dSYM 到 Archive${NC}"
    echo -e "${GREEN}HERMES_DSYM_PATH=\"\${PODS_ROOT}/hermes-engine/Pre-built/dSYMs/hermes.framework.dSYM\"${NC}"
    echo -e "${GREEN}HERMES_DSYM_PATH_ALT=\"\${PODS_ROOT}/hermes-engine/dSYMs/hermes.framework.dSYM\"${NC}"
    echo -e "${GREEN}${NC}"
    echo -e "${GREEN}if [ -d \"\$HERMES_DSYM_PATH\" ]; then${NC}"
    echo -e "${GREEN}    echo \"Copying Hermes dSYM from \$HERMES_DSYM_PATH\"${NC}"
    echo -e "${GREEN}    cp -R \"\$HERMES_DSYM_PATH\" \"\${DWARF_DSYM_FOLDER_PATH}/\"${NC}"
    echo -e "${GREEN}elif [ -d \"\$HERMES_DSYM_PATH_ALT\" ]; then${NC}"
    echo -e "${GREEN}    echo \"Copying Hermes dSYM from \$HERMES_DSYM_PATH_ALT\"${NC}"
    echo -e "${GREEN}    cp -R \"\$HERMES_DSYM_PATH_ALT\" \"\${DWARF_DSYM_FOLDER_PATH}/\"${NC}"
    echo -e "${GREEN}fi${NC}"
    echo ""
    echo -e "${YELLOW}   方法 2: 使用自動化腳本（實驗性）${NC}"
    echo -e "   執行: ${GREEN}node scripts/add-hermes-dsym-phase.js${NC}"
    echo ""
fi

echo ""
echo -e "${GREEN}✅ dSYM 檢查完成${NC}\n"

echo -e "${BLUE}📤 下一步操作：${NC}"
echo -e "   1. 確認 Build Settings → Debug Information Format → Release 設為 'DWARF with dSYM File'"
if [ -z "$HERMES_DSYM_FOUND" ]; then
    echo -e "   2. 執行 ${GREEN}cd ios && pod install${NC} 確保 Hermes dSYM 存在"
fi
if ! grep -q "Generate Hermes dSYM\|Copy Hermes dSYM\|hermes.framework.dSYM" "$PROJECT_FILE"; then
    echo -e "   3. 確認專案已加入「Generate Hermes dSYM」Build Phase（對嵌入的 hermes 執行 dsymutil）"
fi
echo -e "   4. 在 Xcode 中執行 Product → Archive"
echo -e "   5. 上傳到 App Store Connect"
echo ""
