// app/auth/firstLoginRedirect.ts
// 「首次登入且個人資料未完成」→ 進入主畫面後自動導向 ProfileScreen。
// 採用 module 範圍的暫存旗標（不落盤）：
// - 僅在使用者「主動登入成功」時設定，登入後由 HomeScreen 取用一次。
// - App 冷啟動以既有 token 自動登入時不會觸發，符合「首次登入帶入」的需求。
let pendingProfileRedirect = false;

export function setPendingProfileRedirect(value: boolean): void {
  pendingProfileRedirect = value;
}

/** 取用並清除旗標（只會回傳 true 一次） */
export function consumePendingProfileRedirect(): boolean {
  const pending = pendingProfileRedirect;
  pendingProfileRedirect = false;
  return pending;
}
