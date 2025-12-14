#!/bin/bash

# 模擬器測試構建腳本
# 生成 Release APK 檔案用於模擬器或設備測試（不啟用 ProGuard，快速構建）

set -e  # 遇到錯誤立即退出

# 顏色輸出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 開始構建模擬器測試版本 (Release APK)...${NC}\n"

# 檢查構建類型參數（為了向後兼容，保留參數但都構建 release）
BUILD_TYPE=${1:-debug}  # 預設為 debug（但實際構建 release）

if [[ ! "$BUILD_TYPE" =~ ^(debug|release)$ ]]; then
    echo -e "${YELLOW}⚠️  警告: 無效的構建類型 '$BUILD_TYPE'，使用預設值 'debug'${NC}"
    BUILD_TYPE=debug
fi

# 無論參數是什麼，都構建 release APK
echo -e "${BLUE}📝 構建類型: Release APK${NC}"
echo -e "${YELLOW}   ℹ️  使用 Release 簽名和配置${NC}"
echo -e "${YELLOW}   ℹ️  不啟用 ProGuard，構建速度更快${NC}"
echo -e "${YELLOW}   ℹ️  用於模擬器和設備測試${NC}"
echo ""

# 步驟 1: 清理之前的構建（可選）
CLEAN=${2:-false}
if [ "$CLEAN" == "clean" ]; then
    echo -e "${BLUE}🧹 清理之前的構建...${NC}"
    cd android
    ./gradlew clean
    echo ""
else
    echo -e "${YELLOW}⏭️  跳過清理（使用增量構建）${NC}\n"
    cd android
fi

# 步驟 2: 構建 Release APK
echo -e "${BLUE}📦 構建 Release APK (用於模擬器/設備測試)...${NC}"
echo -e "${YELLOW}   ⚠️  此構建不啟用 ProGuard，構建速度更快${NC}\n"

# 無論參數是什麼，都構建 release APK
./gradlew assembleRelease
APK_PATH="app/build/outputs/apk/release/app-release.apk"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ APK 構建失敗${NC}"
    exit 1
fi

echo ""

# 步驟 3: 顯示構建結果
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
echo -e "   ${GREEN}APK (模擬器/設備):${NC} android/${APK_PATH}\n"

# 檢查是否有連接的設備
echo -e "${BLUE}📱 安裝選項:${NC}"
if command -v adb &> /dev/null; then
    DEVICES=$(adb devices | grep -v "List" | grep "device" | wc -l | tr -d ' ')
    if [ "$DEVICES" -gt 0 ]; then
        echo -e "   檢測到 ${DEVICES} 個連接的設備"
        echo -e "   執行以下命令安裝："
        echo -e "   ${GREEN}adb install -r android/${APK_PATH}${NC}\n"
        
        read -p "是否現在安裝到設備？(y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${BLUE}📲 正在安裝...${NC}"
            adb install -r "${APK_PATH}"
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}✅ 安裝成功！${NC}"
            else
                echo -e "${RED}❌ 安裝失敗${NC}"
            fi
        fi
    else
        echo -e "   未檢測到連接的設備"
        echo -e "   手動安裝：${GREEN}adb install android/${APK_PATH}${NC}"
    fi
else
    echo -e "   adb 未找到，請手動安裝 APK"
fi

echo ""

cd ..

