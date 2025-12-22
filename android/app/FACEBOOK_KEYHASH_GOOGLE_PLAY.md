# Facebook KeyHash 與 Google Play App Signing

## ⚠️ 重要說明

如果您已經啟用 **Google Play App Signing**，Google Play 會使用**應用簽名金鑰**重新簽名您的應用，而不是使用您上傳時使用的**上傳金鑰**。

這意味著：
- ❌ 使用您的上傳金鑰（`waei0204.keystore`）產生的 KeyHash **不會生效**
- ✅ 必須使用 Google Play 的**應用簽名金鑰**產生的 KeyHash

## 🔍 如何確認是否啟用 Google Play App Signing

1. 前往 [Google Play Console](https://play.google.com/console)
2. 選擇您的應用
3. 進入「發布」→「設定」→「應用程式簽署」
4. 查看是否顯示「Google 管理您的應用程式簽署金鑰」

## 📥 方法一：從 Google Play Console 下載應用簽名證書

### 步驟：

1. 前往 Google Play Console → 您的應用 → **發布** → **設定** → **應用程式簽署**

2. 在「應用程式簽署金鑰憑證」區塊中，點擊「下載憑證」

3. 下載的檔案通常是 `deployment_cert.der` 或類似名稱

4. 使用以下命令生成 Facebook KeyHash：

```bash
# 將下載的證書轉換為 PEM 格式，然後生成 KeyHash
openssl x509 -inform DER -in deployment_cert.der -out deployment_cert.pem
openssl x509 -sha1 -fingerprint -noout -in deployment_cert.pem | cut -d'=' -f2 | tr -d ':' | xxd -r -p | base64
```

或者更簡單的方法：

```bash
openssl x509 -inform DER -in deployment_cert.der -fingerprint -sha1 -noout | cut -d'=' -f2 | tr -d ':' | xxd -r -p | base64
```

## 📋 方法二：從 Google Play Console 直接查看 SHA-1

1. 前往 Google Play Console → 您的應用 → **發布** → **設定** → **應用程式簽署**

2. 在「應用程式簽署金鑰憑證」區塊中，您會看到 **SHA-1 憑證指紋**

3. 將 SHA-1 指紋（格式如：`AA:BB:CC:DD:EE:FF:...`）轉換為 KeyHash：

```bash
# 假設 SHA-1 是 AA:BB:CC:DD:EE:FF:11:22:33:44:55:66:77:88:99:00:AA:BB:CC:DD
# 移除冒號並轉換為 Base64
echo "AABBCCDDEEFF11223344556677889900AABBCCDD" | xxd -r -p | base64
```

## 🛠️ 方法三：使用 Gradle Task（需要先下載證書）

將下載的 Google Play 應用簽名證書放到 `android/app/` 目錄，然後執行：

```bash
cd android
./gradlew -p app getGooglePlayFacebookKeyHash
```

## 📝 在 Facebook 開發者後台添加 KeyHash

1. 前往 [Facebook 開發者後台](https://developers.facebook.com/)
2. 選擇您的應用
3. 進入「設定」→「基本」
4. 在「Key Hashes」區塊中，點擊「新增 Key Hash」
5. 貼上從 Google Play 證書生成的 KeyHash
6. 儲存設定

## 💡 建議

為了確保所有環境都能正常運作，建議在 Facebook 開發者後台添加**兩個** KeyHash：

1. **Debug KeyHash** - 用於開發測試（使用 debug.keystore）
2. **Google Play KeyHash** - 用於正式版（從 Google Play Console 下載的證書生成）

這樣無論是開發環境還是正式環境，Facebook 登入都能正常運作。

