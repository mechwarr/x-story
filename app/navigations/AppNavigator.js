import React, { useState } from "react";
import { Image, Text, View } from "react-native";
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
import MyBooksScreen from "../screens/MyBooksScreen";

import StoryContext from "../components/story/context";

import routes from "./routes";
import colors from "../config/colors";
import { translate } from "../i18n/i18n";
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

  // 選單文字統一樣式：所有語系共用同一 fontSize，不依長度縮放。
  const drawerLabelStyle = {
    fontSize: isTablet ? 22 : 20,
    fontWeight: "bold",
    color: colors.white,
  };

  // 自訂 label render：用 flex:1 撐滿剩餘寬度並允許換行（移除預設的 numberOfLines={1}），
  // 較長語系（如英文）會自動換行而不會被 "..." 省略，字體大小維持統一。
  const renderDrawerLabel = (label) => () => (
    <View style={{ flex: 1 }}>
      <Text style={drawerLabelStyle}>{label}</Text>
    </View>
  );

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
        <Drawer.Screen
          name={routes.CONTINUE}
          component={ContinueScreen}
          options={{ drawerLabel: renderDrawerLabel(translate("menuContinueWatching")) }}
        />
        <Drawer.Screen
          name={routes.REVIEW}
          component={ReviewScreen}
          options={{ drawerLabel: renderDrawerLabel(translate("menuReviewAgain")) }}
        />
        <Drawer.Screen
          name={routes.MY_BOOKS}
          component={MyBooksScreen}
          options={{ drawerLabel: renderDrawerLabel(translate("menuMyBooks")) }}
        />
        <Drawer.Screen
          name={routes.VERSION}
          component={VersionScreen}
          options={{ drawerLabel: renderDrawerLabel(translate("menuVersionInfo")) }}
        />
        <Drawer.Screen
          name={routes.LANGUAGE}
          component={LanguageScreen}
          options={{ drawerLabel: renderDrawerLabel(translate("languageSettings")) }}
        />
        {/* 代幣商城：保留此 Drawer.Screen 僅作為左側選單項目的載體（DrawerItemList
            會自動列出已註冊的 screen）。實際點擊時攔截 drawerItemPress，改 navigate
            進 Home 內層 Stack 的 PURCHASE，與 ProfileScreen「加值」走同一個 stack 實例，
            行為（進場動畫、返回）一致；drawer 層的 ShopScreen 實例不會被顯示。 */}
        <Drawer.Screen
          name={routes.PURCHASE}
          component={ShopScreen}
          options={{ drawerLabel: renderDrawerLabel(translate("menuTokenShop")) }}
          listeners={({ navigation }) => ({
            drawerItemPress: (e) => {
              e.preventDefault();
              navigation.navigate(routes.HOME, { screen: routes.PURCHASE });
            },
          })}
        />
        <Drawer.Screen
          name={routes.RESET}
          component={ResetScreen}
          options={{ drawerLabel: renderDrawerLabel(translate("menuResetApp")) }}
        />
      </Drawer.Navigator>
    </StoryContext.Provider>
  );
}