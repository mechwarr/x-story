// app/utils/birthday.ts
// 生日的解析與「是否已填寫」判定——LoginContainer（首次登入導向）與 ProfileScreen
// （顯示／任務獎勵 CTA）共用同一套規則，避免兩邊判定不一致。
//
// 「已填寫」的定義：能解析成真實存在的日曆日，且落在日期滾輪的可選範圍內
// （今天往前 BIRTHDAY_YEAR_SPAN 年 ～ 今天）。只看「欄位非空」是不夠的：
// 後端對未填生日的帳號可能回佔位值（"0000-00-00"、"1900-01-01"、時間戳 0 等），
// 非空判定會把它們當成「已填」，新註冊帳號就不會被導向個人資料頁。

/** 生日可選年數（今天往前推）；DatePickerSheet 的年份下限沿用此值 */
export const BIRTHDAY_YEAR_SPAN = 120;

/** 以本地年月日建構 Date，並驗證沒有溢位（2 月 30 日、0 月 0 日等會被 JS 自動進位） */
function buildLocalDate(y: number, m: number, d: number): Date | null {
  // new Date(0~99, ...) 會被當成 1900~1999，直接排除
  if (y < 100) return null;
  const dt = new Date(y, m - 1, d);
  if (isNaN(dt.getTime())) return null;
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

/**
 * 容錯解析後端生日 → 本地 Date（解析不出來回 null）。不含範圍檢查，見 parseValidBirthday。
 * Hermes 的 new Date() 只吃嚴格 ISO，後端若回 "YYYY-MM-DD HH:mm:ss"（空格）、
 * "YYYY/MM/DD"、含時區位移（+08:00 / Z）、Unix 時間戳等格式都要能還原，
 * 故優先用正則從字串中擷取年月日，並以本地時間建構，
 * 避免 UTC 午夜在不同時區造成差一天。
 */
export function parseBirthdayString(raw?: string | number | null): Date | null {
  if (raw === null || raw === undefined) return null;

  // Unix 時間戳（數字或純數字字串）：絕對值 < 1e11 視為秒、否則視為毫秒
  // （1e11 秒 ≈ 西元 5138 年，1e11 毫秒 ≈ 1973 年；1970 年前出生者的時間戳為負數）。
  // 0 是「未設定」的常見佔位值（= 1970-01-01T00:00Z），不當成生日。
  if (typeof raw === 'number' || /^-?\d+$/.test(String(raw).trim())) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n === 0) return null;
    const dt = new Date(Math.abs(n) < 1e11 ? n * 1000 : n);
    return isNaN(dt.getTime()) ? null : dt;
  }

  const s = String(raw).trim();
  if (!s) return null;

  // 從字串任意位置擷取第一段 YYYY-MM-DD / YYYY/MM/DD（涵蓋帶時間、時區、空格分隔等）
  const m = s.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  // 有擷取到年月日就以它為準；不合法（如 0000-00-00）直接回 null，不再交給原生解析
  if (m) return buildLocalDate(Number(m[1]), Number(m[2]), Number(m[3]));

  const fallback = new Date(s); // 退路：完整 ISO 交給原生解析
  return isNaN(fallback.getTime()) ? null : fallback;
}

/** 解析並檢查範圍：回傳「使用者真的填過」的生日，否則 null（佔位值、未來日期、過久遠皆視為未填） */
export function parseValidBirthday(raw?: string | number | null, now: Date = new Date()): Date | null {
  const dt = parseBirthdayString(raw);
  if (!dt) return null;
  const lower = new Date(now.getFullYear() - BIRTHDAY_YEAR_SPAN, 0, 1);
  if (dt.getTime() < lower.getTime() || dt.getTime() > now.getTime()) return null;
  return dt;
}

/** 後端生日欄位是否為有效的已填生日 */
export function hasValidBirthday(raw?: string | number | null): boolean {
  return parseValidBirthday(raw) !== null;
}
