#!/bin/bash

# 修復 iOS Pods 連結問題的腳本

set -e

echo "🔧 開始修復 iOS Pods 連結問題..."

cd "$(dirname "$0")/../ios"

echo "📦 步驟 1: 清除舊的 Pods 和構建緩存..."
rm -rf Pods
rm -rf Podfile.lock
rm -rf ~/Library/Developer/Xcode/DerivedData/storyappv2-*
rm -rf build

echo "📦 步驟 2: 清除 CocoaPods 緩存..."
pod cache clean --all 2>/dev/null || true

echo "📦 步驟 3: 重新安裝 Pods..."
pod install --repo-update

echo "✅ Pods 安裝完成！"
echo ""
echo "📝 下一步："
echo "   1. 在 Xcode 中執行 Product → Clean Build Folder (Shift + Cmd + K)"
echo "   2. 重新構建項目 (Cmd + B)"
echo "   3. 如果仍有問題，嘗試關閉並重新打開 Xcode"
