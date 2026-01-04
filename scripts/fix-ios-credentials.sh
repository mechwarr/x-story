#!/bin/bash

# iOS 憑證修復腳本
# 用於解決 Sign in with Apple capability 相關的憑證問題

set -e

# 顏色輸出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔐 iOS 憑證修復工具${NC}\n"

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

echo -e "${YELLOW}⚠️  重要提示：${NC}"
echo -e "${YELLOW}   此腳本將協助您重新配置 iOS 憑證以支援 Sign in with Apple capability${NC}\n"

echo -e "${BLUE}📋 解決方案選項：${NC}\n"

echo -e "${GREEN}方案 1: 在 Apple Developer Portal 中啟用 Sign in with Apple（推薦）${NC}"
echo -e "   1. 前往: https://developer.apple.com/account/resources/identifiers/list"
echo -e "   2. 選擇 App ID: ${GREEN}com.rueiyang.story${NC}"
echo -e "   3. 勾選 'Sign in with Apple' capability"
echo -e "   4. 點擊 'Save' 儲存"
echo -e "   5. 等待幾分鐘讓變更生效"
echo -e "   6. 然後重新執行建置腳本\n"

echo -e "${GREEN}方案 2: 使用 EAS 重新配置憑證${NC}"
echo -e "   執行以下指令來重新配置憑證：\n"
echo -e "   ${BLUE}eas credentials --platform ios${NC}\n"
echo -e "   在互動式選單中："
echo -e "   - 選擇 'Set up new credentials' 或 'Update existing credentials'"
echo -e "   - 確保 Sign in with Apple capability 已啟用\n"

echo -e "${GREEN}方案 3: 查看當前憑證狀態${NC}"
echo -e "   執行: ${BLUE}eas credentials --platform ios${NC}\n"

echo -e "${YELLOW}請選擇要執行的操作：${NC}"
echo -e "   1) 查看當前憑證狀態"
echo -e "   2) 開啟 Apple Developer Portal"
echo -e "   3) 執行 EAS 憑證配置（互動式）"
echo -e "   4) 退出"
echo ""
read -p "請輸入選項 (1-4): " choice

case $choice in
    1)
        echo -e "\n${BLUE}📋 當前憑證狀態：${NC}\n"
        eas credentials --platform ios
        ;;
    2)
        echo -e "\n${BLUE}🌐 正在開啟 Apple Developer Portal...${NC}"
        if [[ "$OSTYPE" == "darwin"* ]]; then
            open "https://developer.apple.com/account/resources/identifiers/list"
        else
            echo -e "${YELLOW}   請手動開啟: https://developer.apple.com/account/resources/identifiers/list${NC}"
        fi
        echo -e "\n${GREEN}✅ 請在 Apple Developer Portal 中：${NC}"
        echo -e "   1. 找到 App ID: com.rueiyang.story"
        echo -e "   2. 啟用 'Sign in with Apple' capability"
        echo -e "   3. 儲存變更"
        ;;
    3)
        echo -e "\n${BLUE}🔧 啟動 EAS 憑證配置工具...${NC}\n"
        eas credentials --platform ios
        ;;
    4)
        echo -e "\n${GREEN}👋 已退出${NC}"
        exit 0
        ;;
    *)
        echo -e "\n${RED}❌ 無效的選項${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}✅ 操作完成！${NC}\n"
echo -e "${BLUE}📤 下一步：${NC}"
echo -e "   執行建置指令: ${GREEN}npm run build:ios${NC}\n"

