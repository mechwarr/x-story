import { useEffect } from "react";
import { Alert } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { translate } from "../i18n/i18n";

/** 與正式登出相同：後端 token 失效 + clearAllUserData + 金幣狀態重置 */
export function ResetScreen({ navigation }) {
  const { logout } = useAuth();

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      Alert.alert(
        "確認重置",
        "確定要重置所有登入資料嗎？",
        [
          {
            text: translate('cancel'),
            style: "cancel",
            onPress: () => navigation.goBack(),
          },
          {
            text: translate('ok'),
            style: "destructive",
            onPress: async () => {
              await logout();
              Alert.alert("已重置", "資料已清除");
            },
          },
        ],
        { cancelable: false }
      );
    });

    return unsubscribe;
  }, [navigation, logout]);

  return null; // 因為這個畫面只是功能，不顯示內容
}