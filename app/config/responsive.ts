/**
 * iPad / 平板 RWD 常數
 * - 斷點以寬度 768 為平板（iPad 直向約 768pt）
 * - 內容最大寬度避免在大螢幕上過度拉寬
 */
export const BREAKPOINT_TABLET = 768;
export const MAX_CONTENT_WIDTH = 600;
/** 平板時左右留白（內容置中時每側的 padding） */
export const TABLET_HORIZONTAL_PADDING = 24;

export function isTabletWidth(width: number): boolean {
  return width >= BREAKPOINT_TABLET;
}

/** 回傳適合當下寬度的內容寬度（平板時不超過 MAX_CONTENT_WIDTH 並置中） */
export function getContentWidth(windowWidth: number): number {
  if (windowWidth >= BREAKPOINT_TABLET) {
    return Math.min(windowWidth - TABLET_HORIZONTAL_PADDING * 2, MAX_CONTENT_WIDTH);
  }
  return windowWidth;
}
