# IAP 與 Google Sign-In 的簽名配置差異

## 為什麼 Google Sign-In 正常但 IAP 失敗？

### 兩個不同的系統

#### 1. Google Sign-In（OAuth 2.0）
- **配置位置**：Google Cloud Console
- **需要**：OAuth 2.0 客戶端 ID 中的 SHA-1 憑證指紋
- **用途**：用戶身份驗證
- **驗證方式**：檢查應用簽名是否在 Google Cloud Console 的 SHA-1 列表中

#### 2. IAP（In-App Purchase）
- **配置位置**：Google Play Console
- **需要**：應用簽名必須與 Google Play Console 中註冊的一致
- **用途**：應用內購買
- **驗證方式**：Google Play Services 驗證應用簽名是否與 Google Play Console 中的一致

## 關鍵差異

### 如果使用 Google Play 應用簽署（Google Play App Signing）

這是**最常見的問題**！

當您上傳 APK/AAB 到 Google Play Console 時：
1. **上傳證書**：您本地簽名的證書（用於上傳）
2. **應用簽名證書**：Google Play 重新簽名使用的證書（用於實際分發）

**IAP 驗證的是應用簽名證書，不是上傳證書！**

### 解決方案

#### 步驟 1: 確認是否使用 Google Play 應用簽署

1. 前往 Google Play Console
2. 選擇您的應用
3. 前往「發布」→「應用簽名」
4. 查看是否顯示「Google Play 應用簽署」

#### 步驟 2: 獲取正確的簽名證書 SHA-1

**如果使用 Google Play 應用簽署：**

1. 在 Google Play Console 的「應用簽名」頁面
2. 找到「應用簽名證書」區塊
3. 複製「SHA-1 憑證指紋」
4. **這個 SHA-1 才是 IAP 需要的！**

**如果沒有使用 Google Play 應用簽署：**

使用您本地簽名的 SHA-1：
```bash
cd android/app
./gradlew getReleaseSha1
```

#### 步驟 3: 確認應用已發布到測試軌道

IAP **必須**在已發布的應用版本上才能工作：

1. 前往 Google Play Console
2. 選擇「測試」→「內部測試」（或 Alpha/Beta）
3. 確認應用狀態為「已發布」（不是「草稿」）
4. 確認測試帳號在測試人員名單中

#### 步驟 4: 確認商品配置

1. 前往「貨幣化」→「產品和訂閱」→「應用內商品」
2. 確認所有商品狀態為「已啟用」
3. 確認商品 ID 與程式碼中完全一致（區分大小寫）

## 常見問題

### Q: 為什麼 Google Sign-In 可以用，但 IAP 不行？

**A:** 因為它們使用不同的驗證機制：
- Google Sign-In 檢查 Google Cloud Console 中的 SHA-1 列表
- IAP 檢查 Google Play Console 中的應用簽名

### Q: 我已經在 Google Cloud Console 配置了 release 簽名的 SHA-1，為什麼 IAP 還是不行？

**A:** IAP 不依賴 Google Cloud Console 的配置，它依賴 Google Play Console 的應用簽名。

如果使用 Google Play 應用簽署，需要使用 Google Play Console 提供的「應用簽名證書」SHA-1，而不是本地簽名的 SHA-1。

### Q: 如何確認我使用的是哪個簽名證書？

**A:** 
1. 檢查 Google Play Console 的「應用簽名」頁面
2. 如果顯示「Google Play 應用簽署」，則使用 Google Play 提供的應用簽名證書
3. 如果沒有，則使用您本地簽名的證書

### Q: 我可以在 Google Cloud Console 中配置 Google Play 應用簽名證書的 SHA-1 嗎？

**A:** 可以，但這只會讓 Google Sign-In 也能使用該簽名。IAP 仍然需要：
1. 應用已發布到測試軌道
2. 商品已正確配置
3. 測試帳號在測試人員名單中

## 診斷步驟

### 1. 檢查應用簽名配置

```bash
# 獲取本地 release 簽名的 SHA-1
cd android/app
./gradlew getReleaseSha1
```

### 2. 檢查 Google Play Console 中的應用簽名

1. 前往 Google Play Console → 您的應用 → 發布 → 應用簽名
2. 記錄「應用簽名證書」的 SHA-1（如果使用 Google Play 應用簽署）
3. 記錄「上傳證書」的 SHA-1

### 3. 檢查應用發布狀態

1. 前往 Google Play Console → 您的應用 → 測試
2. 確認應用已發布到測試軌道
3. 確認狀態為「已發布」（不是「草稿」）

### 4. 檢查商品配置

1. 前往 Google Play Console → 您的應用 → 貨幣化 → 產品和訂閱 → 應用內商品
2. 確認所有商品狀態為「已啟用」
3. 確認商品 ID 與程式碼中完全一致

### 5. 檢查測試帳號

1. 前往 Google Play Console → 您的應用 → 測試 → 測試人員
2. 確認測試帳號在測試人員名單中
3. 確認測試帳號已接受測試邀請（如果使用電子郵件列表）

## 如果問題仍然存在

1. **等待同步**：Google Play 的更改可能需要 30-60 分鐘才能生效
2. **清除緩存**：清除 Google Play 服務和 Google Play 商店的緩存
3. **重新安裝**：卸載並重新安裝測試版本
4. **檢查日誌**：查看控制台中的 `[iapService]` 和 `[useIAP]` 日誌

