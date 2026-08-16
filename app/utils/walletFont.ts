// app/utils/walletFont.ts
// 錢包操作鈕（加值 / 查看紀錄）的字級：個人資料頁與紀錄頁共用同一組數值，
// 避免同一顆「加值」按鈕在不同頁面字級不一致（英文 Refill 曾因沿用 RN 預設 14 而過小）。

import { getCurrentLang } from '../i18n/i18n';

/** 英文詞較長（Refill / Coin History），字級放大一點 */
const WALLET_FONT_SIZE_EN = 18;
const WALLET_FONT_SIZE_CJK = 17;

/**
 * 取得錢包操作鈕字級。
 * @param ms useResponsive() 的尺寸換算（平板統一放大）
 */
export function walletActionFontSize(ms: (size: number) => number): number {
  return ms(getCurrentLang() === 'en' ? WALLET_FONT_SIZE_EN : WALLET_FONT_SIZE_CJK);
}
