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
import storage from "../storage/storage";
import { getBookstoreList, getEffectiveRoleLevel } from "../config/userApiClient";
import { canViewUnlisted } from "../config/roles";
import { translate, matchesCurrentStoryLang } from "../i18n/i18n";
import {
  isPendingProfileRedirect,
  setPendingProfileRedirect,
  getProfileIncompletePersisted,
} from "../auth/firstLoginRedirect";
import VersionScreen from "../screens/VersionScreen";
import LanguageScreen from "../screens/LanguageScreen";
import {ResetScreen} from "../screens/ResetScreen";
import ShopScreen from "../screens/ShopScreen";
import useResponsive from "../hook/useResponsive";
import useHeaderMetrics from "../hook/useHeaderMetrics";

const Drawer = createDrawerNavigator();

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
          onPress={() => props.navigation.navigate(routes.HOME)}
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

  // 進入 App 的預設落點：只有當「繼續觀看」頁實際會顯示至少一本書時，才以「繼續觀看」為初始頁；
  // 否則（新用戶／已讀完清空紀錄／僅剩已下架或刪除的書而全數被隱藏）維持首頁——與 ContinueScreen
  // 的可見性過濾完全一致（語系 + 上架狀態 + role>=5 例外），避免落在空頁。
  // continueStory 已依帳號命名空間隔離（見 storage.js）。initialRouteName 只在 Drawer 首次掛載
  // 生效，故先判定完成再掛 Drawer（initialRoute 為 null 時暫以底色佔位）。
  const [initialRoute, setInitialRoute] = useState(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      let route = routes.HOME;
      try {
        // 冷啟動以既有 token 自動登入時不會經過 LoginContainer，記憶體旗標為空 →
        // 改讀持久化旗標（資料補齊前一直為真），讓「資料未完成」的使用者同樣先看到 ProfileScreen。
        if (!isPendingProfileRedirect() && (await getProfileIncompletePersisted())) {
          setPendingProfileRedirect(true);
        }

        // 個人資料未完成：一律落在 HOME（其內層 Stack 會直接顯示 ProfileScreen）。
        // 不可落在「繼續觀看」——那樣 HOME 這個 Stack 根本不會掛載，導向個人資料頁就永遠不會發生。
        // （新帳號通常沒有閱讀紀錄，但帳號 id 尚未寫入 SecureStore 時 storage 會退回匿名命名空間，
        //   仍可能讀到裝置上的既有紀錄而誤落在「繼續觀看」。）
        if (isPendingProfileRedirect()) {
          if (mounted) setInitialRoute(routes.HOME);
          return;
        }
        const list = await storage.getStorys("continueStory");
        // 先套語系過濾（與 ContinueScreen 相同來源欄位）。
        const langMatched = (Array.isArray(list) ? list : []).filter((it) =>
          matchesCurrentStoryLang(it?.storyData?.lang ?? it?.lang)
        );
        if (langMatched.length) {
          const roleLevel = await getEffectiveRoleLevel();
          let hasVisible;
          if (canViewUnlisted(roleLevel)) {
            // role>=5（小編／管理員）：未上架／已下架亦可見 → 有語系相符紀錄即算可見。
            hasVisible = true;
          } else {
            const bookstore = await getBookstoreList();
            const onShelfIds = Array.isArray(bookstore)
              ? new Set(
                  bookstore
                    .filter((b) => b?.isActive !== false)
                    .map((b) => Number(b?.storyListId))
                )
              : null;
            // 在架清單取不到（網路異常）→ 不誤判為空（與 ContinueScreen 不誤擋一致），視為可見。
            hasVisible = !onShelfIds
              ? true
              : langMatched.some((it) => onShelfIds.has(Number(it?.storyId)));
          }
          if (hasVisible) route = routes.CONTINUE;
        }
      } catch (_e) {
        // 判定過程出錯時退回首頁（維持原行為）
      }
      if (mounted) setInitialRoute(route);
    })();
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
    return <View style={{ flex: 1, backgroundColor: colors.homeBackground }} />;
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