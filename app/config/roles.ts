// roles.ts
// 角色權限級別（roleLevel）集中定義，避免 magic number 散落各處。
// roleLevel 由後端 api/users/me 回傳，登入時快取於 SecureStore（見 auth/Storage.ts）。

/**
 * 已知的權限級別。後端為數值權限，數字越大權限越高。
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
 * 可檢視「未上架書籍」並改打後台書店清單 API（GET api/admin/bookstores）的最低權限級別。
 * 需求：role >= 9（僅 Admin）。GET api/admin/bookstores 為管理員專用 API，
 * 故只有 Admin 才改打後台清單；role 6（含其他 < 9 角色）一律視為一般用戶、
 * 走公開的 GET api/bookstorelist，避免對後台端點發出會被 401/403 拒絕的請求。
 */
export const UNLISTED_VISIBILITY_MIN_LEVEL = 9;

/**
 * 可使用「場次快速切換器」（播放頭部把手切換場次）的最低權限級別。
 * 需求：role >= 9（僅 Admin）。與 UNLISTED_VISIBILITY_MIN_LEVEL 同值但語意不同，
 * 各自獨立以免日後其中一項門檻調整時互相牽連。
 */
export const SCREENING_SWITCH_MIN_LEVEL = 9;

/**
 * 是否為 Admin（roleLevel >= 9）。
 */
export function isAdmin(roleLevel: number | null | undefined): boolean {
  return Number(roleLevel) >= ROLE.ADMIN;
}

/**
 * 是否可使用場次快速切換器（roleLevel >= 9，僅 Admin）。
 * null / undefined / 非數值一律視為無權限。
 */
export function canSwitchScreening(roleLevel: number | null | undefined): boolean {
  return Number(roleLevel) >= SCREENING_SWITCH_MIN_LEVEL;
}

/**
 * 是否可檢視未上架書籍 / 使用後台書店清單（roleLevel >= 6）。
 * null / undefined / 非數值一律視為無權限。
 */
export function canViewUnlisted(roleLevel: number | null | undefined): boolean {
  return Number(roleLevel) >= UNLISTED_VISIBILITY_MIN_LEVEL;
}
