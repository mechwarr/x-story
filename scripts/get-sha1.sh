#!/bin/bash

# 獲取 SHA-1 憑證指紋腳本（用於 Google Sign-In 配置）
# 使用方法: ./scripts/get-sha1.sh [debug|release]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ANDROID_APP_DIR="$PROJECT_ROOT/android/app"

cd "$ANDROID_APP_DIR"

MODE="${1:-debug}"

if [ "$MODE" = "debug" ]; then
    echo "🔑 獲取 Debug Keystore 的 SHA-1 指紋..."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if [ ! -f "debug.keystore" ]; then
        echo "❌ 錯誤: debug.keystore 不存在"
        echo "   位置: $ANDROID_APP_DIR/debug.keystore"
        exit 1
    fi
    
    keytool -list -v \
        -keystore debug.keystore \
        -alias androiddebugkey \
        -storepass android \
        -keypass android
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ 請複製上面的 SHA1 值"
    echo "📍 前往 Google Cloud Console 註冊:"
    echo "   https://console.cloud.google.com/apis/credentials"
    echo ""
    echo "📝 應用程式 ID: com.rueiyang.story"
    
elif [ "$MODE" = "release" ]; then
    echo "🔑 獲取 Release Keystore 的 SHA-1 指紋..."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # 檢查 gradle.properties 是否存在
    GRADLE_PROPERTIES="$PROJECT_ROOT/android/gradle.properties"
    if [ ! -f "$GRADLE_PROPERTIES" ]; then
        echo "❌ 錯誤: gradle.properties 不存在"
        echo "   位置: $GRADLE_PROPERTIES"
        exit 1
    fi
    
    # 讀取配置（使用更可靠的方法）
    MYAPP_UPLOAD_STORE_FILE=$(grep -E '^MYAPP_UPLOAD_STORE_FILE=' "$GRADLE_PROPERTIES" | cut -d'=' -f2 | tr -d '[:space:]' || echo "")
    MYAPP_UPLOAD_STORE_PASSWORD=$(grep -E '^MYAPP_UPLOAD_STORE_PASSWORD=' "$GRADLE_PROPERTIES" | cut -d'=' -f2 | tr -d '[:space:]' || echo "")
    MYAPP_UPLOAD_KEY_ALIAS=$(grep -E '^MYAPP_UPLOAD_KEY_ALIAS=' "$GRADLE_PROPERTIES" | cut -d'=' -f2 | tr -d '[:space:]' || echo "")
    MYAPP_UPLOAD_KEY_PASSWORD=$(grep -E '^MYAPP_UPLOAD_KEY_PASSWORD=' "$GRADLE_PROPERTIES" | cut -d'=' -f2 | tr -d '[:space:]' || echo "")
    
    if [ -z "$MYAPP_UPLOAD_STORE_FILE" ]; then
        echo "❌ 錯誤: 未在 gradle.properties 中找到 MYAPP_UPLOAD_STORE_FILE"
        echo "   請先配置 Release keystore 資訊"
        echo ""
        echo "   需要在 $GRADLE_PROPERTIES 中添加："
        echo "   MYAPP_UPLOAD_STORE_FILE=waei0204.keystore"
        echo "   MYAPP_UPLOAD_KEY_ALIAS=mechwarr"
        echo "   MYAPP_UPLOAD_STORE_PASSWORD=your_password"
        echo "   MYAPP_UPLOAD_KEY_PASSWORD=your_password"
        exit 1
    fi
    
    # 檢查 keystore 文件路徑（可能是相對路徑或絕對路徑）
    if [ -f "$ANDROID_APP_DIR/$MYAPP_UPLOAD_STORE_FILE" ]; then
        KEYSTORE_PATH="$ANDROID_APP_DIR/$MYAPP_UPLOAD_STORE_FILE"
    elif [ -f "$MYAPP_UPLOAD_STORE_FILE" ]; then
        KEYSTORE_PATH="$MYAPP_UPLOAD_STORE_FILE"
    else
        echo "❌ 錯誤: Release keystore 不存在"
        echo "   嘗試的位置:"
        echo "   - $ANDROID_APP_DIR/$MYAPP_UPLOAD_STORE_FILE"
        echo "   - $MYAPP_UPLOAD_STORE_FILE"
        exit 1
    fi
    
    if [ -z "$MYAPP_UPLOAD_STORE_PASSWORD" ] || [ -z "$MYAPP_UPLOAD_KEY_ALIAS" ] || [ -z "$MYAPP_UPLOAD_KEY_PASSWORD" ]; then
        echo "⚠️  警告: 部分密碼資訊缺失，將提示手動輸入"
        keytool -list -v \
            -keystore "$KEYSTORE_PATH" \
            -alias "${MYAPP_UPLOAD_KEY_ALIAS:-}" \
            -storepass "${MYAPP_UPLOAD_STORE_PASSWORD:-}" \
            -keypass "${MYAPP_UPLOAD_KEY_PASSWORD:-}"
    else
        keytool -list -v \
            -keystore "$KEYSTORE_PATH" \
            -alias "$MYAPP_UPLOAD_KEY_ALIAS" \
            -storepass "$MYAPP_UPLOAD_STORE_PASSWORD" \
            -keypass "$MYAPP_UPLOAD_KEY_PASSWORD"
    fi
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ 請複製上面的 SHA1 值"
    echo "📍 前往 Google Cloud Console 註冊:"
    echo "   https://console.cloud.google.com/apis/credentials"
    echo ""
    echo "📝 應用程式 ID: com.rueiyang.story"
    
else
    echo "❌ 錯誤: 無效的模式 '$MODE'"
    echo ""
    echo "使用方法:"
    echo "  ./scripts/get-sha1.sh debug    # 獲取 Debug keystore 的 SHA-1"
    echo "  ./scripts/get-sha1.sh release   # 獲取 Release keystore 的 SHA-1"
    exit 1
fi

