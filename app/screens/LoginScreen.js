import { AppleButton } from "@invertase/react-native-apple-authentication";
import React from "react";
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
            style={[
              styles.button,
              {
                width: buttonWidth,              // ← 動態寬度
                alignSelf: "center",             // ← 置中
                justifyContent: "center",        // ← 內部置中（不再用 paddingLeft 假置中）
                backgroundColor: "#000000",
                borderColor: "#0abab5",
                borderWidth: 2,
                borderRadius: 25,
                paddingHorizontal: 16,
                paddingVertical: 12,
              },
            ]}
            onPress={() => handlePress(onPressProp)}
            activeOpacity={0.7}
          >
            {icon && <Image source={icon} style={styles.icon} />}
            <Text
              style={[styles.buttonText, { color: "white", flexShrink: 1 }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {translate(title)}
            </Text>
          </TouchableOpacity>
        ))}

        {Platform.OS === "ios" && (
          <View
            style={[
              { width: buttonWidth, alignSelf: "center" },
            ]}
            pointerEvents={"auto"}
          >
            <AppleButton
              buttonType={AppleButton.Type.SIGN_IN}
              buttonStyle={AppleButton.Style.BLACK}
              cornerRadius={25}
              style={[
                styles.appleButton,
                {
                  borderColor: "#0abab5",
                  borderWidth: 1,
                  borderRadius: 25,
                },
              ]}
              onPress={() => handlePress("onAppleLogin")}
              accessibilityRole="button"
            />
          </View>
        )}


        <View style={{ height: 15 }} />

        <TouchableOpacity
          style={[
            styles.button,
            {
              width: buttonWidth,              // 同寬
              alignSelf: "center",
              justifyContent: "center",
              backgroundColor: "#000000",
              borderColor: "#0abab5",
              borderWidth: 2,
              borderRadius: 25,
              paddingHorizontal: 16,
              paddingVertical: 12,
            },
          ]}
          onPress={handleTestLoginSuccess}
          activeOpacity={0.7}
        >
          <Text
            style={[styles.buttonText, { color: "#0abab5", flexShrink: 1 }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {translate("testLoginSuccess")}
          </Text>
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
    paddingTop: "10%",
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
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginBottom: 15,
    borderRadius: 25,
  },
  buttonText: {
    fontSize: 16,
    marginLeft: 10,
  },
  icon: {
    width: 24,
    height: 24,
    resizeMode: "contain",
    marginRight: 10,
  },
  appleButton: {
    width: "100%",
    height: 54,
    marginTop: 10,
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
