// app/hook/useHeaderMetrics.ts
//
// 全站「左上角藍眼 / 右上角人頭」頂欄幾何的唯一來源。
// 基準＝首頁 HomeScreen 實際渲染出來的結果（screens/Screen.js + components/AppHeader.js），
// 其它頁面／左側 Drawer／登入類頁面一律改用這裡的數值，就不會再出現位置對不上的情況。
//
// 為什麼不能各頁自己算：
//  1. App 根層（app/_layout.tsx 的 SafeAreaWrapper）已經用 react-native-safe-area-context 的
//     SafeAreaView（edges: top/bottom）吃掉了安全區。所有畫面都活在「已扣掉安全區」的座標系裡，
//     頁面內再加一次 useSafeAreaInsets().top 就會多推一個瀏海高度（Drawer 先前偏低即為此因）。
//  2. Screen.js 用的是 react-native 的 SafeAreaView，iOS 上它會忽略 style 的 padding
//     （RCTSafeAreaShadowView 把 setPadding* 都覆寫成 no-op），且因為 (1) 它拿到的 insets 是 0，
//     所以 Screen 的 paddingTop / paddingHorizontal 在 iOS 完全不生效、在 Android 才生效。
//     → 藍眼左緣：iOS = AppHeader 自己的 horizontalPadding；Android = horizontalPadding × 2。
//     → 藍眼上緣：iOS = 0；Android = SCREEN_TOP_PADDING(15)。
//  3. 平板時 Screen 的內容區有 maxWidth + 置中，藍眼會跟著往右移。兩個平台化簡後同為
//     (視窗寬 - MAX_CONTENT_WIDTH) / 2 + horizontalPadding。
import { Platform } from 'react-native';
import type { ViewStyle } from 'react-native';
import useResponsive from './useResponsive';
import {
  HEADER_ICON_BASE_SIZE,
  HEADER_ROW_BASE_HEIGHT,
  MAX_CONTENT_WIDTH,
  SCREEN_TOP_PADDING,
} from '../config/responsive';

export type HeaderMetrics = {
  /** 藍眼 / 人頭的邊長 */
  iconSize: number;
  /** 頂欄列高（圖示在列內垂直置中） */
  rowHeight: number;
  /** 頂欄最外層的水平留白（對應 Screen 的 paddingHorizontal，iOS 為 0） */
  outerPaddingHorizontal: number;
  /** 頂欄列本身的水平留白（對應 AppHeader 的 paddingHorizontal） */
  rowPaddingHorizontal: number;
  /** 頂欄最外層的上方留白（對應 Screen 的 paddingTop，iOS 為 0） */
  topPadding: number;
  /** 藍眼左緣距畫面左緣的距離（已含平板置中位移），供絕對定位使用 */
  eyeLeft: number;
  /** 藍眼上緣距畫面上緣的距離，供絕對定位使用 */
  eyeTop: number;
  /** 平板內容置中樣式（與 Screen 的內容區一致），手機為 null */
  contentWidthStyle: ViewStyle | null;
};

export default function useHeaderMetrics(): HeaderMetrics {
  const { width, isTablet, maxContentWidth, horizontalPadding, ms } = useResponsive();

  const iconSize = ms(HEADER_ICON_BASE_SIZE);
  const rowHeight = Math.max(HEADER_ROW_BASE_HEIGHT, ms(HEADER_ROW_BASE_HEIGHT));

  // iOS 的 SafeAreaView 會吃掉 Screen 的 padding（見檔頭說明），故外層留白只在 Android 存在。
  const outerPaddingHorizontal = Platform.OS === 'android' ? horizontalPadding : 0;
  const rowPaddingHorizontal = horizontalPadding;
  const topPadding = Platform.OS === 'android' ? SCREEN_TOP_PADDING : 0;

  // 平板：內容區被限寬並置中，藍眼跟著右移；手機：就是外層留白。
  const contentLeft = isTablet
    ? Math.max(outerPaddingHorizontal, (width - MAX_CONTENT_WIDTH) / 2)
    : outerPaddingHorizontal;

  return {
    iconSize,
    rowHeight,
    outerPaddingHorizontal,
    rowPaddingHorizontal,
    topPadding,
    eyeLeft: contentLeft + rowPaddingHorizontal,
    eyeTop: topPadding + (rowHeight - iconSize) / 2,
    contentWidthStyle: isTablet
      ? { maxWidth: maxContentWidth, alignSelf: 'center', width: '100%' }
      : null,
  };
}
