import React from "react";
import { View, StyleSheet } from "react-native";
import { DrawerActions } from "@react-navigation/native";
import { useGuardedNavigate } from '../../hooks/useGuardedNavigate';
import IconButton from "./IconButton";
import routes from "../navigations/routes";
import useResponsive from "../hook/useResponsive";

//navigation.dispatch(DrawerActions.openDrawer())

function DrawerHeader() {
  const navigation = useGuardedNavigate();
  const { ms } = useResponsive();
  const iconSize = ms(35);
  return (
    <View style={[styles.container, { height: ms(40) }]}>
      <IconButton
        name="book-open-outline"
        size={iconSize}
        iconSize={iconSize}
        onPress={() => navigation.navigate(routes.MAIN)}
      />
      <IconButton
        name="eye-outline"
        size={iconSize}
        iconSize={iconSize}
        onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 40,
    paddingHorizontal: 15,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

export default DrawerHeader;
