// app/utils/walletFont.ts
// 錢包操作鈕（加值 / 查看紀錄）的字級：個人資料頁與紀錄頁共用同一組數值，
// 避免同一顆「加值」按鈕在不同頁面字級不一致（英文 Refill 曾因沿用 RN 預設 14 而過小）。

import { getCurrentLang } from '../i18n/i18n';

/** 三語同字級；Refill 與「加值」都放得進 WalletChargeButton 的最小外框 */
const WALLET_FONT_SIZE = 17;

/**
 * 「查看紀錄 / Coin History」連結字級：比「加值 / Refill」小（1008 審稿）。
 * 英文詞較長，再小一級；
 * 連結太大時按鈕組變寬，會把金幣餘額擠向左邊。
 */
const WALLET_RECORDS_FONT_SIZE_EN = 14;
const WALLET_RECORDS_FONT_SIZE_CJK = 15;

/**
 * 取得錢包操作鈕（加值 / Refill）字級。
 * @param ms useResponsive() 的尺寸換算（平板統一放大）
 */
export function walletActionFontSize(ms: (size: number) => number): number {
  return ms(WALLET_FONT_SIZE);
}

/**
 * 取得「查看紀錄 / Coin History」連結字級。各語系皆比加值鈕小。
 * @param ms useResponsive() 的尺寸換算（平板統一放大）
 */
export function walletRecordsFontSize(ms: (size: number) => number): number {
  return ms(getCurrentLang() === 'en' ? WALLET_RECORDS_FONT_SIZE_EN : WALLET_RECORDS_FONT_SIZE_CJK);
}
