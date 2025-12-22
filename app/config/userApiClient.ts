// userApiClient.ts
import { RestfulApi } from "./api";
import { portURL, devBaseUrl } from "./apiClient";

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

// TODO: 待實作用戶更新資料相關 API

//=======================================================
//============== 金幣相關 API ==============
//=======================================================

// TODO: 待實作金幣相關 API

