import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import colors from '../config/colors';

// 啟動過場畫面：token 檢查與「初始落點判定」（navigations/startupRoute.js）期間統一顯示
// App 常見底色 + 進度圈，取代原本「純底色乾等」與「白底轉圈」兩種不一致的呆滯畫面。
// 資料採集完成、決定落點（繼續觀看 / 首頁）後才切換頁面。
function BootScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.white} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.homeBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default BootScreen;
