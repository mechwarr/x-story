// src/i18n/i18n.ts

import { Platform } from 'react-native';
import translations from "./translations.json";

const mutiLanguage = translations as Record<string, Record<string, string>>;

// 預設語言
let currentLang: string = "en";

// 支援語言
export const availableLanguages = ["en", "zh-TW", "zh-CN"];

// 語系正規化
const normalizeLang = (lang: string): string => {
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

// 取得翻譯字串
export const translate = (key: string, lang?: string): string => {
  const langToUse = normalizeLang(lang || currentLang);
  const entry = mutiLanguage[key];
  if (!entry) return `[${key}]`;
  return entry[langToUse] || entry["en"] || `[${key}]`;
};