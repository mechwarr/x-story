import React, { useState } from "react";
import { Image } from "react-native";
import { createDrawerNavigator } from "@react-navigation/drawer";
// import { MaterialCommunityIcons } from "@expo/vector-icons";

import StoryNavigator from "./StoryNavigator";
import ContinueScreen from "../screens/ContinueScreen";
import ReviewScreen from "../screens/ReviewScreen";

import StoryContext from "../components/story/context";

import routes from "./routes";
import colors from "../config/colors";
import VersionScreen from "../screens/VersionScreen";
import {ResetScreen} from "../screens/ResetScreen";
import ShopScreen from "../screens/ShopScreen";

const Drawer = createDrawerNavigator();

export default function AppNavigator() {
  const [currentStory, setCurrentStory] = useState({});
  const [currentChatIdx, setCurrentChatIdx] = useState(-1);
  const [currentBackIdx, setCurrentBackIdx] = useState(0);
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
        screenOptions={{
          headerShown: false,
          drawerStyle: {
            backgroundColor: colors.homeBackground,
            width: 180,
          },
          drawerLabelStyle: {
            fontSize: 20,
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
              //這個size是react navigation建議的
              // <View>
              // <MaterialCommunityIcons
              //   name="eye-outline"
              //   size={30}
              //   color={colors.white}
              // />
              // <Text>123</Text>
              // </View>
              <Image
                style={{
                  width: 40,
                  height: 40,
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
        <Drawer.Screen name={routes.PURCHASE} component={ShopScreen} />
        <Drawer.Screen name={routes.RESET} component={ResetScreen} />
      </Drawer.Navigator>
    </StoryContext.Provider>
  );
}