import React, { useState } from "react";
import { Image, Platform, Pressable, Text, View } from "react-native";
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
  const { horizontalPadding, ms } = useResponsive();

  // 選單頂端的藍眼「與工具列 AppHeader 的眼睛同尺寸、同位置」——用完全相同的常數重建，
  // 而非交給 DrawerItemList 自動渲染（它的 DrawerItem 內建 marginHorizontal + icon 內距，
  // 會讓眼睛左緣多推 ~16px、且尺寸公式不同，永遠對不齊）。HOME 這一項已在下方以
  // drawerItemStyle:display 'none' 隱藏，避免出現兩顆眼睛。
  const eyeSize = ms(HEADER_ICON_BASE_SIZE);
  const headerHeight = Math.max(50, ms(50));
  // 垂直：對齊 Screen 的 top offset（SafeArea 上緣 + 與 Screen 相同的 paddingTop 常數），
  // 讓 Drawer 眼睛與 AppHeader 眼睛落在同一高度。
  const topOffset = insets.top + (Platform.OS === "android" ? 15 : 47);
  // 水平：AppHeader 眼睛左緣 = Screen 水平留白 + AppHeader 水平留白 = 2×horizontalPadding，
  // Drawer 內容左緣為 0，故左內距補 2×horizontalPadding 即等距。
  const eyeLeft = horizontalPadding * 2;

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={{
        paddingTop: topOffset,
        paddingStart: 0,
        paddingEnd: 0,
      }}
    >
      <View style={{ height: headerHeight, justifyContent: "center" }}>
        <Pressable
          onPress={() => props.navigation.navigate(routes.HOME)}
          hitSlop={8}
          style={{ alignSelf: "flex-start", paddingLeft: eyeLeft }}
        >
          <Image
            style={{ width: eyeSize, height: eyeSize }}
            source={require("../../assets/blueeye.png")}
          />
        </Pressable>
      </View>
      <DrawerItemList {...props} />
    </DrawerContentScrollView>
  );
}

export default function AppNavigator() {
  const [currentStory, setCurrentStory] = useState({});
  const [currentChatIdx, setCurrentChatIdx] = useState(-1);
  const [currentBackIdx, setCurrentBackIdx] = useState(0);
  const { isTablet } = useResponsive();
  const drawerWidth = isTablet ? 260 : 180;

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
        {/* HOME 仍需註冊為 Drawer.Screen（initialRoute / 底層 Stack），但選單裡的
            HOME 項目改由 CustomDrawerContent 頂端那顆自訂藍眼取代，故隱藏其自動項目，
            避免出現兩顆眼睛、也讓下方選項往上貼齊。 */}
        <Drawer.Screen
          options={{
            drawerItemStyle: { height: 0, display: "none" },
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