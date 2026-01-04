// apiClient.ts
import { RestfulApi } from "./api";

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
    console.log("[Google Login API] 發送請求到後端，idToken 長度:", payload.idToken?.length || 0);
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
//============== xStory Apple 登入相關 API ==============
//=======================================================

// Apple 登入 Request
export interface XStoryAppleLoginRequest {
  idToken: string;
}

// Apple 登入 Response
export interface XStoryAppleLoginResponse {
  success: boolean;
  message: string;
  accessToken?: string;
  refreshToken?: string;
}

/**
 * 使用 xStory Apple 登入
 * @param payload - 包含 Apple 的 idToken
 * @returns 成功回傳 accessToken，失敗則為 null
 */
export async function appleLoginWithXStory(
  payload: XStoryAppleLoginRequest
): Promise<string> {
  try {
    const res = await authApi.post<XStoryAppleLoginResponse>(
      "api/auth/apple-login",
      payload
    );

    if (res && res.success && res.accessToken) {
      console.log("api/auth/apple-login 登入成功，token:", res.accessToken);
      return res.accessToken;
    } else {
      alert(res?.message || "Apple 登入失敗，請稍後再試");
      console.warn("api/auth/apple-login 登入失敗:", res?.message);
      return "";
    }
  } catch (error) {
    alert(extractErrorMessage(error));
    console.error("api/auth/apple-login 登入發生錯誤:", error);
    return "";
  }
}

//=======================================================
//============== xStory Facebook 登入相關 API ==============
//=======================================================

// Facebook 登入 Request
export interface XStoryFacebookLoginRequest {
  token: string;        // iOS: idToken (JWT), Android: accessToken
  rawNonce?: string;   // iOS Limited Login 時需要，用於後端驗證
}

// Facebook 登入 Response
export interface XStoryFacebookLoginResponse {
  success: boolean;
  message: string;
  accessToken?: string;
  refreshToken?: string;
  // 可視後端回傳內容再擴充
}

/**
 * 使用 xStory Facebook 登入
 * @param payload - 包含 Facebook 的 token (iOS: idToken, Android: accessToken) 和可選的 rawNonce
 * @returns 成功回傳 accessToken，失敗則為空字串
 */
export async function facebookLoginWithXStory(
  payload: XStoryFacebookLoginRequest
): Promise<string> {
  try {
    console.log("[Facebook Login API] 發送請求到後端，token 長度:", payload.token?.length || 0);
    if (payload.rawNonce) {
      console.log("[Facebook Login API] 包含 rawNonce (iOS Limited Login)");
    }
    const res = await authApi.post<XStoryFacebookLoginResponse>(
      "api/auth/facebook-login",
      payload
    );

    console.log("[Facebook Login API] 後端回應:", {
      success: res?.success,
      hasAccessToken: !!res?.accessToken,
      accessTokenLength: res?.accessToken?.length || 0,
      message: res?.message,
      fullResponse: JSON.stringify(res, null, 2),
    });

    if (res && res.success && res.accessToken) {
      console.log("[Facebook Login API] 登入成功，token 長度:", res.accessToken.length);
      return res.accessToken;
    } else {
      const errorMsg = res?.message || "Facebook 登入失敗，請稍後再試";
      console.warn("[Facebook Login API] 登入失敗:", {
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
    console.error("[Facebook Login API] 請求發生錯誤:", {
      message: errorMsg,
      error: error,
      stack: (error as any)?.stack,
    });
    // 不在此處 alert，讓呼叫端決定是否要顯示錯誤訊息
    // alert(errorMsg);
    return "";
  }
}

