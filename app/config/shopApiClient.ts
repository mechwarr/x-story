// shopApiClient.ts
import { RestfulApi } from "./api";
import { portURL, devBaseUrl } from "./apiClient";

// 創建使用 portURL 的 API 實例（用於商城相關 API）
const shopApi = new RestfulApi({
  devBaseUrl,
  prodBaseUrl: portURL,
  isDev: __DEV__,
});

//=======================================================
//============== 商城相關 API ==============
//=======================================================

/**
 * 金幣包資訊（從後端 API 獲取）
 */
export interface CoinPack {
  id: number;
  name: string;
  price: number;
  platform: "GOOGLE" | "APPLE";
  productId: string; // IAP 商品 ID（用於 Google Play / App Store）
}

/**
 * 獲取金幣包列表 Response
 */
export interface GetCoinPacksResponse {
  success: boolean;
  data: CoinPack[];
}

/**
 * 獲取金幣包列表
 * @returns Promise<CoinPack[]> 金幣包列表
 */
export async function getCoinPacks(): Promise<CoinPack[]> {
  const endpoint = "api/coin-packs";
  const baseUrl = shopApi.currentBaseUrl();
  const fullUrl = baseUrl + endpoint;
  
  console.log("[shopApiClient] ========== 開始請求金幣包列表 ==========");
  console.log("[shopApiClient] 基礎 URL:", baseUrl);
  console.log("[shopApiClient] Endpoint:", endpoint);
  console.log("[shopApiClient] 完整 URL:", fullUrl);
  
  try {
    const res = await shopApi.get<GetCoinPacksResponse>(endpoint);
    console.log("[shopApiClient] API 響應:", JSON.stringify(res, null, 2));

    if (res && res.success) {
      const packs = res.data || [];
      console.log("[shopApiClient] ✓ 成功獲取金幣包列表，數量:", packs.length);
      console.log("[shopApiClient] 金幣包資料:", JSON.stringify(packs, null, 2));
      return packs;
    } else {
      console.warn("[shopApiClient] ✗ 獲取金幣包列表失敗，響應:", res);
      return [];
    }
  } catch (error) {
    console.error("[shopApiClient] ========== 獲取金幣包列表時發生錯誤 ==========");
    console.error("[shopApiClient] 錯誤類型:", error?.constructor?.name || typeof error);
    console.error("[shopApiClient] 完整 URL:", fullUrl);
    
    if (error instanceof Error) {
      console.error("[shopApiClient] 錯誤訊息:", error.message);
      console.error("[shopApiClient] 錯誤堆疊:", error.stack);
      
      // 分析錯誤類型
      if (error.message.includes("Network request failed")) {
        console.error("[shopApiClient] ========== 網絡錯誤診斷 ==========");
        console.error("[shopApiClient] 錯誤類型: Network request failed");
        console.error("[shopApiClient]");
        console.error("[shopApiClient] 可能的原因：");
        console.error("[shopApiClient] 1. ❌ API 服務器無法訪問");
        console.error("[shopApiClient]    → 請確認服務器是否運行: " + fullUrl);
        console.error("[shopApiClient]    → 可以在瀏覽器中測試訪問該 URL");
        console.error("[shopApiClient]");
        console.error("[shopApiClient] 2. ❌ 域名解析失敗");
        console.error("[shopApiClient]    → 域名可能無法解析: " + baseUrl);
        console.error("[shopApiClient]    → 請確認域名是否正確");
        console.error("[shopApiClient]");
        console.error("[shopApiClient] 3. ❌ 網絡連接問題");
        console.error("[shopApiClient]    → 設備可能沒有網絡連接");
        console.error("[shopApiClient]    → 請檢查 Wi-Fi 或行動網絡");
        console.error("[shopApiClient]");
        console.error("[shopApiClient] 4. ❌ 模擬器網絡問題");
        console.error("[shopApiClient]    → 如果使用模擬器，可能需要特殊網絡配置");
        console.error("[shopApiClient]    → 建議在真實設備上測試");
        console.error("[shopApiClient]");
        console.error("[shopApiClient] 5. ❌ Android 網絡安全配置");
        console.error("[shopApiClient]    → 雖然已設置 usesCleartextTraffic=true");
        console.error("[shopApiClient]    → 但某些 Android 版本可能仍有問題");
        console.error("[shopApiClient]");
        console.error("[shopApiClient] 6. ❌ 防火牆或代理阻擋");
        console.error("[shopApiClient]    → 公司網絡或防火牆可能阻擋請求");
        console.error("[shopApiClient]    → 請嘗試使用不同的網絡");
        console.error("[shopApiClient] ========================================");
      } else if (error.message.includes("timeout") || error.message.includes("TIMEOUT")) {
        console.error("[shopApiClient] 錯誤類型: 請求超時");
        console.error("[shopApiClient] → 服務器響應時間過長");
        console.error("[shopApiClient] → 可能是服務器負載過高或網絡延遲");
      } else if (error.message.includes("Failed to fetch")) {
        console.error("[shopApiClient] 錯誤類型: 獲取失敗");
        console.error("[shopApiClient] → 無法建立連接");
        console.error("[shopApiClient] → 請檢查服務器狀態和網絡連接");
      }
    } else {
      console.error("[shopApiClient] 錯誤物件:", JSON.stringify(error, null, 2));
    }
    
    return [];
  }
}

/**
 * 商品資訊
 */
export interface ProductInfo {
  id: string;
  title: string;
  coins: number;
  bonus: number;
  price: number;
  currency: string;
  description?: string;
  imageUrl?: string;
}

/**
 * 獲取商品列表 Request
 */
export interface GetProductsRequest {
  // 可選：篩選條件
  category?: string;
  isActive?: boolean;
}

/**
 * 獲取商品列表 Response
 */
export interface GetProductsResponse {
  success: boolean;
  message: string;
  products: ProductInfo[];
}

/**
 * 獲取商品列表
 * @param payload - 可選的篩選條件
 * @returns Promise<ProductInfo[]> 商品列表
 */
export async function getProducts(
  payload?: GetProductsRequest
): Promise<ProductInfo[]> {
  try {
    let endpoint = "api/v1/shop/products";
    
    // 構建查詢參數
    if (payload) {
      const params = new URLSearchParams();
      if (payload.category) params.append("category", payload.category);
      if (payload.isActive !== undefined) params.append("isActive", String(payload.isActive));
      const queryString = params.toString();
      if (queryString) {
        endpoint += `?${queryString}`;
      }
    }

    const res = await shopApi.get<GetProductsResponse>(endpoint);

    if (res && res.success) {
      return res.products || [];
    } else {
      console.warn("獲取商品列表失敗:", res.message);
      return [];
    }
  } catch (error) {
    console.error("獲取商品列表時發生錯誤:", error);
    return [];
  }
}

//=======================================================
//============== 用戶餘額相關 API ==============
//=======================================================

/**
 * 獲取用戶餘額 Response
 */
export interface GetBalanceResponse {
  success: boolean;
  message: string;
  balance: number;
  currency?: string;
}

/**
 * 獲取用戶餘額
 * @returns Promise<number> 用戶餘額（金幣數）
 */
export async function getUserBalance(): Promise<number> {
  try {
    const res = await shopApi.get<GetBalanceResponse>("api/v1/shop/balance");

    if (res && res.success) {
      return res.balance || 0;
    } else {
      console.warn("獲取用戶餘額失敗:", res.message);
      return 0;
    }
  } catch (error) {
    console.error("獲取用戶餘額時發生錯誤:", error);
    return 0;
  }
}

//=======================================================
//============== 購買相關 API ==============
//=======================================================

/**
 * 購買商品 Request
 */
export interface PurchaseProductRequest {
  productId: string;
  platform: "ios" | "android";
  receipt?: string; // iOS 收據
  purchaseToken?: string; // Android 購買 token
  transactionId?: string;
  originalTransactionId?: string; // iOS 原始交易 ID
}

/**
 * 購買商品 Response
 */
export interface PurchaseProductResponse {
  success: boolean;
  message: string;
  transactionId?: string;
  coinsAdded?: number;
  newBalance?: number;
}

/**
 * 購買商品（驗證並完成購買）
 * @param payload - 購買資訊
 * @returns Promise<PurchaseProductResponse> 購買結果
 */
export async function purchaseProduct(
  payload: PurchaseProductRequest
): Promise<PurchaseProductResponse | null> {
  try {
    const res = await shopApi.post<PurchaseProductResponse>(
      "api/v1/shop/purchase",
      payload
    );

    if (res && res.success) {
      console.log("購買成功:", res.message);
      return res;
    } else {
      console.warn("購買失敗:", res.message);
      alert(res?.message || "購買失敗，請稍後再試");
      return null;
    }
  } catch (error) {
    alert(extractErrorMessage(error));
    console.error("購買時發生錯誤:", error);
    return null;
  }
}

/**
 * 驗證購買收據 Request
 */
export interface VerifyPurchaseRequest {
  platform: "ios" | "android";
  receipt?: string;
  purchaseToken?: string;
  transactionId?: string;
  productId: string;
}

/**
 * 驗證購買收據 Response
 */
export interface VerifyPurchaseResponse {
  success: boolean;
  message: string;
  isValid: boolean;
  transactionId?: string;
}

/**
 * 驗證購買收據
 * @param payload - 收據資訊
 * @returns Promise<boolean> 是否驗證成功
 */
export async function verifyPurchase(
  payload: VerifyPurchaseRequest
): Promise<boolean> {
  try {
    const res = await shopApi.post<VerifyPurchaseResponse>(
      "api/v1/shop/verify-purchase",
      payload
    );

    if (res && res.success && res.isValid) {
      return true;
    } else {
      console.warn("驗證購買失敗:", res.message);
      return false;
    }
  } catch (error) {
    console.error("驗證購買時發生錯誤:", error);
    return false;
  }
}

//=======================================================
//============== 購買歷史相關 API ==============
//=======================================================

/**
 * 購買記錄
 */
export interface PurchaseRecord {
  id: string;
  transactionId: string;
  productId: string;
  productName: string;
  amount: number;
  currency: string;
  coinsAdded: number;
  purchasedAt: string; // ISO 8601 格式
  platform: "ios" | "android";
  status: "completed" | "pending" | "failed" | "refunded";
}

/**
 * 獲取購買歷史 Request
 */
export interface GetPurchaseHistoryRequest {
  page?: number;
  limit?: number;
  startDate?: string; // ISO 8601 格式
  endDate?: string; // ISO 8601 格式
}

/**
 * 獲取購買歷史 Response
 */
export interface GetPurchaseHistoryResponse {
  success: boolean;
  message: string;
  purchases: PurchaseRecord[];
  total?: number;
  page?: number;
  limit?: number;
}

/**
 * 獲取購買歷史
 * @param payload - 可選的查詢條件
 * @returns Promise<PurchaseRecord[]> 購買記錄列表
 */
export async function getPurchaseHistory(
  payload?: GetPurchaseHistoryRequest
): Promise<PurchaseRecord[]> {
  try {
    let endpoint = "api/v1/shop/purchase-history";
    
    // 構建查詢參數
    if (payload) {
      const params = new URLSearchParams();
      if (payload.page) params.append("page", String(payload.page));
      if (payload.limit) params.append("limit", String(payload.limit));
      if (payload.startDate) params.append("startDate", payload.startDate);
      if (payload.endDate) params.append("endDate", payload.endDate);
      const queryString = params.toString();
      if (queryString) {
        endpoint += `?${queryString}`;
      }
    }

    const res = await shopApi.get<GetPurchaseHistoryResponse>(endpoint);

    if (res && res.success) {
      return res.purchases || [];
    } else {
      console.warn("獲取購買歷史失敗:", res.message);
      return [];
    }
  } catch (error) {
    console.error("獲取購買歷史時發生錯誤:", error);
    return [];
  }
}

//=======================================================
//============== 金幣歷史相關 API ==============
//=======================================================

/**
 * 金幣記錄類型
 */
export type CoinLogType =
  | "purchase" // 購買獲得
  | "bonus" // 獎勵獲得
  | "spent" // 消費
  | "refund" // 退款
  | "expired"; // 過期

/**
 * 金幣記錄
 */
export interface CoinLog {
  id: string;
  type: CoinLogType;
  amount: number; // 正數為增加，負數為減少
  balance: number; // 交易後的餘額
  description: string;
  createdAt: string; // ISO 8601 格式
  relatedTransactionId?: string; // 相關的交易 ID
}

/**
 * 獲取金幣歷史 Request
 */
export interface GetCoinHistoryRequest {
  page?: number;
  limit?: number;
  type?: CoinLogType;
  startDate?: string; // ISO 8601 格式
  endDate?: string; // ISO 8601 格式
}

/**
 * 獲取金幣歷史 Response
 */
export interface GetCoinHistoryResponse {
  success: boolean;
  message: string;
  logs: CoinLog[];
  total?: number;
  page?: number;
  limit?: number;
}

/**
 * 獲取金幣歷史
 * @param payload - 可選的查詢條件
 * @returns Promise<CoinLog[]> 金幣記錄列表
 */
export async function getCoinHistory(
  payload?: GetCoinHistoryRequest
): Promise<CoinLog[]> {
  try {
    let endpoint = "api/v1/shop/coin-history";
    
    // 構建查詢參數
    if (payload) {
      const params = new URLSearchParams();
      if (payload.page) params.append("page", String(payload.page));
      if (payload.limit) params.append("limit", String(payload.limit));
      if (payload.type) params.append("type", payload.type);
      if (payload.startDate) params.append("startDate", payload.startDate);
      if (payload.endDate) params.append("endDate", payload.endDate);
      const queryString = params.toString();
      if (queryString) {
        endpoint += `?${queryString}`;
      }
    }

    const res = await shopApi.get<GetCoinHistoryResponse>(endpoint);

    if (res && res.success) {
      return res.logs || [];
    } else {
      console.warn("獲取金幣歷史失敗:", res.message);
      return [];
    }
  } catch (error) {
    console.error("獲取金幣歷史時發生錯誤:", error);
    return [];
  }
}

//=======================================================
//============== 工具函數 ==============
//=======================================================

/**
 * 提取錯誤訊息
 */
function extractErrorMessage(err: unknown): string {
  // 如果是 Error 且 message 裡可能包含 JSON
  if (err instanceof Error) {
    try {
      // 嘗試從 message 中解析 JSON
      const match = err.message.match(/\{.*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed && typeof parsed.message === "string") {
          return parsed.message;
        }
      }
    } catch {
      // 忽略 JSON parse 失敗
    }
    // 否則回傳原本的簡訊息
    return err.message;
  }

  // 如果是 Response 物件或一般物件
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as any).message);
  }

  return "未知錯誤";
}

