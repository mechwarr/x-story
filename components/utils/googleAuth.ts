import { Platform } from 'react-native';
import {
  GoogleSignin,
  statusCodes,
  type User as GoogleUser,
} from '@react-native-google-signin/google-signin';

export type GoogleAuthOk = {
  ok: true;
  user: GoogleUser;
  idToken?: string | null;
  accessToken?: string | null;     // 由 getTokens() 取得
  serverAuthCode?: string | null;  // 需要 offlineAccess 時給後端換 token
};

export type GoogleAuthCancel = {
  ok: false;
  reason: 'cancelled';
};

export type GoogleAuthError = {
  ok: false;
  reason: 'error';
  code?: string;
  message?: string;
};

export type GoogleAuthResult = GoogleAuthOk | GoogleAuthCancel | GoogleAuthError;

// iOS Client ID - 必須與 Info.plist 中的 GIDClientID 一致
const IOS_CLIENT_ID = '927761409049-66o2rujvgaoaovopb4q3mvev3kceej95.apps.googleusercontent.com';
const WEB_CLIENT_ID = '927761409049-nukfc1nb5bckdm6q696cfo0b8vmtrl5j.apps.googleusercontent.com';

let configured = false;

export function configureGoogleSignIn() {
  if (configured) return;
  
  const config = {
    iosClientId: IOS_CLIENT_ID,
    webClientId: WEB_CLIENT_ID,
    offlineAccess: true,
    forceCodeForRefreshToken: true,
  };
  
  console.log('[Google Auth] 配置 Google Sign In:', {
    platform: Platform.OS,
    iosClientId: config.iosClientId,
    webClientId: config.webClientId,
    offlineAccess: config.offlineAccess,
    forceCodeForRefreshToken: config.forceCodeForRefreshToken,
  });
  
  GoogleSignin.configure(config);
  configured = true;
  console.log('[Google Auth] ✅ Google Sign In 配置完成');
}

export async function googleSignInInteractive(): Promise<GoogleAuthResult> {
  try {
    console.log('[Google Auth] ========== 開始互動式登入 ==========');
    configureGoogleSignIn();

    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }

    // 如果你「每次都要重新選帳號」，可以保留這兩行；否則建議移除以降低失敗率
    // await GoogleSignin.signOut();
    // await GoogleSignin.revokeAccess();

    console.log('[Google Auth] 準備調用 GoogleSignin.signIn()，應該會顯示登入視窗...');
    console.log('[Google Auth] ⚠️ 如果沒有看到登入視窗，可能是配置問題');
    
    const res = await GoogleSignin.signIn(); // 注意：套件返回 { type, data? } 但我們只關心成功/取消
    
    console.log('[Google Auth] GoogleSignin.signIn() 回應:', {
      type: (res as any)?.type,
      hasData: !!(res as any)?.data,
      dataKeys: (res as any)?.data ? Object.keys((res as any).data) : [],
    });

    // 成功：把結構轉成應用端慣用格式
    // 官方型別：{ type: 'success', data: User } | { type: 'cancelled' }
    if ((res as any)?.type === 'success' && (res as any)?.data) {
      const user = (res as any).data as GoogleUser;

      // 需要 idToken/accessToken 可接著呼叫 getTokens()
      // iOS 上 signIn() 後需要等待一小段時間才能取得 token
      if (Platform.OS === 'ios') {
        console.log('[Google Auth] iOS 登入成功，等待 300ms 後取得 tokens...');
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      let tokens: { idToken?: string | null; accessToken?: string | null } = {};
      try {
        tokens = await getGoogleTokens(); // iOS 需要額外取；Android 也可統一用這招
        if (Platform.OS === 'ios') {
          console.log('[Google Auth] iOS 互動登入後取得 tokens:', {
            hasIdToken: !!tokens.idToken,
            hasAccessToken: !!tokens.accessToken,
            idTokenLength: tokens.idToken?.length || 0,
            accessTokenLength: tokens.accessToken?.length || 0,
            tokensObject: JSON.stringify(tokens, null, 2),
          });
        }
      } catch (err: any) {
        // 記錄錯誤但不中斷流程，讓呼叫端有機會重試
        console.error('[Google Auth] 互動登入後 getTokens 失敗:', {
          code: err?.code,
          message: err?.message || err,
          error: err,
        });
      }

      // 檢查是否有有效的 idToken
      if (!tokens.idToken || tokens.idToken.length === 0) {
        console.error('[Google Auth] 互動登入成功但沒有有效的 idToken');
        return {
          ok: false,
          reason: 'error',
          code: 'NO_ID_TOKEN',
          message: '登入成功但無法取得有效的登入憑證',
        };
      }

      return {
        ok: true,
        user,
        idToken: tokens.idToken,
        accessToken: tokens.accessToken,
        serverAuthCode: (user as any)?.serverAuthCode ?? null,
      };
    }

    // 取消登入
    console.log('[Google Auth] 使用者取消登入');
    return { ok: false, reason: 'cancelled' };
  } catch (err: any) {
    // 套件常見錯誤代碼處理
    if (err?.code === statusCodes.SIGN_IN_CANCELLED) {
      return { ok: false, reason: 'cancelled' };
    }
    return {
      ok: false,
      reason: 'error',
      code: err?.code,
      message: String(err?.message ?? err),
    };
  }
}

/** 靜默登入（若裝置上已有紀錄，無需互動） */
export async function googleSignInSilently(): Promise<GoogleAuthResult> {
  try {
    console.log('[Google Auth] ========== 開始靜默登入 ==========');
    configureGoogleSignIn();
    console.log('[Google Auth] 調用 GoogleSignin.signInSilently()...');
    const res = await GoogleSignin.signInSilently(); // 套件會回 { type:'success', data } | 拋出 SIGN_IN_REQUIRED
    
    console.log('[Google Auth] signInSilently() 回應:', {
      type: (res as any)?.type,
      hasData: !!(res as any)?.data,
    });
    
    if ((res as any)?.type === 'success' && (res as any)?.data) {
      const user = (res as any).data as GoogleUser;
      // iOS 上 signInSilently() 後也需要等待一小段時間才能取得 token
      if (Platform.OS === 'ios') {
        console.log('[Google Auth] iOS 靜默登入成功，等待 300ms 後取得 tokens...');
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      let tokens: { idToken?: string | null; accessToken?: string | null } = {};
      try {
        tokens = await getGoogleTokens();
        if (Platform.OS === 'ios') {
          console.log('[Google Auth] iOS 靜默登入後取得 tokens:', {
            hasIdToken: !!tokens.idToken,
            hasAccessToken: !!tokens.accessToken,
            idTokenLength: tokens.idToken?.length || 0,
            accessTokenLength: tokens.accessToken?.length || 0,
            tokensObject: JSON.stringify(tokens, null, 2),
          });
        }
      } catch (err: any) {
        // 記錄錯誤但不中斷流程，讓呼叫端有機會重試
        console.error('[Google Auth] 靜默登入後 getTokens 失敗:', {
          code: err?.code,
          message: err?.message || err,
          error: err,
        });
      }
      // 檢查是否有有效的 idToken
      if (!tokens.idToken || tokens.idToken.length === 0) {
        console.warn('[Google Auth] 靜默登入成功但沒有有效的 idToken，視為失敗');
        return { ok: false, reason: 'cancelled' };
      }
      
      return { ok: true, user, idToken: tokens.idToken, accessToken: tokens.accessToken };
    }
    console.log('[Google Auth] 靜默登入返回 cancelled（未找到已儲存憑證）');
    return { ok: false, reason: 'cancelled' }; // 極少見（大多數情況會 throw）
  } catch (err: any) {
    console.log('[Google Auth] 靜默登入拋出錯誤:', {
      code: err?.code,
      message: err?.message || err,
      errorType: err?.constructor?.name,
    });
    // 沒有已儲存憑證／需要互動 → 視為取消（由呼叫端決定是否改成互動式登入）
    return { ok: false, reason: 'cancelled' };
  }
}

/** 取得 idToken / accessToken（跨 iOS/Android 統一） */
export async function getGoogleTokens(retryCount = 0, maxRetries = 2): Promise<{
  idToken?: string | null;
  accessToken?: string | null;
}> {
  configureGoogleSignIn();
  
  try {
    console.log(`[Google Auth] 開始取得 tokens (嘗試 ${retryCount + 1}/${maxRetries + 1})...`);
    const tokens = await GoogleSignin.getTokens(); // 套件已做平台差異處理
    
    console.log(`[Google Auth] getTokens 回應:`, {
      platform: Platform.OS,
      hasIdToken: !!tokens.idToken,
      hasAccessToken: !!tokens.accessToken,
      idTokenLength: tokens.idToken?.length || 0,
      accessTokenLength: tokens.accessToken?.length || 0,
      idTokenPreview: tokens.idToken ? tokens.idToken.substring(0, 50) + '...' : null,
    });
    
    // iOS 上如果 token 為空，可能需要等待一小段時間後重試
    if (Platform.OS === 'ios' && !tokens.idToken && retryCount < maxRetries) {
      const delay = 500 * (retryCount + 1);
      console.log(`[Google Auth] iOS token 為空，${delay}ms 後重試 (${retryCount + 1}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return getGoogleTokens(retryCount + 1, maxRetries);
    }
    
    return tokens;
  } catch (error: any) {
    console.error(`[Google Auth] getTokens 拋出錯誤 (嘗試 ${retryCount + 1}/${maxRetries + 1}):`, {
      platform: Platform.OS,
      code: error?.code,
      message: error?.message || error,
      error: error,
    });
    
    // 如果是 iOS 且還有重試次數，則重試
    if (Platform.OS === 'ios' && retryCount < maxRetries) {
      const delay = 500 * (retryCount + 1);
      console.log(`[Google Auth] iOS getTokens 失敗，${delay}ms 後重試 (${retryCount + 1}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return getGoogleTokens(retryCount + 1, maxRetries);
    }
    
    // 記錄錯誤並拋出，讓呼叫端處理
    console.error('[Google Auth] getTokens 最終失敗:', {
      platform: Platform.OS,
      code: error?.code,
      message: error?.message || error,
      retryCount,
      maxRetries,
    });
    throw error;
  }
}

/** 登出（不會撤銷同意，只是登出本機） */
export async function googleSignOut(): Promise<void> {
  configureGoogleSignIn();
  await GoogleSignin.signOut();
}

/** 撤銷授權（下次會強制再走同意流程） */
export async function googleRevoke(): Promise<void> {
  configureGoogleSignIn();
  await GoogleSignin.revokeAccess();
}

/** 便利函式：取得目前已登入使用者（若存在） */
export function getCurrentGoogleUser() {
  configureGoogleSignIn();
  return GoogleSignin.getCurrentUser(); // 可能為 null
}

/** ====== 4) 偵錯用：打印結構 ====== */
export function debugPrintGoogleUser(prefix = 'Google user') {
  const user = getCurrentGoogleUser();
  // 注意：這裡不是 async，僅打印目前快取的 user（若剛登入，建議直接用函式回傳值）
  // 要更完整的可在登入時：console.log(JSON.stringify(result, null, 2))
  console.log(prefix, user ? JSON.stringify(user, null, 2) : 'no user');
}