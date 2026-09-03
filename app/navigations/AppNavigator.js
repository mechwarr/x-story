import React, { useState, useEffect } from "react";
import { Image, Pressable, Text, View } from "react-native";
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItemList,
} from "@react-navigation/drawer";
// import { MaterialCommunityIcons } from "@expo/vector-icons";

import StoryNavigator from "./StoryNavigator";
import ContinueScreen from "../screens/ContinueScreen";
import ReviewScreen from "../screens/ReviewScreen";
import MyBooksScreen from "../screens/MyBooksScreen";

import StoryContext from "../components/story/context";

import routes from "./routes";
import colors from "../config/colors";
import { translate } from "../i18n/i18n";
import { decideInitialRoute } from "./startupRoute";
import BootScreen from "../components/BootScreen";
import VersionScreen from "../screens/VersionScreen";
import LanguageScreen from "../screens/LanguageScreen";
import {ResetScreen} from "../screens/ResetScreen";
import ShopScreen from "../screens/ShopScreen";
import useResponsive from "../hook/useResponsive";
import useHeaderMetrics from "../hook/useHeaderMetrics";

const Drawer = createDrawerNavigator();

// 選單頂端藍眼的統一行為：一律回到「首頁」HomeScreen。
//
// 為什麼不是單純 navigate(routes.HOME)：
//  1. HOME 這個 Drawer.Screen 掛的是 StoryNavigator（Stack），只切 Drawer 焦點時
//     內層堆疊會保留原狀——使用者若停在 CHAPTER/STORY/PROFILE，點眼睛會回到那一頁而非首頁。
//     故以巢狀目標指定內層的 MAIN：堆疊中已有 MAIN 就退回它，沒有（例如首次登入落在
//     PROFILE）則推入，兩種情況都保證看到 HomeScreen。
//  2. DrawerRouter 只在「切換到不同的 drawer 畫面」時自動關閉抽屜（比對 state.index）。
//     人已經在 HOME 時 index 不變，抽屜不會關，畫面就停在開著的選單上。故顯式 closeDrawer。
const goHome = (navigation) => {
  navigation.navigate(routes.HOME, { screen: routes.MAIN });
  navigation.closeDrawer();
};

function CustomDrawerContent({ drawerWidth, ...props }) {
  // 選單頂端的藍眼「與首頁 AppHeader 的眼睛同尺寸、同位置」——直接讀 useHeaderMetrics
  // （全站頂欄幾何的唯一來源），而非交給 DrawerItemList 自動渲染（它的 DrawerItem 內建
  // marginHorizontal + icon 內距，會讓眼睛左緣多推 ~16px、且尺寸公式不同，永遠對不齊）。
  // HOME 這一項已在下方以 drawerItemStyle:display 'none' 隱藏，避免出現兩顆眼睛。
  const { iconSize, rowHeight, topPadding, eyeLeft, rowPaddingHorizontal } = useHeaderMetrics();

  // DrawerContentScrollView 預設會自己加 12 + insets.top；但 App 根層 SafeAreaWrapper 已扣過安全區，
  // 沿用它就會多推一個瀏海高度（先前 Drawer 眼睛偏低的主因），故整個蓋掉、改用與首頁相同的 topPadding。
  //
  // 平板上首頁內容會限寬置中，eyeLeft 可能超出抽屜寬度（例如 iPad 橫向），此時貼齊抽屜右界內縮，
  // 避免眼睛被切掉。
  const clampedEyeLeft = Math.min(
    eyeLeft,
    Math.max(0, drawerWidth - iconSize - rowPaddingHorizontal)
  );

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={{
        paddingTop: topPadding,
        paddingStart: 0,
        paddingEnd: 0,
      }}
    >
      <View style={{ height: rowHeight, justifyContent: "center" }}>
        <Pressable
          onPress={() => goHome(props.navigation)}
          hitSlop={8}
          style={{ alignSelf: "flex-start", paddingLeft: clampedEyeLeft }}
        >
          <Image
            style={{ width: iconSize, height: iconSize }}
            resizeMode="contain"
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

  // 進入 App 的預設落點（繼續觀看 vs 首頁）：判定邏輯集中於 navigations/startupRoute.js
  // （平行採集＋整體 deadline＋fail-open，絕不 throw）。initialRouteName 只在 Drawer 首次
  // 掛載生效，故先判定完成再掛 Drawer；判定期間顯示 BootScreen（App 底色＋進度圈）。
  const [initialRoute, setInitialRoute] = useState(null);
  useEffect(() => {
    let mounted = true;
    decideInitialRoute().then((route) => {
      console.log(`[AppNavigator] 初始落點: ${route}`);
      if (mounted) setInitialRoute(route);
    });
    return () => {
      mounted = false;
    };
  }, []);

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

  // 尚未判定初始落點前不掛 Drawer，避免先以 HOME 掛載後又無法改變 initialRouteName。
  if (initialRoute === null) {
    return <BootScreen />;
  }

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
        drawerContent={(props) => (
          <CustomDrawerContent {...props} drawerWidth={drawerWidth} />
        )}
        screenOptions={{
          headerShown: false,
          drawerStyle: {
            backgroundColor: colors.homeBackground,
            width: drawerWidth,
          },
        }}
        backBehavior="firstRoute"
        initialRouteName={initialRoute}
      >
        {/* HOME 仍需註冊為 Drawer.Screen（底層 Stack），但選單裡的 HOME 項目改由
            CustomDrawerContent 頂端那顆自訂藍眼取代，故隱藏其自動項目，避免出現兩顆眼睛。

            註冊「順序」是落點保險：實機（expo-router 包裹下的巢狀 navigator）曾出現
            initialRouteName 被忽略、逕自開啟「第一個 Screen」的情況——落點判定已回傳
            繼續觀看、Drawer 仍開首頁（logcat 可證：ContinueScreen 從未掛載）。
            故把「初始落點」對應的 Screen 一律排在第一個註冊位，讓兩種行為殊途同歸：
            initialRouteName 生效 → 開目標頁；被忽略退回第一個 Screen → 也是目標頁。
            選單顯示順序不受影響：HOME 項目本就隱藏，「繼續觀看」原本就是第一個可見項。 */}
        {initialRoute === routes.CONTINUE ? (
          <Drawer.Group>
            <Drawer.Screen
              name={routes.CONTINUE}
              component={ContinueScreen}
              options={{ drawerLabel: renderDrawerLabel(translate("menuContinueWatching")) }}
            />
            <Drawer.Screen
              options={{
                drawerItemStyle: { height: 0, display: "none" },
                title: "",
              }}
              name={routes.HOME}
              component={StoryNavigator}
            />
          </Drawer.Group>
        ) : (
          <Drawer.Group>
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
          </Drawer.Group>
        )}
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