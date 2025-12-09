# 內購功能實作總結

## ✅ 已完成的工作

### 1. 內購服務層 (`app/services/iapService.ts`)
- 封裝了 `react-native-iap` 的所有核心功能
- 支援 iOS 和 Android 雙平台
- 包含商品管理、購買流程、收據驗證等功能
- 定義了商品 ID 映射 (`PRODUCT_IDS`)

### 2. 內購 Hook (`app/hook/useIAP.ts`)
- 提供簡潔的 React Hook 介面
- 自動處理初始化、商品載入、購買流程
- 包含錯誤處理和使用者提示
- 支援恢復購買功能

### 3. 商城頁面整合 (`app/screens/ShopScreen.tsx`)
- 整合了內購功能
- 自動載入商店商品資訊
- 顯示載入狀態
- 處理購買流程

### 4. 商品卡片組件更新 (`app/components/Purchase/PackCard.tsx`)
- 支援禁用狀態（購買進行中時禁用）
- 保持原有的 UI 設計

### 5. 設定指南 (`IAP_SETUP_GUIDE.md`)
- 完整的 iOS 和 Android 設定步驟
- 測試指南
- 常見問題解答

## 📋 下一步需要做的事情

### 1. 在 App Store Connect 設定商品（iOS）

1. 登入 [App Store Connect](https://appstoreconnect.apple.com/)
2. 選擇您的 App (`com.rueiyang.story`)
3. 進入「功能」→「App 內購買項目」
4. 為每個商品包建立商品（商品 ID 必須完全一致）：
   - `item_001` - 入門基本包
   - `item_002` - 熱門推薦包
   - `item_003` - 高效閱讀包
   - `item_004` - 文青超值包
   - `item_005` - VIP獨享包
   - `item_006` - 尊爵贊助包
5. 選擇「消耗性商品」類型
6. 設定價格和本地化資訊
7. 建立沙盒測試帳號

### 2. 在 Google Play Console 設定商品（Android）

1. 登入 [Google Play Console](https://play.google.com/console/)
2. 選擇您的 App (`com.rueiyang.story`)
3. 進入「營利」→「產品」→「應用程式內產品」
4. 為每個商品包建立產品（產品 ID 必須完全一致）：
   - `item_001` - 入門基本包
   - `item_002` - 熱門推薦包
   - `item_003` - 高效閱讀包
   - `item_004` - 文青超值包
   - `item_005` - VIP獨享包
   - `item_006` - 尊爵贊助包
5. 設定價格和描述
6. 將測試帳號加入「授權測試人員」清單

### 3. 後端 API 整合（建議）

雖然前端已經可以處理購買，但為了安全性，建議在後端驗證收據：

```typescript
// 在 app/services/iapService.ts 的 onPurchaseSuccess 中
iapService.onPurchaseSuccess = async (purchase: Purchase) => {
  // 調用後端 API 驗證收據
  try {
    const response = await fetch('YOUR_BACKEND_API/verify-purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: Platform.OS,
        receipt: purchase.transactionReceipt,
        productId: purchase.productId,
        transactionId: purchase.transactionId,
      }),
    });
    
    if (response.ok) {
      // 後端驗證成功，更新用戶餘額
      // await updateUserBalance(purchase);
    }
  } catch (error) {
    console.error('後端驗證失敗:', error);
  }
};
```

### 4. 測試

#### iOS 測試步驟：
1. 在實體設備上運行 App（模擬器不支援內購）
2. 登出 App Store 帳號
3. 在 App 中觸發購買
4. 使用沙盒測試帳號登入
5. 完成測試購買

#### Android 測試步驟：
1. 確保已上傳簽名的 APK/AAB
2. 使用測試帳號登入 Google Play
3. 在 App 中觸發購買
4. 完成測試購買

### 5. 恢復購買功能

可以在設定頁面或個人資料頁面添加「恢復購買」按鈕：

```typescript
import { useIAP } from '../hook/useIAP';

function ProfileScreen() {
  const { restorePurchases } = useIAP();
  
  return (
    <Button onPress={restorePurchases} title="恢復購買" />
  );
}
```

## 🔍 檢查清單

- [ ] iOS 商品已在 App Store Connect 建立
- [ ] Android 商品已在 Google Play Console 建立
- [ ] 商品 ID 與程式碼中的 `PRODUCT_IDS` 完全一致
- [ ] iOS 沙盒測試帳號已建立
- [ ] Android 測試帳號已加入授權測試人員
- [ ] 後端 API 已準備好驗證收據（可選但建議）
- [ ] 已測試 iOS 購買流程
- [ ] 已測試 Android 購買流程
- [ ] 已測試恢復購買功能
- [ ] 錯誤處理已測試（取消購買、網路錯誤等）

## 📝 注意事項

1. **商品 ID 必須完全一致**：iOS 和 Android 的商品 ID 必須與 `PRODUCT_IDS` 中定義的完全一致
2. **測試環境**：開發階段需要使用測試帳號，正式環境會自動切換
3. **收據驗證**：雖然前端可以驗證，但後端驗證更安全可靠
4. **錯誤處理**：已實作基本的錯誤處理，可根據需求擴展
5. **用戶體驗**：購買過程中會顯示載入狀態，購買成功/失敗會有提示

## 🐛 疑難排解

如果遇到問題，請檢查：
1. 商品 ID 是否正確
2. 商品是否已在商店中建立並啟用
3. 測試帳號是否正確設定
4. 網路連線是否正常
5. 查看控制台日誌以獲取詳細錯誤訊息

## 📚 相關檔案

- `app/services/iapService.ts` - 內購服務核心邏輯
- `app/hook/useIAP.ts` - React Hook 封裝
- `app/screens/ShopScreen.tsx` - 商城頁面
- `app/components/Purchase/PackCard.tsx` - 商品卡片組件
- `IAP_SETUP_GUIDE.md` - 詳細設定指南

