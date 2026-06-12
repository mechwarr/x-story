/**
 * iPad / 平板 RWD 常數
 * - 斷點以寬度 768 為平板（iPad 直向約 768pt）
 * - 內容最大寬度避免在大螢幕上過度拉寬
 */
export const BREAKPOINT_TABLET = 768;

/** 頂欄 / Drawer 藍眼 logo (blueeye.png) 基準尺寸，實際為 Math.round(HEADER_ICON_BASE_SIZE * scale) */
export const HEADER_ICON_BASE_SIZE = 32;
export const MAX_CONTENT_WIDTH = 680;
/** 平板時左右留白（內容置中時每側的 padding） */
export const TABLET_HORIZONTAL_PADDING = 24;

/**
 * 平板統一 UI 放大係數（單一可調來源）。
 * 字體 / 圖標 / 間距在平板上一致放大此倍數，手機為 1（不受影響）。
 */
export const TABLET_UI_SCALE = 1.15;

export function isTabletWidth(width: number): boolean {
  return width >= BREAKPOINT_TABLET;
}

/** 回傳統一 UI 係數：手機 1、平板 TABLET_UI_SCALE */
export function getUiScale(width: number): number {
  return isTabletWidth(width) ? TABLET_UI_SCALE : 1;
}

/** 回傳適合當下寬度的內容寬度（平板時不超過 MAX_CONTENT_WIDTH 並置中） */
export function getContentWidth(windowWidth: number): number {
  if (windowWidth >= BREAKPOINT_TABLET) {
    return Math.min(windowWidth - TABLET_HORIZONTAL_PADDING * 2, MAX_CONTENT_WIDTH);
  }
  return windowWidth;
}
