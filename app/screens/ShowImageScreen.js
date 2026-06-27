import React from 'react';
import { View, StyleSheet, Image, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '../config/colors';
import AppCloseX from '../components/AppCloseX';

function ShowImageScreen({ route }) {
  const { img } = route.params;
  // 用 useWindowDimensions（而非 module 載入時抓一次的 Dimensions）取得「當下」視窗尺寸，
  // iPad 旋轉／分割視窗時才不會沿用過時的寬度把圖算得過大。
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // 可用區域：扣掉左右 safe-area（iPad 橫向瀏海／圓角），高度沿用整個視窗。
  // 圖片以 contain 放進這個框 → 完整置中、letterbox，永不溢出蓋住關閉鈕。
  const availWidth = width - insets.left - insets.right;

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: img }}
        style={{ width: availWidth, height }}
        resizeMode="contain"
      />
      {/* 關閉鈕排在圖片「之後」→ 永遠疊在圖片上層，大圖也不會把它蓋掉 */}
      <AppCloseX />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: '100%',
    backgroundColor: colors.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ShowImageScreen;
