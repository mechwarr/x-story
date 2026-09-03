// roles.ts
// 角色權限級別（roleLevel）集中定義，避免 magic number 散落各處。
// roleLevel 由後端 api/users/me 回傳，登入時快取於 SecureStore（見 auth/Storage.ts）。

/**
 * 已知的權限級別。後端為數值權限，數字越大權限越高。
 *  <= 0 = 停權／封鎖（含 0 與負數；登入攔截見 auth/LoginContainer.js，
 *         登入後即時攔截見 userApiClient.checkAccountSuspended）
 *  1 = 普通用戶
 *  5 = 小編
 *  9 = Admin
 */
export const ROLE = {
  USER: 1,
  EDITOR: 5,
  ADMIN: 9,
} as const;

/**
 * 可檢視「未上架 / 未開放書籍」並改打後台書店清單 API（GET api/admin/bookstores）的最低權限級別。
 * 需求：role >= 5（小編以上）。小編／管理員皆可預覽即將上架、下架的書籍版面。
 * 注意：GET api/admin/bookstores 需後端同步開放給 role >= 5，否則 role 5~8 呼叫會被 401/403，
 * HomeScreen 會靜默退回公開清單（僅上架書籍），未上架書即看不到——此為後端相依項。
 */
export const UNLISTED_VISIBILITY_MIN_LEVEL = ROLE.EDITOR;

/**
 * 可「不需購買、不受試閱設定限制，完整預覽任何書籍的場次／章節」的最低權限級別。
 * 需求：role >= 5（小編以上）。用於未開放書籍開書、章節閱讀閘門、試閱截斷等的繞過判斷。
 */
export const PREVIEW_ALL_MIN_LEVEL = ROLE.EDITOR;

/**
 * 可使用「場次快速切換器」（播放頭部把手切換場次）的最低權限級別。
 * 需求：role > 1（普通用戶以上皆可）。與預覽權限（>= 5）刻意分離、各自獨立：
 * role 2~4 沒有 canPreviewAll，可選場次仍受試閱截斷／購買閘門限制，跳不進付費內容。
 */
export const SCREENING_SWITCH_MIN_LEVEL = 2;

/**
 * 是否為 Admin（roleLevel >= 9）。
 */
export function isAdmin(roleLevel: number | null | undefined): boolean {
  return Number(roleLevel) >= ROLE.ADMIN;
}

/**
 * 是否可完整預覽所有書籍的場次／章節（roleLevel >= 5，小編以上）：
 * 不需購買、不受試閱（free_open）設定限制。null / undefined / 非數值一律視為無權限。
 */
export function canPreviewAll(roleLevel: number | null | undefined): boolean {
  return Number(roleLevel) >= PREVIEW_ALL_MIN_LEVEL;
}

/**
 * 是否可使用場次快速切換器（roleLevel > 1，普通用戶以上）。
 * null / undefined / 非數值一律視為無權限。
 */
export function canSwitchScreening(roleLevel: number | null | undefined): boolean {
  return Number(roleLevel) >= SCREENING_SWITCH_MIN_LEVEL;
}

/**
 * 是否可檢視未上架 / 未開放書籍 / 使用後台書店清單（roleLevel >= 5，小編以上）。
 * null / undefined / 非數值一律視為無權限。
 */
export function canViewUnlisted(roleLevel: number | null | undefined): boolean {
  return Number(roleLevel) >= UNLISTED_VISIBILITY_MIN_LEVEL;
}
