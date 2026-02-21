import { useWindowDimensions } from 'react-native';
import {
  BREAKPOINT_TABLET,
  MAX_CONTENT_WIDTH,
  TABLET_HORIZONTAL_PADDING,
  isTabletWidth,
  getContentWidth,
} from '../config/responsive';

export type ResponsiveValues = {
  width: number;
  height: number;
  isTablet: boolean;
  /** 內容區建議最大寬度（平板時為 MAX_CONTENT_WIDTH，手機為全寬） */
  maxContentWidth: number;
  /** 實際內容寬度（平板時 min(windowWidth - padding*2, MAX_CONTENT_WIDTH)） */
  contentWidth: number;
  /** 平板時水平 padding，手機可沿用或自訂 */
  horizontalPadding: number;
  /** 依寬度縮放係數，用於字體/圖標（以 375 為基準，平板不無限制放大） */
  scale: number;
};

export default function useResponsive(): ResponsiveValues {
  const { width, height } = useWindowDimensions();
  const isTablet = isTabletWidth(width);
  const contentWidth = getContentWidth(width);
  const maxContentWidth = isTablet ? MAX_CONTENT_WIDTH : width;
  const horizontalPadding = isTablet ? TABLET_HORIZONTAL_PADDING : 10;
  // 以 375 為基準，平板約 768 時 scale 約 1.2，但不超過 1.4
  const scale = Math.min(1.4, Math.max(1, width / 375));

  return {
    width,
    height,
    isTablet,
    maxContentWidth,
    contentWidth,
    horizontalPadding,
    scale,
  };
}
