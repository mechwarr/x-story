// app/utils/walletFont.ts
// 錢包操作鈕（加值 / 查看紀錄）的字級：個人資料頁與紀錄頁共用同一組數值，
// 避免同一顆「加值」按鈕在不同頁面字級不一致（英文 Refill 曾因沿用 RN 預設 14 而過小）。

import { getCurrentLang } from '../i18n/i18n';

/**
 * 英文詞較長（Refill / Coin History），字級反而要比中文小一級：
 * 個人資料頁的錢包列是「整組靠右、金幣餘額緊貼其左」，按鈕組越寬金幣就被推得越偏左。
 * 英文曾放大到 20 / 22，按鈕組寬度約為中文的 1.5 倍，金幣被擠離頭像／標題的中線。
 * 16 搭配呼叫端英文版較窄的內距，可讓英文按鈕組與中文（17）幾乎等寬 → 兩語系排版一致。
 */
const WALLET_FONT_SIZE_EN = 16;
const WALLET_FONT_SIZE_CJK = 17;

/** 「查看紀錄 / Coin History」連結的英文字級：與「加值 / Refill」同級（理由同上）。 */
const WALLET_RECORDS_FONT_SIZE_EN = 16;

/**
 * 取得錢包操作鈕（加值 / Refill）字級。
 * @param ms useResponsive() 的尺寸換算（平板統一放大）
 */
export function walletActionFontSize(ms: (size: number) => number): number {
  return ms(getCurrentLang() === 'en' ? WALLET_FONT_SIZE_EN : WALLET_FONT_SIZE_CJK);
}

/**
 * 取得「查看紀錄 / Coin History」連結字級。各語系皆與加值鈕同級。
 * @param ms useResponsive() 的尺寸換算（平板統一放大）
 */
export function walletRecordsFontSize(ms: (size: number) => number): number {
  return ms(getCurrentLang() === 'en' ? WALLET_RECORDS_FONT_SIZE_EN : WALLET_FONT_SIZE_CJK);
}
