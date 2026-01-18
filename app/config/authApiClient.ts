// apiClient.ts
import { RestfulApi } from "./api";
import tokenStorage from '../auth/Storage';

export const devBaseUrl = "http://220.133.50.218:6001/";
export const prodBaseUrl = "http://20.198.216.126:3001/";
//https://xstoryline.com/
const authApi = new RestfulApi({
  devBaseUrl,
  prodBaseUrl,
  isDev: __DEV__,
});

export default authApi;


/**
 * xStory 註冊 Request 資料格式
 */
export interface XStoryAuthRequest {
  email: string;
  password: string;
}

/**
 * xStory 註冊 Response（成功或失敗都回傳 true/false）
 */
export interface XStoryAuthResponse {
  success: boolean;
  message: string;
  accessToken: string;
}

/**
 * 使用 xStory 註冊帳號
 * @param payload - 包含 email 和 password
 * @returns Promise<boolean> 表示是否成功
 */
export async function registerWithXStory(
  payload: XStoryAuthRequest
): Promise<boolean> {
  try {
    const res = await authApi.post<XStoryAuthResponse>(
      "api/auth/register",
      payload
    );

    if (res && res.success) {
      return true;
    } else {
      console.warn("註冊失敗:", res.message);
      alert(res?.message || "註冊失敗，請稍後再試");
      return false;
    }
  } catch (error) {
    alert(extractErrorMessage(error));
    console.error("註冊發生錯誤:", error);
    return false;
  }
}

/** 
 * 重發註冊驗證信 Request 資料格式
 */
export interface ResentRegisterMailRequest {
  email: string;
}

/** * 重發註冊驗證信 Response 資料格式
 * 成功時回傳 success: true，message 為成功訊息
 * 失敗時回傳 success: false，message 為錯誤訊息
 */
export interface ResentRegisterMailResponse {
  success: boolean;
  message: string;
}

/** * 重發註冊驗證信
 * @param payload - 包含 email
 * @returns Promise<boolean> 表示是否成功重發驗證信
 */
export async function resentRegisterMail(
  payload: ResentRegisterMailRequest
): Promise<boolean> {
  try {
    const res = await authApi.post<ResentRegisterMailResponse>(
      "api/auth/resent-register-mail",
      payload
    );

    if (res && res.success) {
      alert("驗證信已重新寄出");
      return true;
    } else {
      console.warn("重發驗證信失敗:", res.message);
      alert(res?.message || "重發驗證信失敗，請稍後再試");
      return false;
    }
  } catch (error) {
    alert(extractErrorMessage(error));
    console.error("重發驗證信時發生錯誤:", error);
    return false;
  }
}

/**
 * 使用 xStory 登入帳號
 */
export async function loginWithXStory(
  payload: XStoryAuthRequest
): Promise<string | null> {
  try {
    const res = await authApi.post<XStoryAuthResponse>(
      "api/auth/login",
      payload
    );

    if (res && res.success) {
      const token = res.accessToken;
      console.log("登入成功，token:", token);
      // 這裡可以儲存 token 或進行其他登入後的處理
      // 例如：AsyncStorage.setItem('xStoryToken', token);
      // 或者使用 Redux/Context API 儲存登入狀態

      return token;
    } else {
      alert(res?.message || "登入失敗，請稍後再試");
      console.warn("登入失敗:", res?.message);
      return null;
    }
  } catch (error) {
    alert(extractErrorMessage(error));
    console.error("登入發生錯誤:", error);
    return null;
  }
}

/**
 * 忘記密碼 Request 資料格式
 */
export interface XStoryForgotPasswordRequest {
  email: string;
}

/**
 * 忘記密碼 Response 資料格式
 */
export interface XStoryForgotPasswordResponse {
  success: boolean;
  message: string;
}

/**
 * 使用 xStory 忘記密碼
 * @param payload - 包含 email
 * @returns Promise<boolean> 表示是否成功發送驗證信
 */
export async function forgotXStoryPassword(
  payload: XStoryForgotPasswordRequest
): Promise<boolean> {
  try {
    const res = await authApi.post<XStoryForgotPasswordResponse>(
      "api/auth/forgot-password",
      payload
    );

    if (res && res.success) {
      return true;
    } else {
      alert(res?.message || "重設密碼寄信失敗，請稍後再試");
      console.warn("重設密碼寄信失敗:", res?.message);
      return false;
    }
  } catch (error) {
    alert(extractErrorMessage(error));
    console.error("重設密碼時發生錯誤:", error);
    return false;
  }
}

/**
 * 忘記密碼 Request 資料格式
 */
export interface XStoryVerifyRequest {
  email: string;
  token: string;
}

/**
 * 忘記密碼 Response 資料格式
 */
export interface XStoryVerifyResponse {
  success: boolean;
  message: string;
}

/**
 * 使用 xStory 驗證電子郵件
 * @param payload - 包含 email 和 token
 * @returns 
 */
export async function VerifyMail(payload: XStoryVerifyRequest): Promise<boolean> {
  try {
    const res = await authApi.post<XStoryVerifyResponse>(
      "api/auth/verify-email",
      payload
    );

    if (res && res.success) {
      alert("驗證成功，請重新登入");
      return true;
    } else {
      alert(res?.message || "驗證失敗，請稍後再試");
      console.warn("驗證失敗:", res?.message);
      return false;
    }
  } catch (error) {
    alert(extractErrorMessage(error));
    console.error("驗證時發生錯誤:", error);
    return false;
  }
}

/**
 * 使用 xStory 登出帳號
 * @returns Promise<boolean> 表示是否成功登出
 */
export async function logoutWithXStory(): Promise<boolean> {
  try {
    const res = await authApi.post<XStoryAuthResponse>("api/auth/logout", {});

    if (res && res.message === '登出成功') {
      return true;
    } else {
      console.warn("登出失敗:", res?.message);
      alert(res?.message || "登出失敗，請稍後再試");
      return false;
    }
  } catch (error) {
    alert(extractErrorMessage(error));
    console.error("登出時發生錯誤:", error);
    return false;
  }
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface ResetPasswordResponse {
  success: boolean;
  message: string;
}

// 重設密碼 API
// 這個 API 用於處理重設密碼的請求
// 需要提供 token 和新的密碼
// 成功時返回 success: true，失敗時返回 success: false 並帶有錯誤訊息
export async function resetXStoryPassword(
  payload: ResetPasswordRequest
): Promise<boolean> {
  try {
    const res = await authApi.post<ResetPasswordResponse>(
      "api/auth/reset-password",
      payload
    );

    if (res && res.success) {
      return true;
    } else {
      alert(res?.message || "密碼重設失敗，請稍後再試");
      console.warn("密碼重設失敗:", res?.message);
      return false;
    }
  } catch (error) {
    alert(extractErrorMessage(error));
    console.error("密碼重設時發生錯誤:", error);
    return false;
  }
}

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

//=======================================================
//============== xStory Google 登入相關 API ==============
//=======================================================

// Google 登入 Request
export interface XStoryGoogleLoginRequest {
  idToken: string;
}

// Google 登入 Response
export interface XStoryGoogleLoginResponse {
  success: boolean;
  message: string;
  accessToken?: string;
  refreshToken?: string;
  // 可能還會有 isNewUser、profile 等欄位，依後端再擴充
}

// 使用 xStory Google 登入
export async function googleLoginWithXStory(
  payload: XStoryGoogleLoginRequest
): Promise<string> {
  try {
    const baseUrl = authApi.currentBaseUrl();
    const fullUrl = baseUrl + "api/auth/google-login";
    console.log("[Google Login API] 準備發送請求:");
    console.log("[Google Login API]   基礎 URL:", baseUrl);
    console.log("[Google Login API]   完整 URL:", fullUrl);
    console.log("[Google Login API]   idToken 長度:", payload.idToken?.length || 0);
    console.log("[Google Login API]   環境模式:", __DEV__ ? "開發" : "生產");
    
    const res = await authApi.post<XStoryGoogleLoginResponse>(
      "api/auth/google-login",
      payload
    );

    console.log("[Google Login API] 後端回應:", {
      success: res?.success,
      hasAccessToken: !!res?.accessToken,
      accessTokenLength: res?.accessToken?.length || 0,
      message: res?.message,
      fullResponse: JSON.stringify(res, null, 2),
    });

    if (res && res.success && res.accessToken) {
      console.log("[Google Login API] 登入成功，token 長度:", res.accessToken.length);
      return res.accessToken;
    } else {
      const errorMsg = res?.message || "Google 登入失敗，請稍後再試";
      console.warn("[Google Login API] 登入失敗:", {
        success: res?.success,
        hasAccessToken: !!res?.accessToken,
        message: errorMsg,
        fullResponse: JSON.stringify(res, null, 2),
      });
      // 不在此處 alert，讓呼叫端決定是否要顯示錯誤訊息
      // alert(errorMsg);
      return "";
    }
  } catch (error) {
    const errorMsg = extractErrorMessage(error);
    console.error("[Google Login API] 請求發生錯誤:", {
      message: errorMsg,
      error: error,
      stack: (error as any)?.stack,
    });
    // 不在此處 alert，讓呼叫端決定是否要顯示錯誤訊息
    // alert(errorMsg);
    return "";
  }
}

//=======================================================
//============== xStory Token 刷新相關 API ==============
//=======================================================

/**
 * Token 刷新 Request 資料格式
 */
export interface XStoryRefreshTokenRequest {
  refreshToken: string;
}

/**
 * Token 刷新 Response 資料格式
 */
export interface XStoryRefreshTokenResponse {
  success: boolean;
  message: string;
  accessToken?: string;
  refreshToken?: string;
}

/**
 * 使用 refreshToken 刷新 accessToken
 * @param payload - 包含 refreshToken
 * @returns 成功回傳新的 accessToken，失敗則為 null
 */
export async function refreshXStoryToken(
  payload: XStoryRefreshTokenRequest
): Promise<string | null> {
  try {
    console.log('[RefreshToken API] 發送刷新請求，refreshToken 長度:', payload.refreshToken?.length || 0);
    
    const res = await authApi.post<XStoryRefreshTokenResponse>(
      "api/auth/refresh",
      payload
    );

    console.log('[RefreshToken API] 後端回應:', {
      success: res?.success,
      hasAccessToken: !!res?.accessToken,
      accessTokenLength: res?.accessToken?.length || 0,
      hasRefreshToken: !!res?.refreshToken,
      message: res?.message,
    });

    if (res && res.success && res.accessToken) {
      console.log('[RefreshToken API] ✅ Token 刷新成功，新 token 長度:', res.accessToken.length);
      return res.accessToken;
    } else {
      const errorMsg = res?.message || "Token 刷新失敗，請稍後再試";
      console.warn('[RefreshToken API] ❌ Token 刷新失敗:', {
        success: res?.success,
        hasAccessToken: !!res?.accessToken,
        message: errorMsg,
      });
      return null;
    }
  } catch (error) {
    const errorMsg = extractErrorMessage(error);
    console.error('[RefreshToken API] ❌ 請求發生錯誤:', {
      message: errorMsg,
      error: error,
      stack: (error as any)?.stack,
    });
    return null;
  }
}

//=======================================================
//============== Token 刷新服務類 ==============
//=======================================================

/**
 * Token 刷新服務
 * 用於在應用喚醒或重啟時刷新 token
 */
class TokenRefreshService {
  private isRefreshing = false;

  /**
   * 刷新 Token
   * @param onProgress - 可選的回調函數，用於通知進度狀態變化
   * @param onRefreshFailed - 可選的回調函數，當刷新失敗時調用（用於清除資料和登出）
   * @returns Promise<boolean> 表示是否成功
   */
  async refreshToken(
    onProgress?: (isProgress: boolean) => void,
    onRefreshFailed?: () => void
  ): Promise<boolean> {
    // 防止重複刷新
    if (this.isRefreshing) {
      console.log('[TokenRefreshService] ⚠️ Token 刷新已進行中，跳過此次請求');
      return false;
    }

    this.isRefreshing = true;

    try {
      console.log('[TokenRefreshService] 🔄 開始刷新 Token...');
      
      // 進入 progress state
      onProgress?.(true);

      // 檢查是否有現有的 token（這裡假設 accessToken 就是 refreshToken，或需要從其他地方獲取）
      // 如果後端需要單獨的 refreshToken，需要從存儲中獲取
      const existingToken = await tokenStorage.getToken();
      
      if (!existingToken) {
        console.log('[TokenRefreshService] ⚠️ 沒有找到現有的 token，跳過刷新');
        onProgress?.(false);
        this.isRefreshing = false;
        return false;
      }

      console.log('[TokenRefreshService] ✓ 找到現有 token，長度:', existingToken.length);
      console.log('[TokenRefreshService] 📝 Token 前 20 字元:', existingToken.substring(0, 20) + '...');

      // 調用實際的刷新 API
      // 注意：這裡假設現有的 token 就是 refreshToken
      // 如果後端需要單獨的 refreshToken，需要從存儲中獲取
      const newAccessToken = await refreshXStoryToken({
        refreshToken: existingToken,
      });

      if (newAccessToken) {
        // 保存新的 accessToken
        await tokenStorage.setStoreToken(newAccessToken);
        console.log('[TokenRefreshService] ✅ Token 刷新完成並已保存');
        
        // 離開 progress state
        onProgress?.(false);
        this.isRefreshing = false;
        return true;
      } else {
        console.error('[TokenRefreshService] ❌ Token 刷新失敗，未獲得新的 token');
        onProgress?.(false);
        this.isRefreshing = false;
        
        // 調用失敗回調，顯示 alert 並清除資料
        if (onRefreshFailed) {
          onRefreshFailed();
        }
        
        return false;
      }
    } catch (error) {
      console.error('[TokenRefreshService] ❌ Token 刷新失敗:', error);
      onProgress?.(false);
      this.isRefreshing = false;
      
      // 調用失敗回調，顯示 alert 並清除資料
      if (onRefreshFailed) {
        onRefreshFailed();
      }
      
      return false;
    }
  }

  /**
   * 檢查是否正在刷新
   */
  getIsRefreshing(): boolean {
    return this.isRefreshing;
  }
}

// 導出單例
export const tokenRefreshService = new TokenRefreshService();
