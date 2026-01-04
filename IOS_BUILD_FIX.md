# iOS 建置問題解決方案

## 問題 1: "You do not have required contracts to perform an operation"

### 原因
這是 App Store Connect 的權限問題，通常發生在：
- 帳號沒有簽署必要的合約（如 Paid Applications Agreement）
- 帳號角色權限不足
- 需要更新付款資訊

### 解決方案

1. **檢查 App Store Connect 合約狀態**
   - 前往 https://appstoreconnect.apple.com
   - 點擊「協議、稅務和銀行業務」
   - 確認所有必要的合約都已簽署（特別是「付費應用程式協議」）

2. **檢查帳號權限**
   - 確認您的 Apple ID 有「App Manager」或「Admin」權限
   - 如果是團隊帳號，請聯繫帳號管理員

3. **更新付款資訊**
   - 在「協議、稅務和銀行業務」中更新付款和稅務資訊

## 問題 2: "The archive did not include a dSYM for the hermes.framework"

### 原因
Archive 中缺少 hermes.framework 的 dSYM 文件，這會影響崩潰報告的符號化。這個問題通常發生在：
- Hermes framework 的 dSYM 沒有被自動包含在 Archive 中
- Xcode 構建設置中缺少必要的配置

### 解決方案

#### 方法 1: 使用自動化腳本（最簡單，推薦）

執行以下命令會自動檢查並修復問題：

```bash
# 步驟 1: 檢查當前狀態
npm run fix:ios:dsym

# 步驟 2: 自動添加 Build Phase（如果需要）
npm run fix:ios:dsym:auto
```

然後在 Xcode 中重新執行 Product → Archive。

#### 方法 2: 在 Xcode 中手動添加 Build Phase（最可靠）

1. **確認 Debug Information Format 設定**
   - 在 Xcode 中打開專案
   - 選擇 Target "storyappv2" → Build Settings
   - 搜尋 "Debug Information Format"
   - 確保 Release 配置設為 "DWARF with dSYM File"

2. **添加 Build Phase**
   - 選擇 Target "storyappv2" → Build Phases
   - 點擊左上角 "+" → New Run Script Phase
   - 將新 Phase 拖到 "Bundle React Native code and images" 之後
   - 命名為 "Copy Hermes dSYM"
   - 在腳本區域添加以下內容：

```bash
# 複製 hermes.framework 的 dSYM 到 Archive
HERMES_DSYM_PATH="${PODS_ROOT}/hermes-engine/Pre-built/dSYMs/hermes.framework.dSYM"
HERMES_DSYM_PATH_ALT="${PODS_ROOT}/hermes-engine/dSYMs/hermes.framework.dSYM"

if [ -d "$HERMES_DSYM_PATH" ]; then
    echo "Copying Hermes dSYM from $HERMES_DSYM_PATH"
    cp -R "$HERMES_DSYM_PATH" "${DWARF_DSYM_FOLDER_PATH}/"
elif [ -d "$HERMES_DSYM_PATH_ALT" ]; then
    echo "Copying Hermes dSYM from $HERMES_DSYM_PATH_ALT"
    cp -R "$HERMES_DSYM_PATH_ALT" "${DWARF_DSYM_FOLDER_PATH}/"
fi
```

3. **重新 Archive**
   - 在 Xcode 中執行 Product → Archive
   - 上傳到 App Store Connect

#### 方法 3: 檢查 Hermes dSYM 是否存在

如果上述方法無效，可能是 Hermes dSYM 文件本身不存在：

```bash
# 檢查 dSYM 位置
ls -la ios/Pods/hermes-engine/Pre-built/dSYMs/
# 或
ls -la ios/Pods/hermes-engine/dSYMs/

# 如果不存在，重新安裝 Pods
cd ios
pod install
```

### 驗證修復

Archive 完成後，可以驗證 dSYM 是否包含：

1. 在 Xcode Organizer 中選擇 Archive
2. 右鍵點擊 Archive → Show in Finder
3. 右鍵點擊 .xcarchive → Show Package Contents
4. 檢查 `dSYMs/` 文件夾中是否包含 `hermes.framework.dSYM`

### 快速修復指令總結

```bash
# 檢查和診斷
npm run fix:ios:dsym

# 自動添加 Build Phase
npm run fix:ios:dsym:auto

# 然後在 Xcode 中重新 Archive
```

