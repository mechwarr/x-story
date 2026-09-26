import { useEffect, useRef } from "react";
import { createStackNavigator } from "@react-navigation/stack";

import ChapterScreen from "../screens/ChapterScreen";
import HomeScreen from "../screens/HomeScreen";
import ShowImageScreen from "../screens/ShowImageScreen";
import StoryScreen from "../screens/StoryScreen";
import ProfileScreen from '../screens/ProfileScreen';
import ShopScreen from "../screens/ShopScreen";
import HistoryScreen from "../screens/HistoryScreen";

import colors from "../config/colors";
import routes from "./routes";
import {
  isPendingProfileRedirect,
  consumePendingProfileRedirect,
} from "../auth/firstLoginRedirect";

const Stack = createStackNavigator();

const StoryNavigator = ({ navigation }) => {
  // 首次登入且個人資料未完成 → 這個 Stack 直接以 PROFILE 為初始畫面，
  // 使用者「先看到個人資料頁」而不是先看到首頁。
  // 不採「先掛 HomeScreen 再 navigate」的做法：那會先渲染首頁、跑完一輪書籍 API，
  // 畫面上會閃一下首頁才跳轉。
  //
  // render 階段只「讀」旗標、不清除；清除放在掛載完成後的 effect。
  // 原因：新架構（Fabric）下 React 以 concurrent 模式渲染，尚未 commit 的 render 可能被
  // 丟棄重來（React Navigation 大量使用 useSyncExternalStore，store 在渲染途中變動就會
  // 觸發同步重渲染）。若在 render 裡就把旗標清掉，被丟棄的那次 render 已把旗標吃掉，
  // 重來的 render 連同新的 useRef 讀到 false → 初始畫面變成首頁，導向就無聲無息消失
  // （社群登入剛從外部 App／授權視窗回到前景，狀態更新密集，特別容易撞上）。
  // 讀取是純函式，重渲染幾次結果都一樣；存進 ref 後，之後的重繪不重算，
  // 因此使用者回到首頁後不會再被導回，下一次「主動登入」才會由 LoginContainer 重新設定旗標。
  const initialRouteRef = useRef(null);
  if (initialRouteRef.current === null) {
    initialRouteRef.current = isPendingProfileRedirect()
      ? routes.PROFILE
      : routes.MAIN;
  }
  const shouldLandOnProfile = initialRouteRef.current === routes.PROFILE;

  // 掛載確定（commit）後才取用並清除旗標
  useEffect(() => {
    consumePendingProfileRedirect();
  }, []);

  // 保險：initialRouteName 只在「全新初始化」時生效；若此 Stack 是由既有 state 還原
  // （rehydrate）而來，會沿用舊堆疊而忽略它。以第一次 state 事件核對實際落點，
  // 不是 PROFILE 就補一次導向。只核對一次，不干擾之後使用者自己的操作。
  const landingCheckedRef = useRef(false);
  const handleStackState = (e) => {
    if (landingCheckedRef.current) return;
    landingCheckedRef.current = true;
    const state = e?.data?.state;
    const focused = state?.routes?.[state?.index ?? 0]?.name;
    console.log(
      `[StoryNavigator] 初始落點: ${focused}（預期 ${initialRouteRef.current}）`
    );
    if (shouldLandOnProfile && focused !== routes.PROFILE) {
      console.warn("[StoryNavigator] initialRouteName 未生效，改以 navigate 導向個人資料頁");
      navigation.navigate(routes.HOME, { screen: routes.PROFILE });
    }
  };

  return (
    <Stack.Navigator
      initialRouteName={initialRouteRef.current}
      screenListeners={{ state: handleStackState }}
      screenOptions={{
        headerShown: false,
        // 卡片底色設深色，避免畫面切換（含全書結束回主頁）時預設白底造成的白閃。
        cardStyle: {
          backgroundColor: colors.dark,
        },
        headerStyle: {
          backgroundColor: colors.dark,
        },
        headerTitleStyle: {
          color: "#fff",
          fontWeight: "bold",
        },
      }}
    >
      <Stack.Screen name={routes.MAIN} component={HomeScreen} />
      <Stack.Screen name={routes.CHAPTER} component={ChapterScreen} />
      <Stack.Screen name={routes.STORY} component={StoryScreen} />
      <Stack.Screen name={routes.IMAGE} component={ShowImageScreen} />
      <Stack.Screen name={routes.PROFILE} component={ProfileScreen} />
      <Stack.Screen name={routes.PURCHASE} component={ShopScreen} />
      <Stack.Screen name={routes.HISTORY} component={HistoryScreen} />
    </Stack.Navigator>
  );
};

export default StoryNavigator;
