import React, { useState } from "react";
import { Image } from "react-native";
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItemList,
} from "@react-navigation/drawer";
import { useSafeAreaInsets } from "react-native-safe-area-context";
// import { MaterialCommunityIcons } from "@expo/vector-icons";

import StoryNavigator from "./StoryNavigator";
import ContinueScreen from "../screens/ContinueScreen";
import ReviewScreen from "../screens/ReviewScreen";

import StoryContext from "../components/story/context";

import routes from "./routes";
import colors from "../config/colors";
import VersionScreen from "../screens/VersionScreen";
import LanguageScreen from "../screens/LanguageScreen";
import {ResetScreen} from "../screens/ResetScreen";
import ShopScreen from "../screens/ShopScreen";
import useResponsive from "../hook/useResponsive";
import { HEADER_ICON_BASE_SIZE } from "../config/responsive";

const Drawer = createDrawerNavigator();

function CustomDrawerContent(props) {
  const insets = useSafeAreaInsets();
  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={{
        paddingTop: insets.top,
        paddingStart: 0,
        paddingEnd: 0,
      }}
    >
      <DrawerItemList {...props} />
    </DrawerContentScrollView>
  );
}

export default function AppNavigator() {
  const [currentStory, setCurrentStory] = useState({});
  const [currentChatIdx, setCurrentChatIdx] = useState(-1);
  const [currentBackIdx, setCurrentBackIdx] = useState(0);
  const { isTablet, scale } = useResponsive();
  const drawerWidth = isTablet ? 260 : 180;
  const drawerIconSize = Math.round(HEADER_ICON_BASE_SIZE * scale);

  return (
    <StoryContext.Provider
      value={{
        currentStory,
        currentChatIdx,
        currentBackIdx,
        setCurrentStory,
        setCurrentChatIdx,
        setCurrentBackIdx,
      }}
    >
      <Drawer.Navigator
        drawerContent={(props) => <CustomDrawerContent {...props} />}
        screenOptions={{
          headerShown: false,
          drawerStyle: {
            backgroundColor: colors.homeBackground,
            width: drawerWidth,
          },
          drawerLabelStyle: {
            fontSize: isTablet ? 22 : 20,
            fontWeight: "bold",
            color: colors.white,
          },
        }}
        backBehavior="firstRoute"
        initialRouteName={routes.HOME}
      >
        <Drawer.Screen
          options={{
            drawerIcon: () => (
              <Image
                style={{
                  width: drawerIconSize,
                  height: drawerIconSize,
                }}
                source={require("../../assets/blueeye.png")}
              />
            ),
            title: "",
          }}
          name={routes.HOME}
          component={StoryNavigator}
        />
        <Drawer.Screen name={routes.CONTINUE} component={ContinueScreen} />
        <Drawer.Screen name={routes.REVIEW} component={ReviewScreen} />
        <Drawer.Screen name={routes.VERSION} component={VersionScreen} />
        <Drawer.Screen name={routes.LANGUAGE} component={LanguageScreen} />
        <Drawer.Screen name={routes.PURCHASE} component={ShopScreen} />
        <Drawer.Screen name={routes.RESET} component={ResetScreen} />
      </Drawer.Navigator>
    </StoryContext.Provider>
  );
}