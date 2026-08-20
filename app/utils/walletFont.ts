// app/utils/walletFont.ts
// 錢包操作鈕（加值 / 查看紀錄）的字級：個人資料頁與紀錄頁共用同一組數值，
// 避免同一顆「加值」按鈕在不同頁面字級不一致（英文 Refill 曾因沿用 RN 預設 14 而過小）。

import { getCurrentLang } from '../i18n/i18n';

/**
 * 英文詞較長（Refill / Coin History），字級放大一點。
 * 注意：光調大這裡不夠 —— 呼叫端若讓按鈕列可收縮（flexShrink）＋ adjustsFontSizeToFit，
 * 英文會被自動縮回去。個人資料頁的錢包列已改為「按鈕取自然寬、由左側 spacer 吸收剩餘寬度」。
 */
const WALLET_FONT_SIZE_EN = 20;
const WALLET_FONT_SIZE_CJK = 17;

/**
 * 「查看紀錄 / Coin History」連結的英文字級：比「加值 / Refill」再大一級。
 * 分開一組是因為「加值」需與 HistoryScreen 的同名按鈕保持一致，不能連帶被改動。
 */
const WALLET_RECORDS_FONT_SIZE_EN = 22;

/**
 * 取得錢包操作鈕（加值 / Refill）字級。
 * @param ms useResponsive() 的尺寸換算（平板統一放大）
 */
export function walletActionFontSize(ms: (size: number) => number): number {
  return ms(getCurrentLang() === 'en' ? WALLET_FONT_SIZE_EN : WALLET_FONT_SIZE_CJK);
}

/**
 * 取得「查看紀錄 / Coin History」連結字級。中文與加值鈕同級，英文再放大一級。
 * @param ms useResponsive() 的尺寸換算（平板統一放大）
 */
export function walletRecordsFontSize(ms: (size: number) => number): number {
  return ms(getCurrentLang() === 'en' ? WALLET_RECORDS_FONT_SIZE_EN : WALLET_FONT_SIZE_CJK);
}
