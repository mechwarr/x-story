// app/auth/facebookAuth.js
import { Platform } from "react-native";
import { AccessToken, LoginManager, AuthenticationToken } from "react-native-fbsdk-next";
import { sha256 } from "js-sha256";


/**
 * 傳統 Facebook 登入（拿 accessToken）
 * - iOS/Android 都可用；若你要 iOS 走 Limited Login，請改用 facebookLimitedLoginIOS()
 * - iOS 這裡強制 loginTracking = 'enabled'，避免意外走到 Limited Login。
 * @returns {Promise<string|null>} accessToken（成功）或 null（取消/失敗）
 */
export async function facebookLogin() {
  try {
    console.log("[FB Classic Login] 開始傳統 Facebook 登入");
    // 先登出以清除殘留 session，避免「已登入但 token 無效」導致流程卡住
    LoginManager.logOut();

    const loginTracking = "enabled"; // 關鍵：避免 iOS 走 Limited Login
    const result = await LoginManager.logInWithPermissions(
      ["public_profile", "email"],
      loginTracking
    );

    console.log("[FB Classic Login] 登入結果:", {
      isCancelled: result?.isCancelled,
      grantedPermissions: result?.grantedPermissions,
    });

    if (result?.isCancelled) {
      console.log("[FB Classic Login] 使用者取消登入");
      return null; // 使用者取消
    }

    const data = await AccessToken.getCurrentAccessToken();
    if (!data?.accessToken) {
      console.error("[FB Classic Login] 未取得 accessToken");
      throw new Error("Facebook 登入後未取得 access token，請重試");
    }

    console.log("[FB Classic Login] 成功取得 accessToken，長度:", data.accessToken.toString().length);
    // ✅ 回傳 accessToken（送往後端 /facebook-login 驗證）
    return data.accessToken.toString();
  } catch (error) {
    console.error("[FB Classic Login] 發生錯誤:", error?.message || error);
    // 讓呼叫端可區分「取消」與「錯誤」：取消不拋出，其餘拋出以顯示提示
    const msg = error?.message || String(error);
    if (msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("取消")) {
      return null;
    }
    throw error;
  }
}

/** 產生 raw nonce（原始字串，用於防重放；要保留給後端比對） */
function generateNonce(length = 32) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < length; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

/**
 * iOS 限制登入（Limited Login）
 * 回傳給呼叫端：{ idToken, rawNonce }
 *   - idToken：= authenticationToken（JWT；就是你要的 id_token）
 *   - rawNonce：你送入前的原始 nonce（未 SHA256），給後端比對
 */

export async function facebookLimitedLoginIOS() {
  if (Platform.OS !== "ios") {
    console.warn("facebookLimitedLoginIOS 只支援 iOS");
    return null;
  }

  try {
    // 先登出以清除殘留 session
    LoginManager.logOut();

    // 1) 產生 rawNonce
    const rawNonce = generateNonce();
    const nonceForSDK = sha256(rawNonce);
    console.log("[FB LimitedLogin] rawNonce =", rawNonce);
    console.log("[FB LimitedLogin] nonceForSDK (sha256) =", nonceForSDK);

    // 2) 發起 Limited Login
    const result = await LoginManager.logInWithPermissions(
      ["public_profile", "email"],
      "limited",
      nonceForSDK
    );
    console.log("[FB LimitedLogin] result =", result);

    if (result?.isCancelled) {
      console.warn("[FB LimitedLogin] 使用者取消登入");
      return null;
    }

    // 3) 取得 AuthenticationToken (id_token)
    const auth = await AuthenticationToken.getAuthenticationTokenIOS();
    console.log("[FB LimitedLogin] AuthenticationToken =", auth);

    const idToken = auth?.authenticationToken;
    if (!idToken) {
      console.error("[FB LimitedLogin] 未取得 idToken (authenticationToken 為空)");
      throw new Error("Facebook 登入後未取得 id token，請重試");
    }

    console.log("[FB LimitedLogin] idToken(JWT) 長度 =", idToken.length);

    return { idToken, rawNonce };
  } catch (e) {
    console.error("[FB LimitedLogin] error =", e);
    const msg = e?.message || String(e);
    if (msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("取消")) {
      return null;
    }
    throw e;
  }
}