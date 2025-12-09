// shopApiClient.ts
import api from "./apiClient";

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
  console.log("[shopApiClient] 開始請求金幣包列表，endpoint:", endpoint);
  
  try {
    const res = await api.get<GetCoinPacksResponse>(endpoint);
    console.log("[shopApiClient] API 響應:", JSON.stringify(res, null, 2));

    if (res && res.success) {
      const packs = res.data || [];
      console.log("[shopApiClient] 成功獲取金幣包列表，數量:", packs.length);
      console.log("[shopApiClient] 金幣包資料:", JSON.stringify(packs, null, 2));
      return packs;
    } else {
      console.warn("[shopApiClient] 獲取金幣包列表失敗，響應:", res);
      return [];
    }
  } catch (error) {
    console.error("[shopApiClient] 獲取金幣包列表時發生錯誤:", error);
    if (error instanceof Error) {
      console.error("[shopApiClient] 錯誤訊息:", error.message);
      console.error("[shopApiClient] 錯誤堆疊:", error.stack);
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

    const res = await api.get<GetProductsResponse>(endpoint);

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
    const res = await api.get<GetBalanceResponse>("api/v1/shop/balance");

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
    const res = await api.post<PurchaseProductResponse>(
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
    const res = await api.post<VerifyPurchaseResponse>(
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

    const res = await api.get<GetPurchaseHistoryResponse>(endpoint);

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

    const res = await api.get<GetCoinHistoryResponse>(endpoint);

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
    } catch (_) {
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

