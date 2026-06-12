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

//=======================================================
//============== 後台書店 API（roleLevel >= 6 可見未上架）==============
//=======================================================

/**
 * 分頁資訊（GET api/admin/bookstores 回傳）
 */
export interface BookstorePaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * 後台書店清單 Response（GET api/admin/bookstores）
 * 與公開的 api/bookstorelist 不同：回傳物件包了 data + pagination，
 * 且包含所有狀態書籍（含已下架 isActive=false）。
 */
export interface GetAdminBookstoresResponse {
  data: BookstoreItem[];
  pagination: BookstorePaginationInfo;
  /** 是否因權限驗證失敗（HTTP 401/403）而取不到資料。用於畫面端區分「沒權限」與「真的沒書」。 */
  authError?: boolean;
}

/**
 * 判斷錯誤是否為權限/驗證失敗（HTTP 401 未授權 / 403 權限不足）。
 * RestfulApi 在非 2xx 時 throw `Error("HTTP <status>: ...")`，故以訊息比對。
 */
function isAuthError(error: any): boolean {
  const msg = error?.message ?? "";
  return msg.includes("HTTP 401") || msg.includes("HTTP 403");
}

/**
 * 取得後台書店清單（單頁，需權限 roleLevel >= 6）
 * GET api/admin/bookstores?page={page}&limit={limit}，需 Authorization: Bearer token
 * @param page 頁碼，預設 1
 * @param limit 每頁筆數，預設 20（最多 100）
 * @returns Promise<GetAdminBookstoresResponse> 失敗時回傳空清單 + 預設分頁
 */
export async function getAdminBookstores(
  page: number = 1,
  limit: number = 20
): Promise<GetAdminBookstoresResponse> {
  const emptyResult: GetAdminBookstoresResponse = {
    data: [],
    pagination: { total: 0, page, limit, totalPages: 0 },
  };
  try {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    const endpoint = `api/admin/bookstores?${params.toString()}`;

    const token = await tokenStorage.getToken();
    const headers: Record<string, string> = { accept: "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await userApi.get<GetAdminBookstoresResponse>(endpoint, headers);

    if (res && Array.isArray(res.data)) {
      console.log(
        "[userApiClient] ✓ 成功獲取後台書店清單，本頁數量:",
        res.data.length,
        "總數:",
        res.pagination?.total
      );
      return {
        data: res.data,
        pagination: res.pagination ?? { total: res.data.length, page, limit, totalPages: 1 },
      };
    }
    console.warn("[userApiClient] ✗ 獲取後台書店清單失敗，響應格式不正確:", res);
    return emptyResult;
  } catch (error) {
    if (isAuthError(error)) {
      console.warn("[userApiClient] ✗ 後台書店清單權限驗證失敗（401/403）:", (error as any)?.message);
      return { ...emptyResult, authError: true };
    }
    console.error("[userApiClient] 獲取後台書店清單時發生錯誤:", error);
    return emptyResult;
  }
}

/**
 * 取得後台書店「全部」書籍（自動翻頁聚合，需權限 roleLevel >= 6）。
 * 回傳 { items, authError }：items 為扁平陣列（與公開 getBookstoreList() 同形狀，方便沿用合併邏輯）；
 * authError 為 true 時代表權限驗證失敗（401/403），畫面端應退回公開書店清單並修正本地權限快取。
 * @param pageSize 每頁筆數，預設 100（API 上限）
 */
export async function getAllAdminBookstores(
  pageSize: number = 100
): Promise<{ items: BookstoreItem[]; authError: boolean }> {
  const first = await getAdminBookstores(1, pageSize);
  if (first.authError) {
    return { items: [], authError: true };
  }

  const all: BookstoreItem[] = [...first.data];
  const totalPages = first.pagination?.totalPages ?? 1;

  // 自動翻頁聚合剩餘頁；上限 50 頁作為防呆，避免異常分頁造成無限迴圈
  const maxPages = Math.min(totalPages, 50);
  if (totalPages > 50) {
    console.warn(
      `[userApiClient] 後台書店分頁數 ${totalPages} 超過上限 50，僅聚合前 ${maxPages} 頁`
    );
  }
  for (let page = 2; page <= maxPages; page++) {
    const next = await getAdminBookstores(page, pageSize);
    if (next.authError) break; // 中途權限失效：保留已取得的部分
    if (!next.data.length) break;
    all.push(...next.data);
  }

  console.log("[userApiClient] ✓ 後台書店清單聚合完成，總數量:", all.length);
  return { items: all, authError: false };
}

/**
 * 寫入閱讀紀錄 Response
 */
export interface RecordBookReadResponse {
  success?: boolean;
  message?: string;
  [key: string]: any;
}

/**
 * 寫入閱讀紀錄（使用者開始閱讀某本書時呼叫）
 * POST api/books/{bookId}/read，需 Authorization: Bearer token
 * @param bookId 書籍 ID（即 storyListId）
 * @returns Promise<RecordBookReadResponse | null> 寫入結果，失敗時返回 null
 */
export async function recordBookRead(
  bookId: number
): Promise<RecordBookReadResponse | null> {
  try {
    const endpoint = `api/books/${bookId}/read`;

    const token = await tokenStorage.getToken();
    const headers: Record<string, string> = {
      accept: "application/json",
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await userApi.post<RecordBookReadResponse>(endpoint, {}, headers);
    console.log("[userApiClient] ✓ 寫入閱讀紀錄成功，bookId:", bookId, res);
    return res;
  } catch (error) {
    console.error("[userApiClient] 寫入閱讀紀錄時發生錯誤，bookId:", bookId, error);
    return null;
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
  roleLevel?: number; // 權限級別（1=普通, 5=小編, 9=Admin），詳見 config/roles.ts
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
 * 取得目前用戶的有效權限級別（roleLevel）。
 * 優先讀本地快取，避免每次都打 api/users/me；快取為 null（例如此功能上線前已登入者）時，
 * 回退查詢一次 api/users/me 並補寫快取。未登入或查詢失敗一律回傳 0。
 * 角色判斷請搭配 config/roles.ts 的 isAdmin / canViewUnlisted 使用。
 */
export async function getEffectiveRoleLevel(): Promise<number> {
  try {
    const token = await tokenStorage.getToken();
    if (!token) return 0;

    let roleLevel = await tokenStorage.getUserRoleLevel();
    if (roleLevel === null) {
      const profile = await getUserProfile();
      roleLevel = Number(profile?.roleLevel) || 0;
      await tokenStorage.setUserRoleLevel(roleLevel);
    }
    return Number(roleLevel) || 0;
  } catch (error) {
    console.warn("[userApiClient] 取得有效權限級別失敗，預設為一般用戶(0):", (error as any)?.message);
    return 0;
  }
}

/**
 * 重新向後端查詢真實 roleLevel 並覆寫本地快取，回傳更新後的級別。
 * 用於後台 API 回傳 401/403 時修正「本地快取權限高於後端實際」的情況
 *（token 過期或角色被降級）。查詢失敗時將快取歸零。
 */
export async function refreshRoleLevelCache(): Promise<number> {
  try {
    const profile = await getUserProfile();
    const level = Number(profile?.roleLevel) || 0;
    await tokenStorage.setUserRoleLevel(level);
    return level;
  } catch (error) {
    console.warn("[userApiClient] 重新查詢權限失敗，快取歸零:", (error as any)?.message);
    await tokenStorage.setUserRoleLevel(0);
    return 0;
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

/** 領取活動獎勵（例如個人資料完成任務） */
export interface ClaimActivityRewardRequest {
  activityName: string;
}

export interface ClaimActivityRewardResponse {
  success?: boolean;
  message?: string;
  data?: unknown;
}

/**
 * POST api/activities/claim-reward
 * 需 Authorization: Bearer token；body 帶 activityName（例如 PROFILE_COMPLETED）
 */
export async function claimActivityReward(
  payload: ClaimActivityRewardRequest
): Promise<ClaimActivityRewardResponse> {
  try {
    const endpoint = "api/activities/claim-reward";
    const token = await tokenStorage.getToken();
    const headers: Record<string, string> = { accept: "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await userApi.post<ClaimActivityRewardResponse>(endpoint, payload, headers);
    console.log("[userApiClient] ✓ 領取活動獎勵:", res);
    return res;
  } catch (error) {
    console.error("[userApiClient] 領取活動獎勵時發生錯誤:", error);
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

