import { AntDesign } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { translate } from "../i18n/i18n";
import useResponsive from "../hook/useResponsive";
import { HEADER_ICON_BASE_SIZE } from "../config/responsive";

const loginOptions = [
  {
    key: "xstory",
    title: "signInWithEmail",
    onPressProp: "onXStoryLogin",
    icon: require("../../assets/auth/xstory.png"),
  },
  {
    key: "facebook",
    title: "signInWithFacebook",
    onPressProp: "onFacebookLogin",
    icon: require("../../assets/auth/facebook.png"),
  },
  {
    key: "google",
    title: "signInWithGoogle",
    onPressProp: "onGoogleLogin",
    icon: require("../../assets/auth/google.png"),
    textColor: "#FFFFFF",
  },
  {
    key: "wechat",
    title: "signInWithWechat",
    onPressProp: "onWeChatLogin",
    icon: require("../../assets/auth/wechat.png"),
  },
];

export default function LoginScreen(props) {
  const { contentWidth, isTablet, maxContentWidth, scale } = useResponsive();
  const buttonWidth = Math.min(420, Math.max(260, Math.round(contentWidth * 0.82)));
  const headerIconSize = Math.round(HEADER_ICON_BASE_SIZE * scale);

  // 量測「最長按鈕內容」的自然寬度，再用 minWidth 把所有內層容器拉齊到它
  // → 最長按鈕看起來置中、其餘 icon 對齊它，整塊視覺即置中（不再用比例猜）
  // 用 minWidth（非 width）：最長按鈕仍以自然寬呈現，量測才量得到真值、可收斂
  const [innerW, setInnerW] = useState(0);
  const handleInnerLayout = (w) =>
    setInnerW((prev) => Math.max(prev, Math.ceil(w)));
  // 上限不超過按鈕可用內寬（padding 左右各 16）；未量測前為 0（不約束）
  const resolvedInner = innerW ? Math.min(innerW, buttonWidth - 32) : 0;

  const handlePress = (handlerName) => {
    if (props[handlerName] && typeof props[handlerName] === "function") {
      props[handlerName]();
    }
  };

  const handleTestLoginSuccess = () => {
    if (props.onLoginSuccess) {
      props.onLoginSuccess();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#39393B" }}>
      {/* 左上角 Logo */}
      <View style={styles.logoContainer}>
        <Image
          style={[styles.imgIcon, { width: headerIconSize, height: headerIconSize }]}
          source={require("../../assets/blueeye.png")}
        />
      </View>

      <View style={[styles.container, isTablet && styles.containerTablet]}>
        <View style={[styles.contentWrap, isTablet && { maxWidth: maxContentWidth, alignSelf: 'center', width: '100%' }]}>
        <Text style={styles.title}>{translate("welcomeBack")}</Text>
        <Text style={styles.title}>{translate("loginPrompt")}</Text>

        <View style={{ height: 30 }} />

        {loginOptions.map(({ key, title, onPressProp, icon }) => (
          <TouchableOpacity
            key={key}
            style={[styles.button, { width: buttonWidth }]}
            onPress={() => handlePress(onPressProp)}
            activeOpacity={0.7}
          >
            <View
              style={[styles.buttonInner, { minWidth: resolvedInner, maxWidth: buttonWidth - 32 }]}
              onLayout={(e) => handleInnerLayout(e.nativeEvent.layout.width)}
            >
              <View style={styles.iconWrap}>
                {icon && <Image source={icon} style={styles.icon} />}
              </View>
              <Text
                style={[styles.buttonText, { color: "white", flexShrink: 1 }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {translate(title)}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        {Platform.OS === "ios" && (
          <TouchableOpacity
            style={[styles.button, { width: buttonWidth }]}
            onPress={() => handlePress("onAppleLogin")}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <View
              style={[styles.buttonInner, { minWidth: resolvedInner, maxWidth: buttonWidth - 32 }]}
              onLayout={(e) => handleInnerLayout(e.nativeEvent.layout.width)}
            >
              <View style={styles.iconWrap}>
                <AntDesign name="apple1" size={24} color="white" />
              </View>
              <Text
                style={[styles.buttonText, { color: "white", flexShrink: 1 }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {translate("signInWithApple")}
              </Text>
            </View>
          </TouchableOpacity>
        )}


        <View style={{ height: 0 }} />

        <TouchableOpacity
          style={[styles.button, { width: buttonWidth }]}
          onPress={handleTestLoginSuccess}
          activeOpacity={0.7}
        >
          <View
            style={[styles.buttonInner, { minWidth: resolvedInner, maxWidth: buttonWidth - 32 }]}
            onLayout={(e) => handleInnerLayout(e.nativeEvent.layout.width)}
          >
            <View style={styles.iconWrap} />
            <Text
              style={[styles.buttonText, { color: "#0abab5", flexShrink: 1 }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {translate("testLoginSuccess")}
            </Text>
          </View>
        </TouchableOpacity>

        {/* 新增底部行 */}
        <View style={styles.bottomRow}>
          <TouchableOpacity onPress={props.onRegister}>
            <Text style={styles.linkUnderlineOrangeText}>{translate("signUp")}</Text>
          </TouchableOpacity>
        </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-start",
    paddingTop: "20%",
    paddingHorizontal: 20,
    backgroundColor: "#39393B",
  },
  containerTablet: {
    paddingHorizontal: 24,
  },
  contentWrap: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: "white",
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 15,
    borderRadius: 25,
    backgroundColor: "#000000",
    borderColor: "#0abab5",
    borderWidth: 1,
  },
  buttonInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  buttonText: {
    fontSize: 16,
  },
  iconWrap: {
    width: 24,
    height: 24,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    width: 24,
    height: 24,
    resizeMode: "contain",
  },
  linkUnderlineOrangeText: {
    color: "#f0ad57",
    fontSize: 18,
    textAlign: "left",
    textDecorationLine: "underline",
  },
  bottomRow: {
    marginTop: 40,
    color: "white",
    flexDirection: "row",
    justifyContent: "center",
  },
  imgIcon: {
    resizeMode: "contain",
  },
  logoContainer: {
    position: "absolute",
    top: 20,
    left: 20,
    zIndex: 10,
  },
});
