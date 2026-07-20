// utils/Storage.ts
import * as SecureStore from "expo-secure-store";
import { resetSessionExpiredLatch } from "../config/sessionAuth";

// Token Keys
const TOKEN_KEY = "authToken";           // accessToken
const REFRESH_TOKEN_KEY = "refreshToken"; // refreshToken
const LOGIN_TIME_KEY = "loginTime";       // 登入時間戳記
const LAST_REFRESH_TIME_KEY = "lastRefreshTime"; // 上次刷新時間戳記

// User Profile
const EMAIL_KEY = "userEmail";
const COIN_KEY = "userCoin";
const LANG_KEY = "userLangCode";
const LANG_MANUAL_KEY = "userLangManual"; // "1" 表示使用者曾於設定中手動切換語系
const ROLE_LEVEL_KEY = "userRoleLevel"; // 權限級別 (1:普通, 5:小編, 9:Admin)
const AUTO_PLAY_SECONDS_KEY = "autoPlaySeconds"; // 劇情自動播放每段間隔秒數

// 自動播放間隔：預設 3 秒，範圍 1~10 秒（只保留最快的 10 檔）
export const DEFAULT_AUTO_PLAY_SECONDS = 3;
export const MIN_AUTO_PLAY_SECONDS = 1;
export const MAX_AUTO_PLAY_SECONDS = 10;

// ----------- ACCESS TOKEN FUNCTIONS ----------- //
const setStoreToken = async (token: string) => {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch (e) {
    console.error("storeToken error", e);
  }
};

const getToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch (e) {
    console.error("getToken error", e);
    return null;
  }
};

const removeToken = async () => {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch (e) {
    console.error("removeToken error", e);
  }
};

// ----------- REFRESH TOKEN FUNCTIONS ----------- //
const setRefreshToken = async (token: string) => {
  try {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  } catch (e) {
    console.error("setRefreshToken error", e);
  }
};

const getRefreshToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch (e) {
    console.error("getRefreshToken error", e);
    return null;
  }
};

const removeRefreshToken = async () => {
  try {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  } catch (e) {
    console.error("removeRefreshToken error", e);
  }
};

// ----------- LOGIN TIME FUNCTIONS ----------- //
const setLoginTime = async (timestamp?: number) => {
  try {
    const time = timestamp || Date.now();
    await SecureStore.setItemAsync(LOGIN_TIME_KEY, time.toString());
    console.log("[Storage] 登入時間已記錄:", new Date(time).toISOString());
  } catch (e) {
    console.error("setLoginTime error", e);
  }
};

const getLoginTime = async (): Promise<number | null> => {
  try {
    const value = await SecureStore.getItemAsync(LOGIN_TIME_KEY);
    return value ? parseInt(value, 10) : null;
  } catch (e) {
    console.error("getLoginTime error", e);
    return null;
  }
};

const removeLoginTime = async () => {
  try {
    await SecureStore.deleteItemAsync(LOGIN_TIME_KEY);
  } catch (e) {
    console.error("removeLoginTime error", e);
  }
};

// ----------- LAST REFRESH TIME FUNCTIONS ----------- //
const setLastRefreshTime = async (timestamp?: number) => {
  try {
    const time = timestamp || Date.now();
    await SecureStore.setItemAsync(LAST_REFRESH_TIME_KEY, time.toString());
    console.log("[Storage] 上次刷新時間已記錄:", new Date(time).toISOString());
  } catch (e) {
    console.error("setLastRefreshTime error", e);
  }
};

const getLastRefreshTime = async (): Promise<number | null> => {
  try {
    const value = await SecureStore.getItemAsync(LAST_REFRESH_TIME_KEY);
    return value ? parseInt(value, 10) : null;
  } catch (e) {
    console.error("getLastRefreshTime error", e);
    return null;
  }
};

const removeLastRefreshTime = async () => {
  try {
    await SecureStore.deleteItemAsync(LAST_REFRESH_TIME_KEY);
  } catch (e) {
    console.error("removeLastRefreshTime error", e);
  }
};

/**
 * 檢查是否需要刷新 Token（距離上次刷新超過指定小時數）
 * @param minHours - 最小間隔小時數，預設 1 小時
 * @returns true 表示需要刷新
 */
const shouldRefreshToken = async (minHours: number = 1): Promise<boolean> => {
  try {
    const lastRefreshTime = await getLastRefreshTime();
    
    if (!lastRefreshTime) {
      console.log("[Storage] ⚠️ 沒有找到上次刷新時間記錄，需要刷新");
      return true; // 沒有記錄，需要刷新
    }
    
    const now = Date.now();
    const hoursSinceRefresh = (now - lastRefreshTime) / (1000 * 60 * 60);
    const shouldRefresh = hoursSinceRefresh >= minHours;
    
    console.log("[Storage] 刷新時間檢查:", {
      lastRefreshTime: new Date(lastRefreshTime).toISOString(),
      now: new Date(now).toISOString(),
      hoursSinceRefresh: hoursSinceRefresh.toFixed(2),
      minHours,
      shouldRefresh,
    });
    
    return shouldRefresh;
  } catch (e) {
    console.error("shouldRefreshToken error", e);
    return true; // 發生錯誤時，保守起見需要刷新
  }
};

// ----------- 便捷方法：一次存儲所有登入相關資料 ----------- //
interface LoginTokens {
  accessToken: string;
  refreshToken?: string;
}

/**
 * 登入成功後一次存儲所有 token 和登入時間
 * @param tokens - 包含 accessToken 和可選的 refreshToken
 */
const saveLoginData = async (tokens: LoginTokens) => {
  try {
    // 存儲 accessToken
    await setStoreToken(tokens.accessToken);
    
    // 存儲 refreshToken（如果有）
    if (tokens.refreshToken) {
      await setRefreshToken(tokens.refreshToken);
    }
    
    // 記錄登入時間
    await setLoginTime();
    
    // 記錄上次刷新時間（登入時視為第一次刷新）
    await setLastRefreshTime();

    // 重新登入成功後解除「權限過期已通知」閂鎖，讓日後若再過期仍能再次提示。
    resetSessionExpiredLatch();

    console.log("[Storage] ✅ 登入資料已完整存儲");
  } catch (e) {
    console.error("saveLoginData error", e);
  }
};

/**
 * 清除所有登入相關資料（accessToken、refreshToken、loginTime、lastRefreshTime）
 */
const clearLoginData = async () => {
  try {
    await removeToken();
    await removeRefreshToken();
    await removeLoginTime();
    await removeLastRefreshTime();
    console.log("[Storage] ✅ 登入資料已完整清除");
  } catch (e) {
    console.error("clearLoginData error", e);
  }
};

/**
 * 檢查登入是否已過期（超過指定天數）
 * @param maxDays - 最大允許天數，預設 30 天
 * @returns true 表示已過期需要重新登入
 */
const isLoginExpired = async (maxDays: number = 30): Promise<boolean> => {
  try {
    const loginTime = await getLoginTime();
    
    if (!loginTime) {
      console.log("[Storage] ⚠️ 沒有找到登入時間記錄");
      return true; // 沒有登入時間記錄，視為已過期
    }
    
    const now = Date.now();
    const daysSinceLogin = (now - loginTime) / (1000 * 60 * 60 * 24);
    
    console.log("[Storage] 登入時間檢查:", {
      loginTime: new Date(loginTime).toISOString(),
      now: new Date(now).toISOString(),
      daysSinceLogin: daysSinceLogin.toFixed(2),
      maxDays,
      isExpired: daysSinceLogin > maxDays,
    });
    
    return daysSinceLogin > maxDays;
  } catch (e) {
    console.error("isLoginExpired error", e);
    return true; // 發生錯誤時，保守起見視為已過期
  }
};

// ----------- USER PROFILE FUNCTIONS ----------- //

// Email
const setUserEmail = async (email: string) => {
  try {
    await SecureStore.setItemAsync(EMAIL_KEY, email);
  } catch (e) {
    console.error("setUserEmail error", e);
  }
};

const getUserEmail = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(EMAIL_KEY);
  } catch (e) {
    console.error("getUserEmail error", e);
    return null;
  }
};

// Coin
const setUserCoin = async (coin: number) => {
  try {
    await SecureStore.setItemAsync(COIN_KEY, coin.toString());
  } catch (e) {
    console.error("setUserCoin error", e);
  }
};

const getUserCoin = async (): Promise<number | null> => {
  try {
    const value = await SecureStore.getItemAsync(COIN_KEY);
    return value ? parseInt(value, 10) : null;
  } catch (e) {
    console.error("getUserCoin error", e);
    return null;
  }
};

// Language Code
const setUserLangCode = async (lang: string) => {
  try {
    console.log("setUserLangCode", lang);
    await SecureStore.setItemAsync(LANG_KEY, lang);
  } catch (e) {
    console.error("setUserLangCode error", e);
  }
};

const getUserLangCode = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(LANG_KEY);
  } catch (e) {
    console.error("getUserLangCode error", e);
    return null;
  }
};

// 是否曾由使用者在「語系設定」中手動切換語系。
// 一旦為 true，App 啟動時的語系初始化就不再依裝置語系自動覆蓋。
const setUserLangManual = async (manual: boolean) => {
  try {
    await SecureStore.setItemAsync(LANG_MANUAL_KEY, manual ? "1" : "0");
  } catch (e) {
    console.error("setUserLangManual error", e);
  }
};

const getUserLangManual = async (): Promise<boolean> => {
  try {
    return (await SecureStore.getItemAsync(LANG_MANUAL_KEY)) === "1";
  } catch (e) {
    console.error("getUserLangManual error", e);
    return false;
  }
};

// Role Level（權限級別，9 = Admin）
const setUserRoleLevel = async (roleLevel: number) => {
  try {
    await SecureStore.setItemAsync(ROLE_LEVEL_KEY, String(roleLevel));
  } catch (e) {
    console.error("setUserRoleLevel error", e);
  }
};

const getUserRoleLevel = async (): Promise<number | null> => {
  try {
    const value = await SecureStore.getItemAsync(ROLE_LEVEL_KEY);
    return value !== null ? parseInt(value, 10) : null;
  } catch (e) {
    console.error("getUserRoleLevel error", e);
    return null;
  }
};

// ----------- AUTO PLAY SETTINGS ----------- //
// 劇情自動播放間隔（秒）。為裝置層級偏好，與帳號無關，登出時不清除。
const setAutoPlaySeconds = async (seconds: number) => {
  try {
    const safe = Math.min(
      MAX_AUTO_PLAY_SECONDS,
      Math.max(MIN_AUTO_PLAY_SECONDS, Math.round(seconds))
    );
    await SecureStore.setItemAsync(AUTO_PLAY_SECONDS_KEY, String(safe));
  } catch (e) {
    console.error("setAutoPlaySeconds error", e);
  }
};

const getAutoPlaySeconds = async (): Promise<number> => {
  try {
    const value = await SecureStore.getItemAsync(AUTO_PLAY_SECONDS_KEY);
    const parsed = value != null ? parseInt(value, 10) : NaN;
    if (Number.isNaN(parsed)) return DEFAULT_AUTO_PLAY_SECONDS;
    return Math.min(MAX_AUTO_PLAY_SECONDS, Math.max(MIN_AUTO_PLAY_SECONDS, parsed));
  } catch (e) {
    console.error("getAutoPlaySeconds error", e);
    return DEFAULT_AUTO_PLAY_SECONDS;
  }
};

// 清除全部 user profile 資料
const clearUserProfile = async () => {
  try {
    await SecureStore.deleteItemAsync(EMAIL_KEY);
    await SecureStore.deleteItemAsync(COIN_KEY);
    // 語系（LANG_KEY / LANG_MANUAL_KEY）為裝置層級的偏好設定，登出時刻意保留，
    // 讓使用者手動選擇的語言在切換帳號／重新登入後仍然有效。
    await SecureStore.deleteItemAsync(ROLE_LEVEL_KEY);
  } catch (e) {
    console.error("clearUserProfile error", e);
  }
};

// ----------- EXPORT ----------- //

export default {
  // Access Token
  setStoreToken,
  getToken,
  removeToken,

  // Refresh Token
  setRefreshToken,
  getRefreshToken,
  removeRefreshToken,

  // Login Time
  setLoginTime,
  getLoginTime,
  removeLoginTime,

  // Last Refresh Time
  setLastRefreshTime,
  getLastRefreshTime,
  removeLastRefreshTime,

  // 便捷方法
  saveLoginData,
  clearLoginData,
  isLoginExpired,
  shouldRefreshToken,

  // User Profile
  setUserEmail,
  getUserEmail,
  setUserCoin,
  getUserCoin,
  setUserLangCode,
  getUserLangCode,
  setUserLangManual,
  getUserLangManual,
  setUserRoleLevel,
  getUserRoleLevel,
  clearUserProfile,

  // Auto Play
  setAutoPlaySeconds,
  getAutoPlaySeconds,
};
