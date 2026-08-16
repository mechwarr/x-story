// app/components/DropdownArrow.tsx
import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';

/**
 * 全站下拉選單的三角形指示符。
 *
 * 不用 '▾' / '▼' / '▲' 字元：字元的實際墨水區大小取決於字型 glyph 與系統字級縮放，
 * 同樣的 fontSize 在不同字型/裝置上大小不一；Android 原生 Picker 又是由 OS 自己畫箭頭
 * （約 24dp），三者永遠對不齊。改以邊框繪製，寬高就是明確的 px。
 *
 * 尺寸請由呼叫端用 useResponsive 的 ms() 換算後傳入，未傳則用預設 12x7。
 */
export type DropdownArrowProps = {
  /** 底邊寬度（px） */
  width?: number;
  /** 高度（px） */
  height?: number;
  color?: string;
  /** 'down' 收合（倒三角）、'up' 展開（正三角） */
  direction?: 'down' | 'up';
  style?: StyleProp<ViewStyle>;
};

/** 預設尺寸：與 17pt 文字並排時視覺上相稱 */
export const DROPDOWN_ARROW_WIDTH = 12;
export const DROPDOWN_ARROW_HEIGHT = 7;

export default function DropdownArrow({
  width = DROPDOWN_ARROW_WIDTH,
  height = DROPDOWN_ARROW_HEIGHT,
  color = '#cdd4db',
  direction = 'down',
  style,
}: DropdownArrowProps) {
  const isUp = direction === 'up';
  return (
    <View
      style={[
        {
          width: 0,
          height: 0,
          backgroundColor: 'transparent',
          borderLeftWidth: width / 2,
          borderRightWidth: width / 2,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          // 倒三角 = 只有上邊框；正三角 = 只有下邊框
          borderTopWidth: isUp ? 0 : height,
          borderBottomWidth: isUp ? height : 0,
          borderTopColor: isUp ? 'transparent' : color,
          borderBottomColor: isUp ? color : 'transparent',
        },
        style,
      ]}
    />
  );
}
