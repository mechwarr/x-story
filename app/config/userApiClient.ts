// userApiClient.ts
import { RestfulApi } from "./api";
import { portURL, devBaseUrl } from "./apiClient";
import tokenStorage from "../auth/Storage";

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

//=======================================================
//============== 用戶資料相關 API ==============
//=======================================================

/**
 * 獲取當前用戶資料 Response
 */
export interface UserProfile {
  id?: number;
  name?: string;
  email?: string;
  birthday?: string; // ISO 8601 格式日期字串
  gender?: 'female' | 'male' | 'other';
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
  gender?: 'female' | 'male' | 'other';
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
export interface UpdateUserProfileRequest {
  name?: string;
  birthday?: string; // ISO 8601 格式日期字串
  gender?: 'female' | 'male' | 'other';
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

