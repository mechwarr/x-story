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
 * - logged_out → 本機已無 refreshToken／accessToken（已登出或尚未登入）。登出瞬間仍在飛的請求
 *   會帶著舊 token 回 401 而走到這裡，屬預期失敗，不可當成「權限過期」跳窗。
 */
export type ReauthOutcome =
  | { ok: true; accessToken: string }
  | { ok: false; reason: 'token_invalid' | 'network_error' | 'logged_out' };

type Reauthenticator = () => Promise<ReauthOutcome>;
type SessionExpiredHandler = () => void;

let reauthenticator: Reauthenticator | null = null;
let onSessionExpired: SessionExpiredHandler | null = null;

// 防止同一波併發 401 觸發多次「權限過期」登出 UI。
// 登入成功（Storage.saveLoginData）或任一次刷新成功時會重新解除閂鎖。
//
// 這把鎖由「被動式（401 刷新失敗）」與「主動式（冷啟動／喚醒刷新失敗、超過 30 天）」共用：
// 過去主動式路徑直接呼叫自己的 callback、不經過這裡，導致同一次過期在兩條路徑各跳一則，
// 第二則會在使用者按下第一則的 OK 登出後，顯示在登入頁／重設密碼頁上。
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
 * 去重地「取用一次過期通知權」：未通知過 → 上鎖並回 true（呼叫端負責跳窗）；
 * 已通知過 → 回 false（不要再跳第二則）。
 * 主動式路徑（authApiClient.refreshToken 的 onLoginExpired / onRefreshFailed）與
 * 被動式路徑（attemptReauth）都必須經過這裡，才能保證「一次過期只提示一次」。
 */
export function claimSessionExpiredNotice(): boolean {
  if (sessionExpiredNotified) return false;
  sessionExpiredNotified = true;
  return true;
}

/**
 * 直接上鎖但不跳窗。登出時（clearAllUserData）呼叫：
 * 登出瞬間仍在飛的請求會帶著舊 token 回 401，那是預期中的失敗，
 * 不該在使用者已經回到登入頁後，再彈一則「帳戶權限過期」嚇人。
 * 下次登入成功（Storage.saveLoginData → resetSessionExpiredLatch）會解鎖。
 */
export function markSessionExpired(): void {
  sessionExpiredNotified = true;
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

  // logged_out（本機已無 token）不是權限過期，靜默略過；network_error 亦不登出。
  if (outcome.reason === 'token_invalid' && claimSessionExpiredNotice()) {
    try {
      onSessionExpired?.();
    } catch (e) {
      console.error('[sessionAuth] onSessionExpired 執行失敗:', e);
    }
  }

  return outcome;
}
