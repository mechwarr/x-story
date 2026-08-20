import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import colors from '../config/colors';
import useResponsive from '../hook/useResponsive';
import { SCREEN_TOP_PADDING } from '../config/responsive';

function Screen({ children, style }) {
  const { isTablet, maxContentWidth, horizontalPadding } = useResponsive();

  return (
    <SafeAreaView style={[styles.container, { paddingHorizontal: horizontalPadding }, style]}>
      <StatusBar style='auto' hidden={true} />
      <View style={[styles.content, isTablet && { maxWidth: maxContentWidth, alignSelf: 'center', width: '100%' }]}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    // 註：iOS 的 SafeAreaView 會忽略 padding（見 config/responsive.ts 的 SCREEN_TOP_PADDING 說明），
    // 此值實際只在 Android 生效。其他頁面要對齊首頁頂欄請用 hook/useHeaderMetrics.ts。
    paddingTop: SCREEN_TOP_PADDING,
    flex: 1,
    backgroundColor: colors.homeBackground,
  },
  content: {
    flex: 1,
  },
});

export default Screen;
