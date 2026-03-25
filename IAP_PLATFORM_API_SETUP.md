# 內購平台 API 設置文檔

本文檔記錄內購平台（IAP）的資料庫結構和 API 設置，相關前端代碼位於 `app/services/iapService.ts`。

## 資料庫表結構

### coin_packs 表

用於儲存內購商品（金幣包）的配置資訊，支援 iOS App Store 和 Google Play Store 兩個平台。

```sql
CREATE TABLE coin_packs (
  id INT NOT NULL AUTO_INCREMENT,
  platform VARCHAR(20) NOT NULL COMMENT 'GOOGLE | APPLE',
  product_id VARCHAR(100) NOT NULL COMMENT '對應 App Store / Google Play 商品 ID',
  name VARCHAR(100) NOT NULL COMMENT '商品顯示名稱',
  amount INT NOT NULL COMMENT '基礎金幣',
  bonus_amount INT NOT NULL DEFAULT 0 COMMENT '額外贈送金幣',
  price DECIMAL(10,2) NOT NULL COMMENT '售價',
  currency VARCHAR(10) NOT NULL COMMENT '幣別，如 TWD / USD',
  is_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否上架',
  sort_order INT NOT NULL DEFAULT 0 COMMENT '控制商品顯示順序', 
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_platform_product_id (platform, product_id),
  INDEX idx_platform_active (platform, is_active),
  INDEX idx_sort_order (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='內購商品（金幣包）配置表';
```

### 欄位說明

| 欄位 | 類型 | 說明 |
|------|------|------|
| `id` | INT | 主鍵，自動遞增 |
| `platform` | VARCHAR(20) | 平台類型：`GOOGLE` 或 `APPLE` |
| `product_id` | VARCHAR(100) | 對應 App Store / Google Play 的商品 ID（如：`item_001`, `item_002` 等） |
| `name` | VARCHAR(100) | 商品顯示名稱（如：入門基本包、熱門推薦包等） |
| `amount` | INT | 基礎金幣數量 |
| `bonus_amount` | INT | 額外贈送的金幣數量（預設為 0） |
| `price` | DECIMAL(10,2) | 商品售價 |
| `currency` | VARCHAR(10) | 幣別（如：TWD、USD） |
| `is_active` | TINYINT(1) | 是否上架（1=上架，0=下架） |
| `sort_order` | INT | 商品顯示順序（數字越小越靠前） |
| `created_at` | DATETIME | 建立時間 |
| `updated_at` | DATETIME | 更新時間 |

### 索引說明

- **主鍵索引**：`id`
- **唯一索引**：`uk_platform_product_id` - 確保同一平台下商品 ID 不重複
- **普通索引**：`idx_platform_active` - 用於查詢特定平台的上架商品
- **普通索引**：`idx_sort_order` - 用於排序查詢

## 前端代碼對應

### 商品 ID 配置

在 `app/services/iapService.ts` 中定義的商品 ID：

```typescript
export const PRODUCT_IDS = {
  PACK_1: 'item_01', // 入門基本包
  PACK_2: 'item_02', // 熱門推薦包
  PACK_3: 'item_03', // 高效閱讀包
  PACK_4: 'item_04', // 文青超值包
  PACK_5: 'item_05', // VIP獨享包
  PACK_6: 'item_06', // 尊爵贊助包
} as const;
```

### 商品金幣映射

```typescript
export const PRODUCT_MAP: Record<string, { coins: number; bonus: number }> = {
  [PRODUCT_IDS.PACK_1]: { coins: 90, bonus: 5 },
  [PRODUCT_IDS.PACK_2]: { coins: 150, bonus: 20 },
  [PRODUCT_IDS.PACK_3]: { coins: 300, bonus: 55 },
  [PRODUCT_IDS.PACK_4]: { coins: 590, bonus: 120 },
  [PRODUCT_IDS.PACK_5]: { coins: 1190, bonus: 280 },
  [PRODUCT_IDS.PACK_6]: { coins: 1790, bonus: 460 },
};
```

**注意**：前端代碼中的 `PRODUCT_MAP` 僅包含應用內邏輯需要的資訊（金幣數量和 bonus）。商品名稱和價格應從 Google Play/App Store 返回的 `Product` 物件中獲取，或從後端 API 獲取。

## API 端點

### 獲取金幣包列表

- **端點**：`GET /api/coin-packs`
- **說明**：獲取所有上架的金幣包列表
- **相關代碼**：`app/config/shopApiClient.ts` - `getCoinPacks()`

### 驗證 IAP 收據

- **端點**：`POST /api/iap/verify`
- **說明**：驗證內購收據並發放金幣
- **相關代碼**：`app/config/shopApiClient.ts` - `verifyIAPReceipt()`

#### Request 格式

```typescript
interface VerifyIAPReceiptRequest {
  platform: "GOOGLE" | "APPLE";
  receipt?: string; // iOS 收據或 Android purchaseToken
  purchaseToken?: string; // Android purchaseToken (與 receipt 二選一)
  productId?: string; // 商品 ID（可選，用於伺服器端驗證）
}
```

**範例**：
```bash
curl -X 'POST' \
  'http://20.198.216.126:3001/api/iap/verify' \
  -H 'accept: application/json' \
  -H 'Authorization: Bearer [JWT_TOKEN]' \
  -H 'Content-Type: application/json' \
  -d '{
  "platform": "GOOGLE",
  "receipt": "jmoomhnnmkjbaonbkobenefn.AO-J1Ow0Z4cYnkh2mJQ0fme4r8ke0ON701xrscm9z0q0bWbJxDYOdglU_P_oAS0rH2IcgOjovaQYQhmUwLuGou92Wk_Ng5atCA",
  "productId": "item_001"
}'
```

#### Response 格式

```typescript
interface VerifyIAPReceiptResponse {
  success: boolean;
  platform: "GOOGLE" | "APPLE";
  userId: number; // 用戶 ID（數字類型）
  coinsAdded: number;
  message: string;
  raw?: {
    success?: boolean;
    userId?: number;
    receiptId?: number;
    coinsAdded?: number;
    balance?: number;
  };
}
```

**成功回應範例**：
```json
{
  "success": true,
  "platform": "GOOGLE",
  "userId": 2,
  "coinsAdded": 95,
  "message": "Google IAP verified success",
  "raw": {
    "success": true,
    "userId": 2,
    "receiptId": 3,
    "coinsAdded": 95,
    "balance": 95
  }
}
```

### 獲取用戶收據列表

- **端點**：`GET /api/me/iap-receipts`
- **說明**：獲取當前用戶的 IAP 收據記錄
- **相關代碼**：`app/services/iapService.ts` - `getIapReceipts()`

#### Response 格式

```typescript
interface IapReceipt {
  receiptId: string;
  platform: "GOOGLE" | "APPLE";
  productId: string;
  totalCoins: number;
  baseCoins: number;
  bonusCoins: number;
  status: string;
  createdAt: string; // ISO 8601 格式
}

interface GetIapReceiptsResponse {
  items: IapReceipt[];
}
```

**回應範例**：
```json
{
  "items": [
    {
      "receiptId": "GPA.3311-8231-6720-68544",
      "platform": "GOOGLE",
      "productId": "item_001",
      "totalCoins": 95,
      "baseCoins": 90,
      "bonusCoins": 5,
      "status": "SUCCESS",
      "createdAt": "2026-01-23T16:45:13.000Z"
    }
  ]
}
```

## 平台配置要求

### iOS App Store

1. 在 **App Store Connect** 中建立應用內購買項目
2. 商品 ID 必須與資料庫中的 `product_id` 完全一致（區分大小寫）
3. **重要**：商品不能只停在「草稿」或「準備提交」— 必須**隨 App 版本一併提交審查**後，StoreKit 才會回傳商品資訊（見下方「為什麼取不到商品？」）

#### 為什麼取不到商品？— 草稿／準備提交還不夠

若後台六個產品都在 **草稿 (6)**、狀態為 **準備提交**，App 裡用 StoreKit 查詢會**拿不到任何商品**，這是 Apple 的設計：

- **僅「準備提交」不會上線**：商品必須與某個 **App 版本** 一起送出，並在該版本的「App 內購買項目和訂閱項目」區段中被勾選。
- **首次內購必須隨版本送審**：App Store Connect 說明：「首個 App 內購買項目必須以**新的 App 版本**提交。請先建立 App 內購買項目，然後從**版本頁面**的「App 內購買項目和訂閱項目」區段中選取該項目，版本提交至 App 審查。」
- **送出後才可供 App 查詢**：上傳二進位檔並提交**首個** App 內購買項目供審查後，這些項目才會對 StoreKit 可見（沙盒測試與正式皆同）。

**你要做的步驟：**

1. 在 App Store Connect 建立新 **App 版本**（例如 1.0.0 或下一版號）。
2. 在該版本的頁面找到 **「App 內購買項目和訂閱項目」** 區段。
3. 勾選要上線的內購項目（例如 item_001～item_006）。
4. **上傳對應的建置**（Archive 上傳或 Xcode 上傳）。
5. 將該版本**提交審查**（至少送審一次；審核通過後即可在沙盒／正式環境取得商品）。

完成以上後，App 內用 `item_001`～`item_006` 向平台查詢才會拿到商品資訊；產品 ID 與程式碼一致沒有錯，錯在尚未「隨版本提交」。

### Google Play Store

1. 在 **Google Play Console** 中建立應用內商品
2. 商品 ID 必須與資料庫中的 `product_id` 完全一致（區分大小寫）
3. 商品狀態必須為「已啟用」
4. 應用必須發布到測試軌道（Alpha/Beta/Internal Testing）

## 資料同步建議

建議將前端的 `PRODUCT_IDS` 和 `PRODUCT_MAP` 改為從後端 API 動態獲取，以確保：

1. **一致性**：前端和後端使用相同的商品配置
2. **靈活性**：可以動態調整商品價格、金幣數量等，無需更新應用
3. **維護性**：只需在資料庫中維護一份商品配置

## 最新修改 (2026-01-23)

### 1. API 介面更新
- 修正 `VerifyIAPReceiptRequest` 介面，添加 `productId` 欄位
- 修正 `VerifyIAPReceiptResponse` 介面：
  - `userId` 類型從 `string` 改為 `number`
  - 更新 `raw` 物件結構以符合實際 API 回應

### 2. 收據驗證流程改進
- `validateReceiptWithBackend()` 函數現在會傳送 `productId` 給後端 API
- 優化商品名稱獲取邏輯，優先使用中文名稱映射 `PRODUCT_NAMES`
- 增強日誌輸出，便於調試

### 3. 購買記錄功能完善
- 實現真實的收據列表顯示（`PurchaseHistoryScreen.tsx`）
- 添加載入狀態、錯誤處理和空列表提示
- 自動按時間倒序排列收據

### 4. Alert 通知流程
購買成功後的通知流程：
1. 平台（Google Play/App Store）確認購買
2. 調用 `validateReceiptWithBackend()` 驗證收據
3. 後端返回成功結果：`{ success: true, coinsAdded: 95, ... }`
4. 觸發 `onPurchaseSuccess` 回調
5. 顯示成功 Alert：「您已成功購買 [商品名稱]！獲得 [金幣數量] 金幣」

## 相關文件

- `app/services/iapService.ts` - IAP 服務主要實現
- `app/config/shopApiClient.ts` - 商城相關 API 客戶端
- `app/hook/useIAP.ts` - IAP Hook 封裝
- `app/screens/PurchaseHistoryScreen.tsx` - 購買記錄畫面
