// userApiClient.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RestfulApi } from "./api";
import { portURL, devBaseUrl } from "./apiClient";
import tokenStorage from "../auth/Storage";

const ENTITLEMENTS_CACHE_KEY = 'entitlements_cache';
const ENTITLEMENTS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 分鐘

// 創建使用 portURL 的 API 實例（用於用戶相關 API）
const userApi = new RestfulApi({
  devBaseUrl,
  prodBaseUrl: portURL,
  isDev: __DEV__,
});

//=======================================================
//============== 書籍相關 API ==============
//=======================================================

/**
 * 故事資訊
 */
export interface Story {
  id: number;
  main_menu_name: string;
  author: string;
  main_menu_image: string;
}

/**
 * 書店項目
 */
export interface BookstoreItem {
  id: number;
  storyListId: number;
  priceCoins: number;
  currency: string;
  isActive: boolean;
  soldCount: number;
  createdAt: string; // ISO 8601 格式
  updatedAt: string; // ISO 8601 格式
  story: Story;
}

/**
 * 獲取書店列表 Response
 */
export type GetBookstoreListResponse = BookstoreItem[];

/**
 * 獲取書店列表
 * @returns Promise<BookstoreItem[]> 書店列表
 */
export async function getBookstoreList(): Promise<BookstoreItem[]> {
  try {
    const endpoint = "api/bookstorelist";
    const res = await userApi.get<GetBookstoreListResponse>(endpoint);

    if (Array.isArray(res)) {
      console.log("[userApiClient] ✓ 成功獲取書店列表，數量:", res.length);
      return res;
    } else {
      console.warn("[userApiClient] ✗ 獲取書店列表失敗，響應格式不正確:", res);
      return [];
    }
  } catch (error) {
    console.error("[userApiClient] 獲取書店列表時發生錯誤:", error);
    return [];
  }
}

/**
 * 我的已購買書籍項目（GET api/me/entitlements 單筆）
 */
export interface BookEntitlementItem {
  storyListId: number;
  createdAt: string; // ISO 8601 格式，購買時間
  story: Story;
}

/**
 * 獲取我的已購買書籍 Response（GET api/me/entitlements）
 */
export interface GetEntitlementsResponse {
  items: BookEntitlementItem[];
  total: number;
  page: number;
  limit: number;
}

interface GetEntitlementsOptions {
  bypassCache?: boolean;
}

/**
 * 獲取我的已購買書籍（含快取，快取 TTL 5 分鐘）
 * @param page - 頁碼，預設 1
 * @param limit - 每頁筆數，預設 20
 * @returns Promise<GetEntitlementsResponse>
 */
export async function getEntitlements(
  page: number = 1,
  limit: number = 20,
  options: GetEntitlementsOptions = {}
): Promise<GetEntitlementsResponse> {
  const cacheKey = `${ENTITLEMENTS_CACHE_KEY}_${page}_${limit}`;
  const { bypassCache = false } = options;

  const tryCache = async (): Promise<GetEntitlementsResponse | null> => {
    try {
      const raw = await AsyncStorage.getItem(cacheKey);
      if (!raw) return null;
      const { data, fetchedAt } = JSON.parse(raw);
      if (Date.now() - fetchedAt > ENTITLEMENTS_CACHE_TTL_MS) return null;
      return data;
    } catch {
      return null;
    }
  };

  if (!bypassCache) {
    const cached = await tryCache();
    if (cached) {
      console.log("[userApiClient] ✓ 使用已快取的 entitlements");
      return cached;
    }
  }

  try {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    const endpoint = `api/me/entitlements?${params.toString()}`;

    const token = await tokenStorage.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await userApi.get<GetEntitlementsResponse>(endpoint, headers);

    if (res && Array.isArray(res.items)) {
      const data: GetEntitlementsResponse = {
        items: res.items,
        total: res.total ?? res.items.length,
        page: res.page ?? page,
        limit: res.limit ?? limit,
      };
      try {
        await AsyncStorage.setItem(cacheKey, JSON.stringify({ data, fetchedAt: Date.now() }));
      } catch (e) {
        // 快取寫入失敗不影響回傳
      }
      console.log("[userApiClient] ✓ 獲取 entitlements 成功，數量:", data.items.length);
      return data;
    }
    console.warn("[userApiClient] ✗ 獲取 entitlements 失敗，響應格式不正確:", res);
    return { items: [], total: 0, page, limit };
  } catch (error) {
    console.error("[userApiClient] 獲取 entitlements 時發生錯誤:", error);
    return { items: [], total: 0, page, limit };
  }
}

export async function invalidateEntitlementsCache(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter((key) => key.startsWith(`${ENTITLEMENTS_CACHE_KEY}_`));
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }
  } catch (error) {
    console.warn("[userApiClient] 清除 entitlements 快取失敗:", error);
  }
}

export async function refreshEntitlements(
  page: number = 1,
  limit: number = 20
): Promise<GetEntitlementsResponse> {
  await invalidateEntitlementsCache();
  return getEntitlements(page, limit, { bypassCache: true });
}

//=======================================================
//============== 用戶資料相關 API ==============
//=======================================================

/**
 * 獲取當前用戶資料 Response
 */
/** 性別：0=未送出/未選，1=男，2=女 */
export type GenderCode = 0 | 1 | 2;

export interface UserProfile {
  id?: number;
  name?: string;
  email?: string;
  birthday?: string; // ISO 8601 格式日期字串
  gender?: GenderCode;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any; // 允許其他欄位
}

/**
 * 獲取當前用戶資料 Response（API 響應格式）
 */
export interface GetUserProfileResponse {
  success?: boolean;
  message?: string;
  data?: UserProfile;
  // 或者直接返回 UserProfile 格式
  id?: number;
  name?: string;
  email?: string;
  birthday?: string;
  gender?: GenderCode;
}

/**
 * 獲取當前登入使用者的個人資訊
 * @returns Promise<UserProfile | null> 用戶資料，失敗時返回 null
 */
export async function getUserProfile(): Promise<UserProfile | null> {
  try {
    const endpoint = "api/users/me";
    
    // 獲取 token 並添加到 header
    const token = await tokenStorage.getToken();
    
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const res = await userApi.get<GetUserProfileResponse>(endpoint, headers);

    console.log("[userApiClient] ✓ 成功獲取用戶資料:", res);
    
    // 處理不同的響應格式
    if (res.data) {
      return res.data;
    } else if (res.id || res.name || res.email) {
      // 如果響應直接是 UserProfile 格式
      return res as UserProfile;
    } else {
      console.warn("[userApiClient] ✗ 獲取用戶資料失敗，響應格式不正確:", res);
      return null;
    }
  } catch (error) {
    console.error("[userApiClient] 獲取用戶資料時發生錯誤:", error);
    return null;
  }
}

/**
 * 更新用戶資料 Request
 */
/** 更新資料時性別：0=未送出/未選，1=男，2=女 */
export interface UpdateUserProfileRequest {
  name?: string;
  birthday?: string; // ISO 8601 格式日期字串
  gender?: GenderCode;
}

/**
 * 更新用戶資料 Response
 */
export interface UpdateUserProfileResponse {
  success?: boolean;
  message?: string;
  data?: any;
}

/**
 * 更新當前登入使用者的個人資訊
 * @param payload 要更新的資料（例如使用者名稱）
 * @returns Promise<UpdateUserProfileResponse> 更新結果
 */
export async function updateUserProfile(
  payload: UpdateUserProfileRequest
): Promise<UpdateUserProfileResponse> {
  try {
    const endpoint = "api/users/me";
    
    // 獲取 token 並添加到 header
    const token = await tokenStorage.getToken();
    
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const res = await userApi.patch<UpdateUserProfileResponse>(endpoint, payload, headers);

    console.log("[userApiClient] ✓ 成功更新用戶資料:", res);
    return res;
  } catch (error) {
    console.error("[userApiClient] 更新用戶資料時發生錯誤:", error);
    throw error;
  }
}

/**
 * 刪除帳號 Response（API 成功格式）
 */
export interface DeleteUserAccountResponse {
  success: true;
  message: string;
  deletedUserId: number;
}

/**
 * 刪除當前登入帳號（清除帳號及關聯資料）
 * 需帶 Authorization: Bearer token
 * @returns 成功時回傳 DeleteUserAccountResponse，失敗回傳 { success: false, message }
 */
export async function deleteUserAccount(): Promise<DeleteUserAccountResponse | { success: false; message: string }> {
  try {
    const endpoint = "api/users/me";
    const token = await tokenStorage.getToken();
    const headers: Record<string, string> = { accept: "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await userApi.delete<DeleteUserAccountResponse & { error?: string; statusCode?: number }>(endpoint, headers);

    if (res && (res as DeleteUserAccountResponse).success === true) {
      console.log("[userApiClient] ✓ 刪除帳號成功:", res);
      return res as DeleteUserAccountResponse;
    }
    return { success: false, message: (res as any)?.message || "刪除帳號失敗" };
  } catch (error: any) {
    const message = error?.message || (error?.response ? String(error.response) : "刪除帳號失敗");
    console.error("[userApiClient] 刪除帳號時發生錯誤:", error);
    return { success: false, message };
  }
}

//=======================================================
//============== 金幣相關 API ==============
//=======================================================

/**
 * 獲取用戶金幣餘額 Response
 */
export interface GetUserCoinBalanceResponse {
  balance: number;
}

/**
 * 獲取當前登入使用者的金幣餘額
 * @returns Promise<number> 用戶金幣餘額，失敗時返回 0
 */
export async function getUserCoinBalance(): Promise<number> {
  try {
    const endpoint = "api/me/coins/balance";
    
    // 獲取 token 並添加到 header
    const token = await tokenStorage.getToken();
    
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const res = await userApi.get<GetUserCoinBalanceResponse>(endpoint, headers);

    console.log("[userApiClient] ✓ 成功獲取用戶金幣餘額:", res);
    
    if (res && typeof res.balance === 'number') {
      return res.balance;
    } else {
      console.warn("[userApiClient] ✗ 獲取用戶金幣餘額失敗，響應格式不正確:", res);
      return 0;
    }
  } catch (error) {
    console.error("[userApiClient] 獲取用戶金幣餘額時發生錯誤:", error);
    return 0;
  }
}

/**
 * 金幣帳本單筆紀錄（api/me/coins/ledger 回傳格式）
 */
export interface CoinLedgerItem {
  id: number;
  amount: number;
  balance: number;
  type: string;
  source: string;
  createdAt: string;
}

/**
 * 獲取金幣帳本 Response
 */
export interface GetCoinLedgerResponse {
  items: CoinLedgerItem[];
}

/**
 * 獲取金幣帳本（歷史紀錄）
 * @returns Promise<CoinLedgerItem[]> 金幣紀錄列表，失敗時返回 []
 */
export async function getCoinLedger(): Promise<CoinLedgerItem[]> {
  try {
    const endpoint = "api/me/coins/ledger";

    const token = await tokenStorage.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await userApi.get<GetCoinLedgerResponse>(endpoint, headers);

    if (res && Array.isArray(res.items)) {
      return res.items;
    }
    console.warn("[userApiClient] ✗ 獲取金幣帳本失敗，響應格式不正確:", res);
    return [];
  } catch (error) {
    console.error("[userApiClient] 獲取金幣帳本時發生錯誤:", error);
    return [];
  }
}

//=======================================================
//============== 訂單相關 API ==============
//=======================================================

/**
 * 使用金幣購買故事 Request
 */
export interface PurchaseStoryWithCoinsRequest {
  storyListId: number;
  idempotencyKey: string; // 用於防止重複購買的唯一鍵
}

/**
 * 使用金幣購買故事 Response
 */
export interface PurchaseStoryWithCoinsResponse {
  success?: boolean;
  message?: string;
  orderId?: number;
  storyListId?: number;
  coinsSpent?: number;
  balance?: number; // 購買後的金幣餘額
  [key: string]: any; // 允許其他欄位
}

/**
 * 使用金幣購買故事
 * @param payload - 購買資訊（包含 storyListId 和 idempotencyKey）
 * @returns Promise<PurchaseStoryWithCoinsResponse | null> 購買結果
 */
export async function purchaseStoryWithCoins(
  payload: PurchaseStoryWithCoinsRequest
): Promise<PurchaseStoryWithCoinsResponse | null> {
  try {
    const endpoint = "api/orders/coin-purchase";
    
    // 獲取 token 並添加到 header
    const token = await tokenStorage.getToken();
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    console.log("[userApiClient] ========== 開始使用金幣購買故事 ==========");
    console.log("[userApiClient] 請求資料:", JSON.stringify(payload, null, 2));
    
    const res = await userApi.post<PurchaseStoryWithCoinsResponse>(endpoint, payload, headers);

    console.log("[userApiClient] ✓ API 響應:", JSON.stringify(res, null, 2));
    
    if (res) {
      console.log("[userApiClient] ✓ 購買成功");
      if (res.coinsSpent !== undefined) {
        console.log("[userApiClient]   花費金幣:", res.coinsSpent);
      }
      if (res.balance !== undefined) {
        console.log("[userApiClient]   剩餘金幣:", res.balance);
      }
      return res;
    } else {
      console.warn("[userApiClient] ✗ 購買失敗，響應為空");
      return null;
    }
  } catch (error) {
    console.error("[userApiClient] ========== 使用金幣購買故事時發生錯誤 ==========");
    console.error("[userApiClient] 錯誤:", error);
    if (error instanceof Error) {
      console.error("[userApiClient] 錯誤訊息:", error.message);
      console.error("[userApiClient] 錯誤堆疊:", error.stack);
    }
    console.error("[userApiClient] ============================================");
    return null;
  }
}

