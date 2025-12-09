# 內購設定指南 (In-App Purchase Setup Guide)

本專案使用 `react-native-iap` (v14.4.5) 來實作 iOS App Store 和 Google Play Store 的內購功能。

## 📦 已安裝的套件

- `react-native-iap`: ^14.4.5

## 🚀 快速開始

### 1. 使用內購服務

在組件中使用 `useIAP` Hook：

```typescript
import { useIAP } from '../hook/useIAP';
import { PRODUCT_IDS } from '../services/iapService';

function ShopScreen() {
  const { products, isLoading, isPurchasing, purchaseProduct } = useIAP();

  const handlePurchase = async (productId: string) => {
    await purchaseProduct(productId as any);
  };

  // ...
}
```

### 2. 商品 ID 配置

商品 ID 定義在 `app/services/iapService.ts` 中的 `PRODUCT_IDS`：

```typescript
export const PRODUCT_IDS = {
  PACK_1: 'item_001',
  PACK_2: 'item_002',
  PACK_3: 'item_003',
  PACK_4: 'item_004',
  PACK_5: 'item_005',
  PACK_6: 'item_006',
};
```

**重要**：這些商品 ID 必須與您在 App Store Connect 和 Google Play Console 中設定的商品 ID **完全一致**。

## 📱 iOS 設定 (App Store Connect)

### 步驟 1: 在 App Store Connect 建立商品

1. 登入 [App Store Connect](https://appstoreconnect.apple.com/)
2. 選擇您的 App
3. 進入「功能」→「App 內購買項目」
4. 點擊「+」建立新商品
5. 選擇商品類型：
   - **消耗性商品** (Consumable)：可重複購買（建議用於金幣包）
   - **非消耗性商品** (Non-Consumable)：一次性購買
   - **自動續訂訂閱** (Auto-Renewable Subscription)
   - **非續訂訂閱** (Non-Renewing Subscription)

6. 填寫商品資訊：
   - **商品 ID**：必須與 `PRODUCT_IDS` 中的值完全一致
     - `item_001` - 入門基本包
     - `item_002` - 熱門推薦包
     - `item_003` - 高效閱讀包
     - `item_004` - 文青超值包
     - `item_005` - VIP獨享包
     - `item_006` - 尊爵贊助包
   - **參考名稱**：僅供內部使用
   - **價格**：設定價格等級
   - **本地化資訊**：商品名稱和描述

### 步驟 2: 建立沙盒測試帳號

1. 在 App Store Connect 中進入「使用者和存取權限」
2. 建立沙盒測試帳號（用於測試購買）

### 步驟 3: 測試

1. 在實體設備上測試（模擬器不支援內購）
2. 登出 App Store 帳號
3. 在 App 中觸發購買，系統會提示登入沙盒測試帳號

## 🤖 Android 設定 (Google Play Console)

### 步驟 1: 在 Google Play Console 建立商品

1. 登入 [Google Play Console](https://play.google.com/console/)
2. 選擇您的 App
3. 進入「營利」→「產品」→「應用程式內產品」
4. 點擊「建立產品」
5. 填寫商品資訊：
   - **產品 ID**：必須與 `PRODUCT_IDS` 中的值完全一致
     - `item_001` - 入門基本包
     - `item_002` - 熱門推薦包
     - `item_003` - 高效閱讀包
     - `item_004` - 文青超值包
     - `item_005` - VIP獨享包
     - `item_006` - 尊爵贊助包
   - **名稱**：商品顯示名稱
   - **描述**：商品描述
   - **價格**：設定價格
   - **狀態**：設為「有效」

### 步驟 2: 上傳簽名 APK/AAB

- 內購功能需要在已簽名的版本上測試
- 確保使用正確的簽名金鑰

### 步驟 3: 測試

1. 將測試帳號加入「授權測試人員」清單
2. 在實體設備或模擬器上測試
3. 使用測試帳號登入 Google Play

## 🔧 後端驗證（建議）

雖然 `react-native-iap` 提供了本地驗證功能，但為了安全性，建議在後端驗證收據：

### iOS 收據驗證

```typescript
// 在後端驗證 iOS 收據
POST https://buy.itunes.apple.com/verifyReceipt (生產環境)
POST https://sandbox.itunes.apple.com/verifyReceipt (測試環境)
```

### Android 收據驗證

```typescript
// 使用 Google Play Developer API 驗證
POST https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{packageName}/purchases/products/{productId}/tokens/{token}
```

## 📝 實作範例

### 更新 ShopScreen 使用內購

```typescript
import { useIAP } from '../hook/useIAP';
import { PRODUCT_IDS } from '../services/iapService';

export default function ShopScreen() {
  const { products, isLoading, isPurchasing, purchaseProduct } = useIAP();

  const handlePressPack = async (pack: PackItem) => {
    // 將 pack.id 映射到 PRODUCT_IDS
    const productIdMap: Record<string, string> = {
      'p1': PRODUCT_IDS.PACK_1, // item_001
      'p2': PRODUCT_IDS.PACK_2, // item_002
      'p3': PRODUCT_IDS.PACK_3, // item_003
      'p4': PRODUCT_IDS.PACK_4, // item_004
      'p5': PRODUCT_IDS.PACK_5, // item_005
      'p6': PRODUCT_IDS.PACK_6, // item_006
    };

    const productId = productIdMap[pack.id];
    if (productId) {
      await purchaseProduct(productId as any);
    }
  };

  // ...
}
```

## ⚠️ 注意事項

1. **商品 ID 必須一致**：iOS 和 Android 的商品 ID 必須與 `PRODUCT_IDS` 中定義的完全一致
2. **測試環境**：iOS 需要使用沙盒測試帳號，Android 需要使用測試帳號
3. **實體設備**：iOS 內購必須在實體設備上測試，模擬器不支援
4. **收據驗證**：建議在後端驗證收據，確保購買的真實性
5. **錯誤處理**：妥善處理購買失敗、取消等情況

## 🐛 常見問題

### iOS

- **無法載入商品**：檢查商品 ID 是否正確，商品是否已審核通過
- **購買失敗**：確認使用沙盒測試帳號，且設備已登出正式 App Store 帳號

### Android

- **無法載入商品**：確認 APK/AAB 已上傳且使用正確的簽名
- **購買失敗**：確認測試帳號已加入授權測試人員清單

## 📚 參考資源

- [react-native-iap 官方文檔](https://github.com/dooboolab/react-native-iap)
- [Apple 內購指南](https://developer.apple.com/in-app-purchase/)
- [Google Play 內購指南](https://developer.android.com/google/play/billing)

