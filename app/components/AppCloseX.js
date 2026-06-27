import React from "react";
import { View, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import IconButton from "./IconButton";
import colors from "../config/colors";
import useResponsive from "../hook/useResponsive";

function AppCloseX({ onPress }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { ms } = useResponsive();

  return (
    <View
      style={[
        styles.container,
        {
          // 以 safe-area 上緣為基準再加位移：iPad／瀏海機型都不會被狀態列或圓角切到，
          // 位移與按鈕大小一律走 ms() 統一縮放（手機 1x、平板 1.15x）。
          top: insets.top + ms(20),
          right: insets.right + ms(20),
        },
      ]}
    >
      <IconButton
        name="close"
        size={ms(35)}
        iconSize={ms(35)}
        iconColor="#fff"
        onPress={onPress ?? (() => navigation.goBack())}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    // 疊在圖片等同層級的兄弟元素之上，避免被後繪製的大圖蓋住（Android 需 elevation）
    zIndex: 10,
    elevation: 10,
    backgroundColor: colors.transparent,
  },
});

export default AppCloseX;
