// app/auth/verifyRedirect.ts
// 驗證信箱成功 / 重設密碼成功後，通知登入容器切換到「會員 Email 登入頁」。
// deep link 在 _layout 處理，但登入子畫面狀態在 LoginContainer 內部，
// 故以簡易的 module 訂閱模式跨層通知（沿用 firstLoginRedirect 的 module 模式，另加事件回呼）。

type Listener = () => void;
const listeners = new Set<Listener>();

// 事件發生時 LoginContainer 可能尚未掛載（重設密碼頁佔滿畫面時它並未 render），
// 此時先暫存，待容器掛載訂閱時補發，否則事件會被丟失、使用者仍落在註冊頁。
let pendingRedirect = false;

/** 訂閱導向事件，回傳解除訂閱函式；若先前已有未消化的事件則立即補發一次 */
export function subscribeVerifyRedirect(fn: Listener): () => void {
  listeners.add(fn);
  if (pendingRedirect) {
    pendingRedirect = false;
    try {
      fn();
    } catch {
      // 忽略單一訂閱者錯誤
    }
  }
  return () => {
    listeners.delete(fn);
  };
}

/** 發出導向事件，通知所有訂閱者（例如 LoginContainer 切換到 Email 登入頁） */
export function emitVerifyRedirect(): void {
  if (listeners.size === 0) {
    pendingRedirect = true;
    return;
  }
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // 忽略單一訂閱者錯誤，避免影響其他訂閱者
    }
  });
}
