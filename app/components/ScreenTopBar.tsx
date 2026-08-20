// app/components/ScreenTopBar.tsx
// 內頁共用頂欄：藍眼 / 人頭的尺寸與位置與首頁（Screen + AppHeader）完全一致。
// 幾何（列高、圖示大小、外層留白、平板置中位移）一律取自 hook/useHeaderMetrics.ts，
// 不在這裡自行計算，避免各頁再度長歪。
//
// 使用前提：本元件放在頁面根層（App 根層 SafeAreaWrapper 已處理安全區，頁面內不需再補 inset）。
// 各頁只需傳入自己的點擊行為（例如藍眼＝回主頁、人頭＝前往個人頁）；
// 未傳入的一側以等尺寸占位，維持另一側的左右對齊位置不變。
import React from 'react';
import { View, StyleSheet, Image, Pressable, StyleProp, ViewStyle } from 'react-native';
import useHeaderMetrics from '../hook/useHeaderMetrics';

type Props = {
  onEyePress?: () => void;      // 左：藍眼（通常導向主頁）
  onProfilePress?: () => void;  // 右：人頭（通常導向個人頁）
  style?: StyleProp<ViewStyle>;
};

export default function ScreenTopBar({ onEyePress, onProfilePress, style }: Props) {
  const {
    iconSize,
    rowHeight,
    outerPaddingHorizontal,
    rowPaddingHorizontal,
    topPadding,
    contentWidthStyle,
  } = useHeaderMetrics();
  const slot = { width: iconSize, height: iconSize };

  return (
    // 三層結構刻意對應首頁：Screen 外層留白 → Screen 內容區（平板限寬置中）→ AppHeader 列
    <View
      style={[
        { paddingTop: topPadding, paddingHorizontal: outerPaddingHorizontal },
        style,
      ]}
    >
      <View style={contentWidthStyle}>
        <View style={[styles.row, { height: rowHeight, paddingHorizontal: rowPaddingHorizontal }]}>
          {onEyePress ? (
            <Pressable onPress={onEyePress} hitSlop={8}>
              <Image source={require('../../assets/blueeye.png')} style={slot} resizeMode="contain" />
            </Pressable>
          ) : (
            <View style={slot} />
          )}

          {onProfilePress ? (
            <Pressable onPress={onProfilePress} hitSlop={8}>
              <Image
                source={require('../../assets/profile.png')}
                style={[slot, { borderRadius: iconSize / 2 }]}
                resizeMode="contain"
              />
            </Pressable>
          ) : (
            <View style={slot} />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
