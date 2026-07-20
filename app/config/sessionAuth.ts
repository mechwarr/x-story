// sessionAuth.ts
//
// 「被動式（reactive）Token 刷新」的協調層 —— 這是一個「葉子模組」，
// 刻意不 import api.ts 或 authApiClient.ts，用來打斷兩者的循環相依：
//   - api.ts（RestfulApi）在收到 401 時呼叫 attemptReauth()，但不需要認識 authApiClient。
//   - authApiClient.ts（tokenRefreshService）啟動時把「實際的刷新實作」註冊進來。
//   - _layout.tsx（React 端）把「權限過期→登出 UI」的處理註冊進來。
//
// 為什麼需要這層：資料型 API 平時各自手動帶 Authorization header 打 fetch，
// 過去 401 只會被各 caller 默默吞掉、畫面停在舊資料。這裡提供一個「單飛（single-flight）」
// 的重新驗證入口，讓「APP 開著發呆很久→token 過期→用戶切頁面觸發多支 API」時，
// 只會刷新一次 token，並把結果分享給所有等待中的請求。

/**
 * 重新驗證（刷新 token）的結果。
 * - ok:true  → 已取得新的 accessToken，呼叫端可用它重試原請求。
 * - token_invalid → refreshToken 失效／權限過期，應登出重新登入。
 * - network_error → 網路異常，不應登出（避免離線或網路未就緒時把用戶踢出去），原請求照常失敗即可。
 */
export type ReauthOutcome =
  | { ok: true; accessToken: string }
  | { ok: false; reason: 'token_invalid' | 'network_error' };

type Reauthenticator = () => Promise<ReauthOutcome>;
type SessionExpiredHandler = () => void;

let reauthenticator: Reauthenticator | null = null;
let onSessionExpired: SessionExpiredHandler | null = null;

// 防止同一波併發 401 觸發多次「權限過期」登出 UI。
// 登入成功（Storage.saveLoginData）或任一次刷新成功時會重新解除閂鎖。
let sessionExpiredNotified = false;

/**
 * 註冊實際的刷新實作（由 authApiClient 的 tokenRefreshService 提供，需為單飛）。
 */
export function registerReauthenticator(fn: Reauthenticator): void {
  reauthenticator = fn;
}

/**
 * 註冊「權限過期」時的 UI 處理（由 _layout 提供：顯示 alert、清資料、setIsLoggedIn(false)）。
 */
export function registerSessionExpiredHandler(fn: SessionExpiredHandler): void {
  onSessionExpired = fn;
}

/**
 * 重新解除「已通知過期」閂鎖。登入成功或刷新成功後呼叫，
 * 讓之後若再發生真正的權限過期時，仍能再次提示使用者。
 */
export function resetSessionExpiredLatch(): void {
  sessionExpiredNotified = false;
}

/**
 * 嘗試重新驗證（刷新 token）。單飛與去重由 reauthenticator 內部保證；
 * 這裡只負責：在確定是「權限過期」時，去重地觸發一次登出 UI。
 *
 * 注意：network_error 不觸發登出；ok 會順帶解除過期閂鎖。
 */
export async function attemptReauth(): Promise<ReauthOutcome> {
  if (!reauthenticator) {
    // 尚未註冊（理論上不會發生，除非在 authApiClient 載入前就打 API）。
    return { ok: false, reason: 'token_invalid' };
  }

  const outcome = await reauthenticator();

  if (outcome.ok) {
    sessionExpiredNotified = false;
    return outcome;
  }

  if (outcome.reason === 'token_invalid' && !sessionExpiredNotified) {
    sessionExpiredNotified = true;
    try {
      onSessionExpired?.();
    } catch (e) {
      console.error('[sessionAuth] onSessionExpired 執行失敗:', e);
    }
  }

  return outcome;
}
