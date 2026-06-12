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
 * 需求：role > 5（即 >= 6）才滿足。
 * 注意：後端 api/admin/bookstores 必須同步放寬至此門檻（>= 6），否則低於 9 的角色會收到 403。
 */
export const UNLISTED_VISIBILITY_MIN_LEVEL = 6;

/**
 * 可使用「場次快速切換器」（播放頭部下拉切換場次）的最低權限級別。
 * 需求：role >= 6。與 UNLISTED_VISIBILITY_MIN_LEVEL 同值但語意不同，
 * 各自獨立以免日後其中一項門檻調整時互相牽連。
 */
export const SCREENING_SWITCH_MIN_LEVEL = 6;

/**
 * 是否為 Admin（roleLevel >= 9）。
 */
export function isAdmin(roleLevel: number | null | undefined): boolean {
  return Number(roleLevel) >= ROLE.ADMIN;
}

/**
 * 是否可使用場次快速切換器（roleLevel >= 6）。
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
