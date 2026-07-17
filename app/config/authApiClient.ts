// apiClient.ts
import { RestfulApi } from "./api";
import tokenStorage from '../auth/Storage';
import { portURL } from "./apiClient";
import { translate } from "../i18n/i18n";
import { showAlert } from "../components/CustomAlert";

/**
 * 登入／註冊／refresh／logout 與 iapService 使用的 `api/me/iap-receipts` 等，實際都部署在
 * `portURL`（與 `userApiClient` 的 production base 相同）。
 *
 * `https://xstoryline.com/` 與 `http://api.xstudio-mclub.url.tw/` 對 `api/auth/*` 會回 **404**
 *（路由未掛在該主機），因此第三方登入會一直失敗。
 */
export const authServiceBaseUrl = portURL;
const authApi = new RestfulApi({
  devBaseUrl: authServiceBaseUrl,
  prodBaseUrl: authServiceBaseUrl,
  isDev: __DEV__,
});

export default authApi;

// Debug: 印出登入用 token 供你核對（驗證「送出去」與「後端回傳」是否正確）
// 注意：token 屬於敏感資訊；確認後建議把 SHOULD_LOG_TOKENS 設回 false。
const SHOULD_LOG_TOKENS = true;
const SHOULD_LOG_FULL_TOKEN = true;

function logToken(
  label: string,
  value: string | undefined | null,
  opts?: { maxPreview?: number; maxFull?: number }
) {
  const maxPreview = opts?.maxPreview ?? 200;
  const maxFull = opts?.maxFull ?? 50000;
  const len = value?.length ?? 0;
  console.log(label + " 長度:", len);
  if (!SHOULD_LOG_TOKENS) return;
  if (!value) return;
  if (SHOULD_LOG_FULL_TOKEN && len <= maxFull) {
    console.log(label + " (full):", value);
    return;
  }
  console.log(label + ` (preview ${maxPreview} chars):`, value.substring(0, maxPreview));
  if (len > maxPreview) {
    console.log(label + " (tail 80 chars):", value.substring(Math.max(0, len - 80)));
  }
}


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
  refreshToken?: string;
}

/**
 * 登入成功後的 Token 資料
 */
export interface LoginTokenResult {
  accessToken: string;
  refreshToken?: string;
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
      // 標題統一「錯誤」；內文暫維持後端 message，待「已註冊」辨識邏輯確定後再改用 emailAlreadyRegistered
      showAlert(translate("genericErrorTitle"), res?.message || translate("registerFailedMessage"));
      return false;
    }
  } catch (error) {
    // 後端「Email 已註冊」回 HTTP 401（見 Swagger）；此情境改用 i18n 內文，
    // 讓簡中／英文正確顯示翻譯，其餘錯誤維持後端／原始訊息。
    const message =
      extractStatusCode(error) === 401
        ? translate("emailAlreadyRegistered")
        : extractErrorMessage(error);
    showAlert(translate("genericErrorTitle"), message);
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
      "api/auth/resend-verification",
      payload
    );

    if (res && res.success) {
      // 重發流程：顯示帶標題的成功彈窗（與一般註冊流程的畫面提示 verificationSent 區隔）
      showAlert(translate("resendMailSuccessTitle"), translate("resendMailSuccessMessage"));
      return true;
    } else {
      // 只記錄後端原始訊息供除錯，對使用者一律顯示內建翻譯，避免後端回傳亂碼字串
      console.warn("重發驗證信失敗:", res?.message);
      alert(translate("resendMailFailedMessage"));
      return false;
    }
  } catch (error) {
    // 記錄原始錯誤，對使用者一律顯示內建翻譯，避免亂碼
    console.error("重發驗證信時發生錯誤:", error);
    // 後端無法細分，401 統一代表「找不到該 email 使用者或信箱已驗證」；其餘走通用失敗
    const message =
      extractStatusCode(error) === 401
        ? translate("resendMailNotFoundOrVerified")
        : translate("resendMailFailedMessage");
    alert(message);
    return false;
  }
}

/**
 * 將後端登入錯誤訊息對應到 App 端 i18n 內文。
 * 後端三種登入失敗情況皆回 HTTP 401，僅能以 message 內容區分（見 /api/docs）：
 *   「帳號不存在」          → accountNotFoundMessage
 *   「請先完成 Email 驗證」  → emailNotVerifiedMessage（先驗證信箱才會檢查密碼）
 *   「密碼錯誤」            → incorrectPasswordMessage
 * 以關鍵字比對，避免後端微幅調整字串就失效；其餘（含網路／逾時錯誤）走通用失敗訊息。
 */
function resolveLoginErrorMessage(raw: string | undefined | null): string {
  const msg = raw ?? "";
  if (msg.includes("驗證")) return translate("emailNotVerifiedMessage");
  if (msg.includes("密碼")) return translate("incorrectPasswordMessage");
  if (msg.includes("不存在")) return translate("accountNotFoundMessage");
  return translate("loginFailedMessage");
}

/**
 * 使用 xStory 登入帳號
 * @returns 成功時回傳 LoginTokenResult（包含 accessToken 和 refreshToken），失敗時回傳 null
 */
export async function loginWithXStory(
  payload: XStoryAuthRequest
): Promise<LoginTokenResult | null> {
  try {
    const res = await authApi.post<XStoryAuthResponse>(
      "api/auth/login",
      payload
    );

    if (res && res.success && res.accessToken) {
      console.log("登入成功，accessToken 長度:", res.accessToken.length);
      console.log("登入成功，refreshToken 長度:", res.refreshToken?.length || 0);

      return {
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
      };
    } else {
      // 標題統一「錯誤」，內文依語系翻譯（HTTP 200 但 success:false 的保險路徑）
      console.warn("登入失敗:", res?.message);
      showAlert(translate("genericErrorTitle"), resolveLoginErrorMessage(res?.message));
      return null;
    }
  } catch (error) {
    // 登入失敗多為 HTTP 401（走此 catch），依後端 message 對應到 i18n 內文
    console.error("登入發生錯誤:", error);
    showAlert(translate("genericErrorTitle"), resolveLoginErrorMessage(extractErrorMessage(error)));
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
      alert(res?.message || translate("forgotPasswordFailedMessage"));
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
      // 成功後的提示與導向交由 deep link 處理端（_layout）以套用 i18n 標題／內文並跳轉登入頁
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
 * 登出 API Request 格式（讓後端將 token 失效）
 */
export interface LogoutRequest {
  refreshToken: string;
  accessToken: string;
}

/**
 * 使用 xStory 登出帳號
 * 從 Storage 取得 refreshToken、accessToken 送給後端失效
 * @returns Promise<boolean> 表示是否成功登出
 */
export async function logoutWithXStory(): Promise<boolean> {
  try {
    const accessToken = await tokenStorage.getToken();
    const refreshToken = await tokenStorage.getRefreshToken();

    const payload: LogoutRequest = {
      refreshToken: refreshToken ?? "",
      accessToken: accessToken ?? "",
    };

    const headers: Record<string, string> = {};
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    const res = await authApi.post<XStoryAuthResponse>("api/auth/logout", payload, headers);

    if (res && res.message === '登出成功') {
      return true;
    } else {
      // 登出以清除本地資料為主，後端失敗時不阻擋使用者，僅記錄 log
      console.warn("登出失敗:", res?.message);
      return false;
    }
  } catch (error) {
    // 後端登出失敗（例如 token 已過期）不應跳 alert 擋住登出流程，僅記錄 log
    console.warn("登出時發生錯誤:", extractErrorMessage(error));
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
      alert(res?.message || translate("resetPasswordFailedMessage"));
      console.warn("密碼重設失敗:", res?.message);
      return false;
    }
  } catch (error) {
    alert(extractErrorMessage(error));
    console.error("密碼重設時發生錯誤:", error);
    return false;
  }
}

/**
 * 從 RestfulApi 丟出的 Error 取出 HTTP 狀態碼。
 * api.ts 失敗時會 throw `HTTP <status>: <body>`，故以此格式解析。
 * @returns 狀態碼數字，無法解析時回傳 null
 */
function extractStatusCode(err: unknown): number | null {
  if (err instanceof Error) {
    const m = err.message.match(/HTTP (\d+)/);
    if (m) return parseInt(m[1], 10);
  }
  return null;
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
// @returns 成功時回傳 LoginTokenResult（包含 accessToken 和 refreshToken），失敗時回傳 null
export async function googleLoginWithXStory(
  payload: XStoryGoogleLoginRequest
): Promise<LoginTokenResult | null> {
  try {
    const baseUrl = authApi.currentBaseUrl();
    const fullUrl = baseUrl + "api/auth/google-login";
    console.log("[Google Login API] 準備發送請求:");
    console.log("[Google Login API]   基礎 URL:", baseUrl);
    console.log("[Google Login API]   完整 URL:", fullUrl);
    console.log("[Google Login API]   idToken 長度:", payload.idToken?.length || 0);
    logToken("[Google Login API]   送往後端的 idToken", payload.idToken);
    console.log("[Google Login API]   環境模式:", __DEV__ ? "開發" : "生產");
    
    const res = await authApi.post<XStoryGoogleLoginResponse>(
      "api/auth/google-login",
      payload
    );

    console.log("[Google Login API] 後端回應:", {
      success: res?.success,
      hasAccessToken: !!res?.accessToken,
      accessTokenLength: res?.accessToken?.length || 0,
      hasRefreshToken: !!res?.refreshToken,
      refreshTokenLength: res?.refreshToken?.length || 0,
      message: res?.message,
      fullResponse: JSON.stringify(res, null, 2),
    });

    if (res && res.success && res.accessToken) {
      console.log("[Google Login API] 登入成功，accessToken 長度:", res.accessToken.length);
      console.log("[Google Login API] 登入成功，refreshToken 長度:", res.refreshToken?.length || 0);
      return {
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
      };
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
      throw new Error(errorMsg);
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
    throw error instanceof Error ? error : new Error(errorMsg);
  }
}

//=======================================================
//============== xStory Facebook 登入相關 API ==============
//=======================================================

// Facebook 登入 Request
export interface XStoryFacebookLoginRequest {
  token: string;
  rawNonce?: string; // iOS Limited Login 需要
}

// Facebook 登入 Response
export interface XStoryFacebookLoginResponse {
  success: boolean;
  message: string;
  accessToken?: string;
  refreshToken?: string;
}

// 使用 xStory Facebook 登入
// @returns 成功時回傳 LoginTokenResult（包含 accessToken 和 refreshToken），失敗時回傳 null
export async function facebookLoginWithXStory(
  payload: XStoryFacebookLoginRequest
): Promise<LoginTokenResult | null> {
  try {
    console.log("[Facebook Login API] 準備發送請求:");
    console.log("[Facebook Login API]   token 長度:", payload.token?.length || 0);
    console.log("[Facebook Login API]   hasRawNonce:", !!payload.rawNonce);
    logToken("[Facebook Login API]   送往後端的 token", payload.token);
    logToken("[Facebook Login API]   送往後端的 rawNonce", payload.rawNonce, { maxPreview: 120, maxFull: 500 });
    
    const res = await authApi.post<XStoryFacebookLoginResponse>(
      "api/auth/facebook-login",
      payload
    );

    console.log("[Facebook Login API] 後端回應:", {
      success: res?.success,
      hasAccessToken: !!res?.accessToken,
      accessTokenLength: res?.accessToken?.length || 0,
      hasRefreshToken: !!res?.refreshToken,
      refreshTokenLength: res?.refreshToken?.length || 0,
      message: res?.message,
      fullResponse: JSON.stringify(res, null, 2),
    });

    if (res && res.success && res.accessToken) {
      console.log("[Facebook Login API] 登入成功，accessToken 長度:", res.accessToken.length);
      console.log("[Facebook Login API] 登入成功，refreshToken 長度:", res.refreshToken?.length || 0);
      logToken("[Facebook Login API]   後端回傳的 accessToken", res.accessToken);
      logToken("[Facebook Login API]   後端回傳的 refreshToken", res.refreshToken);
      return {
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
      };
    } else {
      const errorMsg = res?.message || "Facebook 登入失敗，請稍後再試";
      console.warn("[Facebook Login API] 登入失敗:", {
        success: res?.success,
        hasAccessToken: !!res?.accessToken,
        message: errorMsg,
        fullResponse: JSON.stringify(res, null, 2),
      });
      throw new Error(errorMsg);
    }
  } catch (error) {
    const errorMsg = extractErrorMessage(error);
    console.error("[Facebook Login API] 請求發生錯誤:", {
      message: errorMsg,
      error: error,
    });
    throw error instanceof Error ? error : new Error(errorMsg);
  }
}

//=======================================================
//============== xStory WeChat 登入相關 API ==============
//=======================================================

// WeChat 登入 Request
export interface XStoryWeChatLoginRequest {
  code: string;
}

// WeChat 登入 Response
export interface XStoryWeChatLoginResponse {
  success: boolean;
  message: string;
  accessToken?: string;
  refreshToken?: string;
}

// 使用 xStory WeChat 登入
// @returns 成功時回傳 LoginTokenResult（包含 accessToken 和 refreshToken），失敗時回傳 null
export async function wechatLoginWithXStory(
  payload: XStoryWeChatLoginRequest
): Promise<LoginTokenResult | null> {
  try {
    console.log("[WeChat Login API] 準備發送請求:");
    console.log("[WeChat Login API]   code 長度:", payload.code?.length || 0);
    
    const res = await authApi.post<XStoryWeChatLoginResponse>(
      "api/auth/wechat-login",
      payload
    );

    console.log("[WeChat Login API] 後端回應:", {
      success: res?.success,
      hasAccessToken: !!res?.accessToken,
      accessTokenLength: res?.accessToken?.length || 0,
      hasRefreshToken: !!res?.refreshToken,
      refreshTokenLength: res?.refreshToken?.length || 0,
      message: res?.message,
    });

    if (res && res.success && res.accessToken) {
      console.log("[WeChat Login API] 登入成功，accessToken 長度:", res.accessToken.length);
      console.log("[WeChat Login API] 登入成功，refreshToken 長度:", res.refreshToken?.length || 0);
      return {
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
      };
    } else {
      const errorMsg = res?.message || "WeChat 登入失敗，請稍後再試";
      console.warn("[WeChat Login API] 登入失敗:", {
        success: res?.success,
        hasAccessToken: !!res?.accessToken,
        message: errorMsg,
      });
      throw new Error(errorMsg);
    }
  } catch (error) {
    const errorMsg = extractErrorMessage(error);
    console.error("[WeChat Login API] 請求發生錯誤:", {
      message: errorMsg,
      error: error,
    });
    throw error instanceof Error ? error : new Error(errorMsg);
  }
}

//=======================================================
//============== xStory Apple 登入相關 API ==============
//=======================================================

// Apple 登入 Request
export interface XStoryAppleLoginRequest {
  idToken: string;
  authorizationCode?: string;
  user?: string;
}

// Apple 登入 Response
export interface XStoryAppleLoginResponse {
  success: boolean;
  message: string;
  accessToken?: string;
  refreshToken?: string;
}

// 使用 xStory Apple 登入
// @returns 成功時回傳 LoginTokenResult（包含 accessToken 和 refreshToken），失敗時回傳 null
export async function appleLoginWithXStory(
  payload: XStoryAppleLoginRequest
): Promise<LoginTokenResult | null> {
  try {
    console.log("[Apple Login API] 準備發送請求:");
    console.log("[Apple Login API]   idToken 長度:", payload.idToken?.length || 0);
    logToken("[Apple Login API]   送往後端的 idToken", payload.idToken);
    if (payload.authorizationCode) {
      logToken(
        "[Apple Login API]   送往後端的 authorizationCode",
        payload.authorizationCode,
        { maxPreview: 200, maxFull: 2500 }
      );
    } else {
      console.log("[Apple Login API]   送往後端的 authorizationCode: (無)");
    }

    const res = await authApi.post<XStoryAppleLoginResponse>(
      "api/auth/apple-login",
      payload
    );

    console.log("[Apple Login API] 後端回應:", {
      success: res?.success,
      hasAccessToken: !!res?.accessToken,
      accessTokenLength: res?.accessToken?.length || 0,
      hasRefreshToken: !!res?.refreshToken,
      refreshTokenLength: res?.refreshToken?.length || 0,
      message: res?.message,
      fullResponse: JSON.stringify(res, null, 2),
    });

    if (res && res.success && res.accessToken) {
      console.log("[Apple Login API] 登入成功，accessToken 長度:", res.accessToken.length);
      console.log("[Apple Login API] 登入成功，refreshToken 長度:", res.refreshToken?.length || 0);
      logToken("[Apple Login API]   後端回傳的 accessToken", res.accessToken);
      logToken("[Apple Login API]   後端回傳的 refreshToken", res.refreshToken);
      return {
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
      };
    } else {
      const errorMsg = res?.message || "Apple 登入失敗，請稍後再試";
      console.warn("[Apple Login API] 登入失敗:", {
        success: res?.success,
        hasAccessToken: !!res?.accessToken,
        message: errorMsg,
        fullResponse: JSON.stringify(res, null, 2),
      });
      throw new Error(errorMsg);
    }
  } catch (error) {
    const errorMsg = extractErrorMessage(error);
    console.error("[Apple Login API] 請求發生錯誤:", {
      message: errorMsg,
      error: error,
    });
    throw error instanceof Error ? error : new Error(errorMsg);
  }
}

//=======================================================
//============== xStory Token 刷新相關 API ==============
//=======================================================

/**
 * Token 刷新 Request 資料格式（與後端 API 一致）
 * 後端要求同時傳送 refreshToken 與舊的 accessToken。
 */
export interface XStoryRefreshTokenRequest {
  refreshToken: string;
  accessToken: string;
}

/**
 * Token 刷新 Response 資料格式
 * 後端若實作 Refresh Token 輪換，會回傳新的 refreshToken 並使舊的失效（refreshed: true）。
 */
export interface XStoryRefreshTokenResponse {
  success: boolean;
  message: string;
  accessToken?: string;
  refreshToken?: string;
  /** 新 accessToken 剩餘有效時間（秒），例如 3600 = 1 小時 */
  expiresIn?: number;
  /** true = 後端已輪換 refreshToken，客戶端必須儲存回應中的新 refreshToken */
  refreshed?: boolean;
}

export interface RefreshTokenResult {
  accessToken: string;
  refreshToken?: string;
}

/**
 * 刷新 API 的「客戶端結果」型別（不是後端的 success 欄位）。
 * 後端只回傳 success / accessToken / expiresIn / refreshed；
 * 我們用 ok + reason 區分「成功 / 權限過期 / 網路錯誤」，方便只對權限過期登出、網路錯誤不登出。
 */
export type RefreshApiResult =
  | { ok: true; accessToken: string; refreshToken?: string }
  | { ok: false; reason: 'token_invalid' }
  | { ok: false; reason: 'network_error' };

function isNetworkError(error: unknown): boolean {
  const msg = typeof error === 'object' && error !== null && 'message' in error
    ? String((error as any).message)
    : '';
  return (
    msg.includes('Network request failed') ||
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('timeout') ||
    msg.includes('TIMEOUT')
  );
}

/**
 * 使用 refreshToken + 舊 accessToken 刷新 accessToken
 * @param payload - 包含 refreshToken 與 accessToken（與後端 API 規格一致）
 * @returns 成功回傳 ok:true + token；失敗區分 token_invalid（權限過期）與 network_error（網路異常），僅前者應觸發登出。
 */
export async function refreshXStoryToken(
  payload: XStoryRefreshTokenRequest
): Promise<RefreshApiResult> {
  try {
    console.log('[RefreshToken API] 發送刷新請求，refreshToken 長度:', payload.refreshToken?.length || 0, 'accessToken 長度:', payload.accessToken?.length || 0);

    const res = await authApi.post<XStoryRefreshTokenResponse>(
      "api/auth/refresh",
      payload
    );

    console.log('[RefreshToken API] 後端回應:', {
      success: res?.success,
      hasAccessToken: !!res?.accessToken,
      accessTokenLength: res?.accessToken?.length || 0,
      hasRefreshToken: !!res?.refreshToken,
      refreshed: res?.refreshed,
      expiresIn: res?.expiresIn,
      message: res?.message,
    });

    if (res && res.success && res.accessToken) {
      console.log('[RefreshToken API] ✅ Token 刷新成功，新 token 長度:', res.accessToken.length);
      if (res.refreshToken) {
        console.log('[RefreshToken API] 後端已輪換 refreshToken，需儲存新 refreshToken');
      }
      return {
        ok: true,
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
      };
    } else {
      const errorMsg = res?.message || "Token 刷新失敗，請稍後再試";
      console.warn('[RefreshToken API] ❌ Token 刷新失敗（權限過期或無效）:', {
        success: res?.success,
        hasAccessToken: !!res?.accessToken,
        message: errorMsg,
      });
      return { ok: false, reason: 'token_invalid' };
    }
  } catch (error) {
    const errorMsg = extractErrorMessage(error);
    const networkErr = isNetworkError(error);
    console.error('[RefreshToken API] ❌ 請求發生錯誤:', {
      message: errorMsg,
      isNetworkError: networkErr,
      error: error,
      stack: (error as any)?.stack,
    });
    return { ok: false, reason: networkErr ? 'network_error' : 'token_invalid' };
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
   * 檢查登入是否過期（超過 30 天）
   * @returns true 表示已過期需要重新登入
   */
  async checkLoginExpired(): Promise<boolean> {
    return await tokenStorage.isLoginExpired(30);
  }

  /**
   * 刷新 Token
   * @param onProgress - 可選的回調函數，用於通知進度狀態變化
   * @param onRefreshFailed - 可選的回調函數，當「權限過期」時調用（用於清除資料和登出）
   * @param onLoginExpired - 可選的回調函數，當登入已過期時調用（超過 30 天需要重新登入）
   * @param onNetworkError - 可選的回調函數，當「網路異常」時調用（不登出，可提示用戶稍後再試）
   * @param forceRefresh - 是否強制刷新（忽略 1 小時間隔限制），預設 false
   * @returns Promise<boolean> 表示是否成功
   */
  async refreshToken(
    onProgress?: (isProgress: boolean) => void,
    onRefreshFailed?: () => void,
    onLoginExpired?: () => void,
    onNetworkError?: () => void,
    forceRefresh: boolean = false
  ): Promise<boolean> {
    // 防止重複刷新
    if (this.isRefreshing) {
      console.log('[TokenRefreshService] ⚠️ Token 刷新已進行中，跳過此次請求');
      return false;
    }

    this.isRefreshing = true;

    try {
      console.log('[TokenRefreshService] 🔄 開始檢查 Token 刷新...');

      // 1. 檢查登入時間是否已過期（超過 30 天）
      const isExpired = await tokenStorage.isLoginExpired(30);
      if (isExpired) {
        console.log('[TokenRefreshService] ⚠️ 登入已超過 30 天，需要重新登入');
        this.isRefreshing = false;
        
        // 調用登入過期回調
        if (onLoginExpired) {
          onLoginExpired();
        }
        
        return false;
      }

      // 2. 檢查是否需要刷新（距離上次刷新是否超過 1 小時）
      if (!forceRefresh) {
        const shouldRefresh = await tokenStorage.shouldRefreshToken(1); // 1 小時
        if (!shouldRefresh) {
          console.log('[TokenRefreshService] ⏰ 距離上次刷新未超過 1 小時，跳過刷新');
          this.isRefreshing = false;
          return true; // 不需要刷新，視為成功
        }
      } else {
        console.log('[TokenRefreshService] 🔄 強制刷新模式，忽略時間間隔限制');
      }
      
      // 進入 progress state
      onProgress?.(true);

      // 3. 獲取 refreshToken 與目前的 accessToken（後端 API 要求兩者都傳）
      const refreshToken = await tokenStorage.getRefreshToken();
      const accessToken = await tokenStorage.getToken();

      if (!refreshToken) {
        console.log('[TokenRefreshService] ⚠️ 沒有找到 refreshToken，跳過刷新');
        onProgress?.(false);
        this.isRefreshing = false;
        
        // 沒有 refreshToken 視為需要重新登入
        if (onRefreshFailed) {
          onRefreshFailed();
        }
        
        return false;
      }

      if (!accessToken) {
        console.log('[TokenRefreshService] ⚠️ 沒有找到 accessToken，跳過刷新');
        onProgress?.(false);
        this.isRefreshing = false;
        if (onRefreshFailed) {
          onRefreshFailed();
        }
        return false;
      }

      console.log('[TokenRefreshService] ✓ 找到 refreshToken，長度:', refreshToken.length);
      console.log('[TokenRefreshService] 📝 RefreshToken 前 20 字元:', refreshToken.substring(0, 20) + '...');

      // 4. 調用刷新 API（後端要求傳 refreshToken + accessToken）
      const result = await refreshXStoryToken({
        refreshToken,
        accessToken,
      });

      if (result.ok) {
        // 保存新的 accessToken
        await tokenStorage.setStoreToken(result.accessToken);
        // 若後端實作 Refresh Token 輪換（refreshed: true），會回傳新 refreshToken，必須儲存否則下次刷新會授權失敗
        if (result.refreshToken) {
          await tokenStorage.setRefreshToken(result.refreshToken);
          console.log('[TokenRefreshService] ✅ 已儲存後端回傳的新 refreshToken');
        }

        // 記錄本次刷新時間
        await tokenStorage.setLastRefreshTime();

        console.log('[TokenRefreshService] ✅ Token 刷新完成並已保存');
        
        // 離開 progress state
        onProgress?.(false);
        this.isRefreshing = false;
        return true;
      }

      // 區分「權限過期」與「網路錯誤」：僅權限過期時登出，網路錯誤不登出
      onProgress?.(false);
      this.isRefreshing = false;

      if (result.reason === 'network_error') {
        console.warn('[TokenRefreshService] ⚠️ 刷新因網路異常失敗，不登出，可稍後再試');
        if (onNetworkError) {
          onNetworkError();
        }
        return false;
      }

      // token_invalid：權限過期或 refreshToken 無效
      console.error('[TokenRefreshService] ❌ Token 刷新失敗（權限過期），未獲得新的 token');
      if (onRefreshFailed) {
        onRefreshFailed();
      }
      return false;
    } catch (error) {
      console.error('[TokenRefreshService] ❌ Token 刷新失敗:', error);
      onProgress?.(false);
      this.isRefreshing = false;
      // 捕獲到的異常（如非 API 回傳的錯誤）保守視為權限問題，仍觸發登出
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
