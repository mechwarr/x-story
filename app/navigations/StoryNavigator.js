import { useRef } from "react";
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
import { consumePendingProfileRedirect } from "../auth/firstLoginRedirect";

const Stack = createStackNavigator();

const StoryNavigator = () => {
  // 首次登入且個人資料未完成 → 這個 Stack 直接以 PROFILE 為初始畫面，
  // 使用者「先看到個人資料頁」而不是先看到首頁。
  // 不採「先掛 HomeScreen 再 navigate」的做法：那會先渲染首頁、跑完一輪書籍 API，
  // 畫面上會閃一下首頁才跳轉。
  // 旗標於掛載當下取用一次並存進 ref（重繪不重算），因此使用者回到首頁後不會再被導回，
  // 下一次「主動登入」才會由 LoginContainer 重新設定旗標。
  const initialRouteRef = useRef(null);
  if (initialRouteRef.current === null) {
    initialRouteRef.current = consumePendingProfileRedirect()
      ? routes.PROFILE
      : routes.MAIN;
  }

  return (
    <Stack.Navigator
      initialRouteName={initialRouteRef.current}
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
