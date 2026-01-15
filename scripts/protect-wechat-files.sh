#!/bin/bash

# 保護 WeChat 原生模組文件
# 在 prepare:ios:xcode 腳本中調用，確保文件不會被覆蓋

set -e

# 顏色輸出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

WECHAT_FILES=(
  "ios/storyappv2/WeChatModule.swift"
  "ios/storyappv2/WeChatPackage.m"
)

echo -e "${YELLOW}🔒 保護 WeChat 原生模組文件...${NC}"

# 檢查文件是否存在
for file in "${WECHAT_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo -e "${YELLOW}⚠️  文件不存在: $file${NC}"
    echo -e "${YELLOW}   嘗試從 Git 恢復...${NC}"
    
    # 嘗試從 Git 恢復
    if git rev-parse --git-dir > /dev/null 2>&1; then
      if git ls-files --error-unmatch "$file" > /dev/null 2>&1; then
        git checkout "$file"
        echo -e "${GREEN}   ✅ 已從 Git 恢復: $file${NC}"
      else
        echo -e "${YELLOW}   ⚠️  文件不在 Git 中，無法恢復${NC}"
      fi
    else
      echo -e "${YELLOW}   ⚠️  不在 Git 倉庫中，無法恢復${NC}"
    fi
  else
    echo -e "${GREEN}   ✅ 文件存在: $file${NC}"
  fi
done

echo -e "${GREEN}✅ 文件保護完成${NC}\n"

