// app/auth/verifyRedirect.ts
// 驗證信箱成功後，通知登入容器切換到「會員 Email 登入頁」。
// deep link 在 _layout 處理，但登入子畫面狀態在 LoginContainer 內部，
// 故以簡易的 module 訂閱模式跨層通知（沿用 firstLoginRedirect 的 module 模式，另加事件回呼）。

type Listener = () => void;
const listeners = new Set<Listener>();

/** 訂閱驗證成功事件，回傳解除訂閱函式 */
export function subscribeVerifyRedirect(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** 發出驗證成功事件，通知所有訂閱者（例如 LoginContainer 切換到 Email 登入頁） */
export function emitVerifyRedirect(): void {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // 忽略單一訂閱者錯誤，避免影響其他訂閱者
    }
  });
}
