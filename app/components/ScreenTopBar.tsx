// app/components/ScreenTopBar.tsx
// 內頁共用頂欄：統一「藍眼 / 人頭」的尺寸與位置，與主頁 AppHeader 完全一致
//（列高 Math.max(50, ms(50))、圖示 ms(HEADER_ICON_BASE_SIZE)、垂直置中、左右 horizontalPadding）。
// 各頁只需傳入自己的點擊行為（例如藍眼＝回主頁、人頭＝前往個人頁）；
// 未傳入的一側以等尺寸占位，維持另一側的左右對齊位置不變。
import React from 'react';
import { View, StyleSheet, Image, Pressable, StyleProp, ViewStyle } from 'react-native';
import useResponsive from '../hook/useResponsive';
import { HEADER_ICON_BASE_SIZE } from '../config/responsive';

type Props = {
  onEyePress?: () => void;      // 左：藍眼（通常導向主頁）
  onProfilePress?: () => void;  // 右：人頭（通常導向個人頁）
  style?: StyleProp<ViewStyle>;
};

export default function ScreenTopBar({ onEyePress, onProfilePress, style }: Props) {
  const { horizontalPadding, ms } = useResponsive();
  const iconSize = ms(HEADER_ICON_BASE_SIZE);
  const headerHeight = Math.max(50, ms(50));
  const slot = { width: iconSize, height: iconSize };

  return (
    <View style={[styles.container, { height: headerHeight, paddingHorizontal: horizontalPadding }, style]}>
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
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
