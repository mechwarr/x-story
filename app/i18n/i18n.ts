// src/i18n/i18n.ts

import { Platform } from 'react-native';
import translations from "./translations.json";

const mutiLanguage = translations as Record<string, Record<string, string>>;

// 預設語言
let currentLang: string = "en";

// 支援語言
export const availableLanguages = ["en", "zh-TW", "zh-CN"];

// 語系正規化
export const normalizeLang = (lang: string): string => {
  if (lang.startsWith('zh-Hant') || lang.startsWith('zh-TW')) return 'zh-TW';
  if (lang.startsWith('zh-Hans') || lang.startsWith('zh-CN')) return 'zh-CN';
  if (availableLanguages.includes(lang)) return lang;
  return 'en';
};

// 設定語言
export const setLanguage = (lang: string) => {
  const normalizedLang = normalizeLang(lang);
  currentLang = normalizedLang;
};

// 取得目前語言碼（en / zh-TW / zh-CN）
export const getCurrentLang = (): string => currentLang;

// 語言碼 → 後端書籍資料 lang 欄位的對應標籤
// 後端 story / chapter 的 lang 欄位存的是這些中文/英文字串，
// 需與 App 語系做對應，才能依使用者語系篩選書籍與章節。
export const storyLangLabelByCode: Record<string, string> = {
  en: "English",
  "zh-TW": "繁體中文",
  "zh-CN": "簡體中文",
};

// 取得目前語系對應的書籍資料 lang 標籤（找不到時退回英文）
export const getCurrentStoryLang = (lang?: string): string => {
  const langToUse = normalizeLang(lang || currentLang);
  return storyLangLabelByCode[langToUse] ?? storyLangLabelByCode.en;
};

// 將後端書籍/章節的 lang 欄位正規化成語言碼（en / zh-TW / zh-CN）。
// 後端各筆資料的 lang 值並不統一：可能是中文文案（簡繁字形都有，例如「簡體中文」或「简体中文」）、
// 英文描述（Simplified Chinese / English）或語言碼（zh-CN / zh-Hans）。
// 直接用標籤字串做 === 比對時，只要字形或文案有一點差異就會比對失敗（簡中分類因此整個消失），
// 故統一收斂成語言碼後再比較。無法判斷時一律退回 'en'。
export const normalizeStoryLang = (raw?: string | null): string => {
  if (raw == null) return 'en';
  const s = String(raw).trim();
  if (!s) return 'en';

  // 中文文案（同時涵蓋簡體與繁體兩種字形）
  if (/簡體|简体/.test(s)) return 'zh-CN';
  if (/繁體|繁体|正體|正体/.test(s)) return 'zh-TW';
  // 英文描述
  if (/simplified/i.test(s)) return 'zh-CN';
  if (/traditional/i.test(s)) return 'zh-TW';
  if (/english|英文|英語|英语/i.test(s)) return 'en';

  // 其餘交給 normalizeLang 處理語言碼 / BCP-47（zh-TW、zh-Hant、zh-CN、zh-Hans、en…）
  return normalizeLang(s);
};

// 判斷某筆書籍/章節資料的 lang 是否與目前 App 語系相符（兩邊都正規化成語言碼後比較）。
export const matchesCurrentStoryLang = (rawLang?: string | null): boolean => {
  return normalizeStoryLang(rawLang) === normalizeLang(currentLang);
};

// 從「多語系參數表」（後端各支參數 API 皆回傳全部語系的資料列）中，
// 挑出與目前 App 語系相符的那一筆設定。
// 後端 list API（menu / setup-chapter / setup-story-list / setup-story-role / *-foolproof）
// 只是 findAll()，未依 lang 過濾，資料列順序也不保證，故不能用固定索引 data[0]/data[1]，
// 否則不論使用者切到哪個語系，永遠套用同一列（通常是第一筆）的樣式 → 樣式不會隨語系更新。
// 比對沿用 matchesCurrentStoryLang（已處理簡繁字形／英文描述／語言碼差異）。
// 找不到相符語系時退回第一筆，避免整組樣式消失。
export const pickConfigByLang = <T extends { lang?: string | null }>(
  rows?: T[] | null
): T | undefined => {
  if (!Array.isArray(rows) || rows.length === 0) return undefined;
  return rows.find((row) => matchesCurrentStoryLang(row?.lang)) ?? rows[0];
};

// 金幣數量標籤：英文需依單複數輸出 "1 coin" / "5 coins"，中文則為 "5 金幣 / 5 金币"（無單複數變化）。
// 金幣不足彈窗的內文用此組出「N 金幣 / N coin(s)」片段，集中處理英文單複數，避免出現 "1 coins"。
export const coinCountLabel = (amount: number, lang?: string): string => {
  const langToUse = normalizeLang(lang || currentLang);
  if (langToUse === 'zh-TW') return `${amount} 金幣`;
  if (langToUse === 'zh-CN') return `${amount} 金币`;
  return `${amount} ${amount === 1 ? 'coin' : 'coins'}`;
};

// 取得翻譯字串
// 支援 {placeholder} 內插：translate('key', { price: 100, name: '書名' })
// 向後相容：第二參數若為字串，仍視為語言碼（translate('key', 'zh-TW')）
type TranslateParams = Record<string, string | number>;
export const translate = (
  key: string,
  paramsOrLang?: TranslateParams | string,
  lang?: string
): string => {
  let params: TranslateParams | undefined;
  let langArg = lang;
  if (typeof paramsOrLang === 'string') {
    langArg = paramsOrLang;
  } else {
    params = paramsOrLang;
  }

  const langToUse = normalizeLang(langArg || currentLang);
  const entry = mutiLanguage[key];
  if (!entry) return `[${key}]`;
  const template = entry[langToUse] || entry["en"];
  if (!template) return `[${key}]`;
  if (!params) return template;

  // 將 {name} 之類的佔位符替換為傳入的變數；缺值時保留原樣
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    params[name] != null ? String(params[name]) : match
  );
};