// suspensionGuard.ts
//
// 「停權強制驅離」的協調層 —— 與 sessionAuth 相同的「葉子模組」模式，
// 刻意不 import api.ts / userApiClient.ts / React 端，用來打斷循環相依：
//   - api.ts（RestfulApi）在「每一支帶 Authorization 的請求」送出時呼叫 pingSuspensionGuard()。
//   - userApiClient.ts 啟動時把「實際的停權檢查實作」（checkAccountSuspended）註冊進來。
//   - _layout.tsx（React 端）把「停權 → 提示並登出」的 UI 處理註冊進來。
//
// 需求（2026-08）：只要後端把 roleLevel 標成 <= 0（0 或負數，即停權／封鎖），
// 任何需要 token 的 API 流程都必須強制驅離——跳出停權提示、按確認後登出。
// 這裡以「節流 + 單飛 + 閂鎖」實作：帶 token 的 API 活動會觸發背景停權重查，
// 最快每 THROTTLE_MS 一次，確保停權者在 App 內持續操作時，於一個節流窗內被驅離，
// 而不必等到 App 重啟或 token 喚醒刷新。

type SuspensionChecker = () => Promise<boolean>;
type SuspendedHandler = () => void;

// 停權重查的節流間隔。帶 token 的 API 呼叫最快每隔這段時間觸發一次 api/users/me 重查，
// 在「即時驅離」與「不放大後端流量」間取捨；調整驅離靈敏度只需改這裡。
const THROTTLE_MS = 60 * 1000;

let checker: SuspensionChecker | null = null;
let onSuspended: SuspendedHandler | null = null;

let lastCheckAt = 0; // 上次發起重查的時間（ms）；0 = 尚未查過
let inFlight = false; // 單飛：重查進行中不再疊加（checker 自身的 profile 請求也會 ping，靠此防遞迴）
// 防止重複觸發驅離 UI：驅離一次後上鎖，登入成功（Storage.saveLoginData）時解鎖。
let suspendedNotified = false;

/**
 * 註冊實際的停權檢查實作（由 userApiClient 提供 checkAccountSuspended：
 * 僅在後端「明確回傳」roleLevel <= 0 時回 true；取不到 profile 回 false，不誤殺）。
 */
export function registerSuspensionChecker(fn: SuspensionChecker): void {
  checker = fn;
}

/**
 * 註冊「已停權」時的 UI 處理（由 _layout 提供：顯示停權 alert、確認後清資料、setIsLoggedIn(false)）。
 */
export function registerSuspendedHandler(fn: SuspendedHandler): void {
  onSuspended = fn;
}

/**
 * 重新解除「已通知停權」閂鎖並重置節流。登入成功後呼叫，
 * 讓新帳號（或解除停權後重新登入的帳號）能重新受監控、再次停權時仍能提示。
 */
export function resetSuspensionLatch(): void {
  suspendedNotified = false;
  lastCheckAt = 0;
}

/**
 * 帶 Authorization 的 API 活動心跳：由 RestfulApi 於每支帶 token 的請求呼叫。
 * 同步返回、不阻塞原請求；節流窗口內或已在重查中則直接略過。
 * 查得停權（roleLevel <= 0）→ 去重地觸發一次驅離 UI。
 */
export function pingSuspensionGuard(): void {
  if (!checker || suspendedNotified || inFlight) return;
  const now = Date.now();
  if (now - lastCheckAt < THROTTLE_MS) return;
  lastCheckAt = now;
  inFlight = true;

  checker()
    .then((suspended) => {
      if (!suspended || suspendedNotified) return;
      suspendedNotified = true;
      try {
        onSuspended?.();
      } catch (e) {
        console.error('[suspensionGuard] onSuspended 執行失敗:', e);
      }
    })
    .catch((e) => {
      // 檢查失敗（網路異常等）不視為停權；下個節流窗會再試。
      console.warn('[suspensionGuard] 停權重查例外（忽略）:', (e as any)?.message);
    })
    .finally(() => {
      inFlight = false;
    });
}
