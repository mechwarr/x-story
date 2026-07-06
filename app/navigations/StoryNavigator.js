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

const Stack = createStackNavigator();

const StoryNavigator = () => {
  return (
    <Stack.Navigator
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
