# Google Sign-In Release 版本修復指南

## 問題說明

Release 版本的 Google 登入失敗，錯誤訊息：
```
This android application is not registered to use OAuth2.0, 
please confirm the package name and SHA-1 certificate fingerprint 
match what you registered in Google Developer Console.
```

## 原因

Release 版本的 SHA-1 憑證指紋沒有在 Google Cloud Console 中註冊。

## SHA-1 簽名說明

### 這個 SHA-1 是什麼的簽名？

這個 SHA-1 (`4B:A6:A6:0A:C0:76:56:FA:4F:74:EA:8C:DF:E2:09:90:76:E7:F6:20`) 是來自你的 **Release Keystore** (`waei0204.keystore`) 的憑證指紋。

- **Keystore 檔案**: `android/app/waei0204.keystore`
- **Key Alias**: `mechwarr`
- **用途**: 用於簽名 release 版本的 APK 和 AAB

### AAB 和 APK 使用相同的簽名嗎？

**是的，在本地構建時，AAB 和 APK 都使用相同的 release keystore 簽名。**

根據你的 `build.gradle` 配置：

```172:199:android/app/build.gradle
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            if (project.hasProperty('MYAPP_UPLOAD_STORE_FILE')) {
                storeFile file(MYAPP_UPLOAD_STORE_FILE)
                storePassword MYAPP_UPLOAD_STORE_PASSWORD
                keyAlias MYAPP_UPLOAD_KEY_ALIAS
                keyPassword MYAPP_UPLOAD_KEY_PASSWORD
            }
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.release
```

- Release 版本的 **APK** 和 **AAB** 都使用 `signingConfigs.release`
- 都使用同一個 keystore (`waei0204.keystore`)
- 因此它們的 SHA-1 指紋是**相同的**

### ⚠️ 重要：Google Play App Signing

**如果你啟用了 Google Play App Signing**，情況會有所不同：

1. **上傳到 Google Play 的 AAB**：使用你的 `waei0204.keystore` 簽名（上傳簽名）
2. **Google Play 下載的應用程式**：Google Play 會用**它們自己的簽名金鑰**重新簽名（應用程式簽名）

在這種情況下，你需要註冊**兩個 SHA-1**：
- ✅ **上傳簽名的 SHA-1**：`4B:A6:A6:0A:C0:76:56:FA:4F:74:EA:8C:DF:E2:09:90:76:E7:F6:20`（用於本地測試）
- ✅ **Google Play 應用程式簽名的 SHA-1**：需要從 Google Play Console 取得（用於從 Play Store 下載的應用程式）

#### 如何取得 Google Play 應用程式簽名的 SHA-1？

1. 前往 Google Play Console：https://play.google.com/console
2. 選擇你的應用程式
3. 前往「發布」→「設定」→「應用程式完整性」
4. 在「應用程式簽名」區塊中，可以看到「SHA-1 憑證指紋」
5. 複製這個 SHA-1 並註冊到 Google Cloud Console

**建議做法**：同時註冊兩個 SHA-1，這樣無論是本地測試還是從 Play Store 下載的應用程式都能正常使用 Google 登入。

## 解決步驟

### 1. 確認應用程式資訊

- **Package Name**: `com.rueiyang.story`
- **Release SHA-1**: `4B:A6:A6:0A:C0:76:56:FA:4F:74:EA:8C:DF:E2:09:90:76:E7:F6:20`
- **Release SHA-256**: `A7:15:15:66:37:73:FB:3E:49:02:44:65:84:12:EF:22:42:CF:19:10:06:1D:BD:8A:A5:19:3F:DC:42:68:06:9F`

### 2. 前往 Google Cloud Console

1. 開啟瀏覽器，前往：https://console.cloud.google.com/apis/credentials
2. 選擇正確的專案（與你的 OAuth 2.0 Client ID 相關的專案）

### 3. 找到或建立 OAuth 2.0 Client ID

1. 在「憑證」頁面中，找到你的 Android OAuth 2.0 Client ID
   - 如果沒有，點擊「建立憑證」→「OAuth 2.0 Client ID」
   - 應用程式類型選擇「Android」

2. 編輯現有的 Android OAuth 2.0 Client ID，或建立新的：

### 4. 新增 SHA-1 憑證指紋

在 OAuth 2.0 Client ID 設定中：

1. **套件名稱 (Package name)**: 輸入 `com.rueiyang.story`
2. **SHA-1 憑證指紋**: 輸入 `4B:A6:A6:0A:C0:76:56:FA:4F:74:EA:8C:DF:E2:09:90:76:E7:F6:20`
   - 可以包含冒號，也可以不包含（Google Console 會自動處理）
   - 格式：`4B:A6:A6:0A:C0:76:56:FA:4F:74:EA:8C:DF:E2:09:90:76:E7:F6:20`
   - 或：`4BA6A60AC07656FA4F74EA8CDFE2099076E7F620`

3. **SHA-256 憑證指紋**（可選，建議也加入）:
   - `A7:15:15:66:37:73:FB:3E:49:02:44:65:84:12:EF:22:42:CF:19:10:06:1D:BD:8A:A5:19:3F:DC:42:68:06:9F`

### 5. 儲存設定

點擊「儲存」或「建立」按鈕。

### 6. 等待生效

- 通常需要 **5-10 分鐘** 才會生效
- 如果立即測試仍失敗，請等待一段時間後再試

### 7. 測試

重新編譯並安裝 release 版本，測試 Google 登入功能。

## 驗證步驟

### 檢查目前的 SHA-1 值

如果需要重新取得 SHA-1，可以執行：

```bash
# 使用腳本
./scripts/get-sha1.sh release

# 或使用 Gradle 任務
cd android/app
./gradlew getReleaseSha1
```

### 檢查 Google Cloud Console 設定

確認以下資訊正確：
- ✅ Package name: `com.rueiyang.story`
- ✅ SHA-1: `4B:A6:A6:0A:C0:76:56:FA:4F:74:EA:8C:DF:E2:09:90:76:E7:F6:20`
- ✅ OAuth 2.0 Client ID 的 Web Client ID 與程式碼中的 `WEB_CLIENT_ID` 相符

## 常見問題

### Q: 為什麼 Debug 版本可以，但 Release 版本不行？

A: Debug 和 Release 版本使用不同的 keystore，因此有不同的 SHA-1 指紋。兩個版本的 SHA-1 都需要在 Google Cloud Console 中註冊。

### Q: 如何確認 SHA-1 是否已註冊？

A: 在 Google Cloud Console 的 OAuth 2.0 Client ID 設定頁面中，可以看到已註冊的 SHA-1 指紋列表。

### Q: 修改後多久生效？

A: 通常 5-10 分鐘，但有時可能需要更長時間。如果 30 分鐘後仍無效，請檢查設定是否正確。

### Q: 需要同時註冊 SHA-1 和 SHA-256 嗎？

A: SHA-1 是必需的，SHA-256 是建議的（未來可能會要求）。建議兩個都註冊。

### Q: AAB 和 APK 的 SHA-1 一樣嗎？

A: 是的，在本地構建時，兩者都使用相同的 release keystore (`waei0204.keystore`)，所以 SHA-1 指紋是相同的。但如果啟用了 Google Play App Signing，從 Play Store 下載的應用程式會使用 Google Play 的簽名，需要另外註冊 Google Play 的 SHA-1。

### Q: 如何知道是否啟用了 Google Play App Signing？

A: 前往 Google Play Console → 你的應用程式 → 「發布」→「設定」→「應用程式完整性」。如果看到「應用程式簽名」區塊，表示已啟用。在該區塊中可以找到 Google Play 的 SHA-1 指紋。

## 如何從 Google Play Console 取得應用程式簽名的 SHA-1

如果你啟用了 Google Play App Signing，需要取得 Google Play 的應用程式簽名 SHA-1。以下是詳細步驟：

### 方法一：從 Google Play Console 網頁取得（推薦）

1. **登入 Google Play Console**
   - 前往：https://play.google.com/console
   - 使用你的開發者帳號登入

2. **選擇你的應用程式**
   - 在應用程式列表中，點擊你的應用程式（`com.rueiyang.story`）

3. **前往應用程式完整性設定**
   - 在左側選單中，點擊「發布」→「設定」→「應用程式完整性」
   - 或直接前往：`https://play.google.com/console/u/0/developers/[你的開發者ID]/app/[應用程式ID]/app-integrity`

4. **查看應用程式簽名資訊**
   - 在「應用程式簽名」區塊中，你會看到：
     - **SHA-1 憑證指紋**：這是 Google Play 用來簽名應用程式的 SHA-1
     - **SHA-256 憑證指紋**：建議也一併複製
   - 格式類似：`AA:BB:CC:DD:EE:FF:...` 或 `AABBCCDDEEFF...`

5. **複製 SHA-1 指紋**
   - 點擊 SHA-1 旁邊的「複製」按鈕，或手動複製整個 SHA-1 字串

6. **註冊到 Google Cloud Console**
   - 前往：https://console.cloud.google.com/apis/credentials
   - 找到你的 Android OAuth 2.0 Client ID
   - 編輯並新增這個 Google Play 的 SHA-1 指紋
   - 儲存設定

### 方法二：使用 Google Play Console API（進階）

如果你需要自動化取得，可以使用 Google Play Console API：

```bash
# 需要先設定 Google Cloud 認證
gcloud auth application-default login

# 使用 API 取得應用程式簽名資訊
# 注意：需要先啟用 Google Play Developer API
```

### 方法三：從已安裝的應用程式取得（測試用）

如果你已經從 Play Store 安裝了應用程式，可以使用以下命令取得 SHA-1：

```bash
# 連接 Android 裝置或模擬器
adb shell pm list packages | grep com.rueiyang.story

# 取得應用程式簽名資訊
adb shell dumpsys package com.rueiyang.story | grep -A 1 "signatures"
```

但這個方法比較複雜，建議直接從 Google Play Console 取得。

### 視覺化步驟指南

```
Google Play Console
  └─ 選擇應用程式
      └─ 左側選單：「發布」
          └─ 「設定」
              └─ 「應用程式完整性」
                  └─ 「應用程式簽名」區塊
                      └─ 複製 SHA-1 憑證指紋
```

### 注意事項

- ⚠️ **Google Play App Signing 的 SHA-1 與上傳簽名的 SHA-1 不同**
- ✅ **兩個 SHA-1 都需要註冊**到 Google Cloud Console 的 OAuth 2.0 Client ID
- ✅ **可以在同一個 OAuth 2.0 Client ID 中註冊多個 SHA-1**
- ⏱️ **註冊後需要等待 5-10 分鐘才會生效**

### 驗證是否已啟用 Google Play App Signing

如果你在「應用程式完整性」頁面看到：
- ✅ 「應用程式簽名」區塊存在 → 已啟用 Google Play App Signing
- ❌ 只有「上傳金鑰憑證」區塊 → 未啟用（使用上傳簽名）

如果未啟用 Google Play App Signing，則只需要註冊上傳簽名的 SHA-1 即可。

## 相關檔案

- `android/app/build.gradle` - Android 應用程式配置
- `android/gradle.properties` - Release keystore 配置
- `components/utils/googleAuth.ts` - Google 登入實作
- `scripts/get-sha1.sh` - SHA-1 取得腳本

## 注意事項

⚠️ **重要**: 
- 確保 release keystore (`waei0204.keystore`) 安全保存
- 如果更換 keystore，需要重新取得 SHA-1 並更新 Google Cloud Console
- **如果啟用了 Google Play App Signing**，需要同時註冊：
  1. 上傳簽名的 SHA-1（用於本地測試的 APK/AAB）
  2. Google Play 應用程式簽名的 SHA-1（用於從 Play Store 下載的應用程式）
- 可以在同一個 OAuth 2.0 Client ID 中註冊多個 SHA-1 指紋

