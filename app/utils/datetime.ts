// app/utils/datetime.ts
//
// 後端回傳的時間一律視為 UTC（API 文件約定為 ISO 8601，例："2026-01-23T16:45:13.000Z"）。
// 本模組負責把「UTC 時間戳」轉成「裝置所在時區的時間」再顯示，例如台北裝置顯示為 UTC+8。
//
// 為什麼需要這個模組：
// 1. JS 的 new Date(iso).getHours() 只有在字串「帶時區標記」（Z 或 ±HH:mm）時才會正確轉本地時間。
//    後端若回傳 "2026-01-23 16:45:13"（空格、無 Z），Hermes 會解析失敗或當成「本地時間」，
//    在台北就會整整差 8 小時。本模組對缺時區標記的字串一律補當作 UTC。
// 2. Hermes 對 new Date(string) 的支援比瀏覽器嚴格，故改用正則自行解析，不依賴原生解析。
// 3. 格式化全程使用 Date 的本地取值方法（getFullYear/getHours…），不依賴 Intl，
//    Hermes 上 Intl.DateTimeFormat 的 timeZone 支援不一致，避免踩雷。

import * as RNLocalize from 'react-native-localize';

// ---------------------------------------------------------------- 型別

/** 可被解析的時間輸入：ISO 字串、"YYYY-MM-DD HH:mm:ss"、epoch 秒／毫秒 */
export type ServerTimeInput = string | number | null | undefined;

export interface ParseOptions {
  /**
   * 字串沒有帶時區標記（Z / ±HH:mm）時，要視為 UTC 還是裝置本地時間。
   * 預設 'utc'——符合本專案「後端一律回 UTC」的約定。
   */
  assumeWhenNoZone?: 'utc' | 'local';
  /**
   * 純日期字串（"YYYY-MM-DD"，例如生日）要不要當成「本地日曆日」。
   * 預設 true：避免在 UTC- 時區把 1995-08-05 顯示成 1995-08-04。
   */
  dateOnlyAsLocal?: boolean;
}

export interface DeviceTimeZoneInfo {
  /** IANA 時區名，例如 "Asia/Taipei"；取不到時為 null */
  timeZone: string | null;
  /** 相對 UTC 的分鐘數，東為正。台北 = 480 */
  offsetMinutes: number;
  /** 人類可讀標籤，例如 "UTC+8"、"UTC+5:45"、"UTC-4" */
  offsetLabel: string;
}

// ---------------------------------------------------------------- 裝置時區

/**
 * 取得裝置的 IANA 時區名（例如 "Asia/Taipei"）。
 * 原生模組不存在或拋錯時回 null——呼叫端不該因此壞掉，
 * 因為真正的換算靠 getUtcOffsetMinutes()，不需要時區名。
 */
export function getDeviceTimeZone(): string | null {
  try {
    const tz = RNLocalize.getTimeZone();
    return tz && tz.length > 0 ? tz : null;
  } catch {
    // 退路：Hermes 若有 Intl 就用它，仍失敗則放棄（不影響換算）
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
    } catch {
      return null;
    }
  }
}

/**
 * 取得裝置相對 UTC 的偏移分鐘數，東為正（台北 = 480）。
 *
 * 一定要傳入「當下要換算的那個時刻」，不要用現在時間去套過去的時間戳——
 * 有日光節約的地區（如美國、歐洲）偏移量會隨日期改變。
 */
export function getUtcOffsetMinutes(at: Date = new Date()): number {
  // getTimezoneOffset() 的定義是「UTC 減本地」的分鐘數，西為正，故取負號轉成東為正
  return -at.getTimezoneOffset();
}

/** 把偏移分鐘數格式化成 "UTC+8" / "UTC+5:45" / "UTC-4" / "UTC" */
export function formatUtcOffset(offsetMinutes: number): string {
  if (offsetMinutes === 0) return 'UTC';
  const sign = offsetMinutes > 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return minutes === 0
    ? `UTC${sign}${hours}`
    : `UTC${sign}${hours}:${String(minutes).padStart(2, '0')}`;
}

/**
 * 一次取得裝置時區資訊，適合開機時 log 一次或放進客服／診斷畫面。
 * 例：{ timeZone: "Asia/Taipei", offsetMinutes: 480, offsetLabel: "UTC+8" }
 */
export function describeDeviceTimeZone(at: Date = new Date()): DeviceTimeZoneInfo {
  const offsetMinutes = getUtcOffsetMinutes(at);
  return {
    timeZone: getDeviceTimeZone(),
    offsetMinutes,
    offsetLabel: formatUtcOffset(offsetMinutes),
  };
}

// ---------------------------------------------------------------- 解析

// "2026-01-23T16:45:13.000Z" / "2026-01-23 16:45:13" / "2026-01-23T16:45+08:00" 皆可
const DATETIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,9}))?\s*(Z|z|[+-]\d{2}:?\d{2})?$/;
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const NUMERIC_RE = /^-?\d+$/;

/** 把 "+08:00" / "+0800" / "Z" 轉成分鐘數；無法辨識回 null */
function parseZoneOffset(zone: string): number | null {
  if (zone === 'Z' || zone === 'z') return 0;
  const m = /^([+-])(\d{2}):?(\d{2})$/.exec(zone);
  if (!m) return null;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

/**
 * 把後端時間解析成 Date（內部永遠是絕對時刻，不帶時區概念）。
 * 解析不出來回 null——呼叫端請自行決定退路，不要吞掉錯誤。
 *
 * 支援：
 *  - "2026-01-23T16:45:13.000Z"（標準 UTC ISO，後端目前格式）
 *  - "2026-01-23T16:45:13+08:00"（帶偏移）
 *  - "2026-01-23 16:45:13"（無時區標記 → 依 assumeWhenNoZone，預設當 UTC）
 *  - "2026-01-23"（純日期 → 依 dateOnlyAsLocal，預設當本地日曆日的 00:00）
 *  - 1769186713 / 1769186713000（epoch 秒或毫秒，含數字字串）
 */
export function parseServerTime(
  input: ServerTimeInput,
  options: ParseOptions = {}
): Date | null {
  const { assumeWhenNoZone = 'utc', dateOnlyAsLocal = true } = options;

  if (input === null || input === undefined) return null;

  // --- 數字：epoch 秒或毫秒 ---
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return null;
    return validate(new Date(input < 1e12 ? input * 1000 : input));
  }

  const s = input.trim();
  if (s.length === 0) return null;

  if (NUMERIC_RE.test(s)) {
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return validate(new Date(n < 1e12 ? n * 1000 : n));
  }

  // --- 純日期：當成本地日曆日，避免跨時區跳日 ---
  const dateOnly = DATE_ONLY_RE.exec(s);
  if (dateOnly) {
    const [, y, mo, d] = dateOnly;
    return dateOnlyAsLocal
      ? validate(new Date(Number(y), Number(mo) - 1, Number(d)))
      : validate(new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d))));
  }

  // --- 日期時間 ---
  const m = DATETIME_RE.exec(s);
  if (m) {
    const [, y, mo, d, hh, mi, ss, frac, zone] = m;
    // 小數位補滿三位再截斷成毫秒（後端可能給到奈秒）
    const ms = frac ? Number(frac.padEnd(3, '0').slice(0, 3)) : 0;

    const utcMillis = Date.UTC(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(hh),
      Number(mi),
      ss ? Number(ss) : 0,
      ms
    );

    let offsetMinutes: number;
    if (zone) {
      const parsed = parseZoneOffset(zone);
      if (parsed === null) return null;
      offsetMinutes = parsed;
    } else if (assumeWhenNoZone === 'utc') {
      offsetMinutes = 0;
    } else {
      // 當成本地時間：用「該時刻的本地偏移」回推，DST 邊界才不會偏
      const probe = new Date(utcMillis);
      offsetMinutes = -new Date(
        probe.getUTCFullYear(),
        probe.getUTCMonth(),
        probe.getUTCDate(),
        probe.getUTCHours(),
        probe.getUTCMinutes(),
        probe.getUTCSeconds(),
        probe.getUTCMilliseconds()
      ).getTimezoneOffset();
    }

    return validate(new Date(utcMillis - offsetMinutes * 60_000));
  }

  // --- 最後退路：交給原生解析（Hermes 可能失敗，故驗證結果） ---
  return validate(new Date(s));
}

function validate(d: Date): Date | null {
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 解析成 epoch 毫秒；失敗回 null。用於排序、時間差比對。 */
export function toEpochMillis(
  input: ServerTimeInput,
  options?: ParseOptions
): number | null {
  return parseServerTime(input, options)?.getTime() ?? null;
}

// ---------------------------------------------------------------- 格式化

export interface FormatOptions extends ParseOptions {
  /** 解析失敗時回傳的字串。預設回傳原始輸入的字串形式。 */
  fallback?: string;
  /** 在結果後面附上時區標籤，例如 "2026.01.24 00:45 (UTC+8)"。預設 false。 */
  withZoneLabel?: boolean;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * 共用格式化核心：把 Date 以「裝置本地時區」拆成欄位再組字串。
 * getFullYear/getHours 等方法本來就回傳本地時間，故不需要額外做時區運算。
 */
function formatWith(
  input: ServerTimeInput,
  options: FormatOptions,
  build: (d: Date) => string
): string {
  const fallback = options.fallback ?? (input == null ? '' : String(input));
  const d = parseServerTime(input, options);
  if (!d) return fallback;

  const text = build(d);
  return options.withZoneLabel
    ? `${text} (${formatUtcOffset(getUtcOffsetMinutes(d))})`
    : text;
}

/** UTC 時間戳 → 裝置時區的 "yyyy.MM.dd HH:mm"（台北：UTC+8） */
export function formatServerDateTime(
  input: ServerTimeInput,
  options: FormatOptions = {}
): string {
  return formatWith(input, options, (d) =>
    `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())} ` +
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  );
}

/** UTC 時間戳 → 裝置時區的 "yyyy.MM.dd HH:mm:ss" */
export function formatServerDateTimeWithSeconds(
  input: ServerTimeInput,
  options: FormatOptions = {}
): string {
  return formatWith(input, options, (d) =>
    `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())} ` +
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
  );
}

/** UTC 時間戳 → 裝置時區的 "yyyy.MM.dd" */
export function formatServerDate(
  input: ServerTimeInput,
  options: FormatOptions = {}
): string {
  return formatWith(input, options, (d) =>
    `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`
  );
}

/** UTC 時間戳 → 裝置時區的 "HH:mm" */
export function formatServerTimeOnly(
  input: ServerTimeInput,
  options: FormatOptions = {}
): string {
  return formatWith(input, options, (d) =>
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  );
}

/**
 * 以連字號輸出 "yyyy-MM-dd"（本地日期欄位，不經 toISOString 以免時區位移）。
 * 供送出後端的日期欄位使用，例如生日。
 */
export function formatLocalDateISO(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
