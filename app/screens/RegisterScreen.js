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
import RichText from "../components/RichText";
import useResponsive from "../hook/useResponsive";
import { HEADER_ICON_BASE_SIZE } from "../config/responsive";

const loginOptions = [
  {
    key: "xstory",
    title: "signUpWithEmail",
    onPressProp: "onXStoryRegister",
    icon: require("../../assets/auth/xstory.png"),
  },
  {
    key: "facebook",
    title: "signUpWithFacebook",
    onPressProp: "onFacebookRegister",
    icon: require("../../assets/auth/facebook.png"),
  },
  {
    key: "google",
    title: "signUpWithGoogle",
    onPressProp: "onGoogleRegister",
    icon: require("../../assets/auth/google.png"),
    textColor: "#FFFFFF",
  },
  {
    key: "wechat",
    title: "signUpWithWechat",
    onPressProp: "onWeChatRegister",
    icon: require("../../assets/auth/wechat.png"),
  },
];


export default function RegisterScreen(props) {
  const [agreeChecked, setAgreeChecked] = useState(false);
  const { contentWidth, isTablet, maxContentWidth, ms } = useResponsive();
  const buttonWidth = Math.min(420, Math.max(260, Math.round(contentWidth * 0.82)));
  const headerIconSize = ms(HEADER_ICON_BASE_SIZE);

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

  const toggleAgree = () => {
    setAgreeChecked((prev) => !prev);
    console.log("同意服務條款勾選狀態:", !agreeChecked);
  };

  const handleCancel = () => {
    props.onCancel();
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#39393B" }}>

      {/* 左上角 Logo */}
      <View style={styles.logoContainer}>
        <Image
          style={[styles.imgIcon, { width: headerIconSize, height: headerIconSize }]}
          source={require('../../assets/blueeye.png')}
        />
      </View>


      <View style={[styles.container, isTablet && styles.containerTablet]}>
        <View style={[styles.contentWrap, isTablet && { maxWidth: maxContentWidth, alignSelf: 'center', width: '100%' }]}>
        {/* 標題 */}
        <Text style={styles.title}>{translate("welcomeSignUp")}</Text>
        <Text style={styles.title}>{translate("signUpPrompt")}</Text>

        <View style={{ height: 30 }} />
        {loginOptions.map(({ key, title, onPressProp, icon }) => {
          const disabled = !agreeChecked;
          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.button,
                {
                  width: buttonWidth,
                  backgroundColor: disabled ? "#555555" : "#000000",
                  borderColor: disabled ? "#999999" : "#0abab5",
                  opacity: disabled ? 0.5 : 1, // <--- 禁用時的灰階效果
                },
              ]}
              onPress={() => {
                if (!disabled) handlePress(onPressProp);
              }}
              activeOpacity={disabled ? 1 : 0.7}
              disabled={disabled}
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
                  ellipsizeMode="tail" >
                  {translate(title)}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {Platform.OS === "ios" && (() => {
          const disabled = !agreeChecked;
          return (
            <TouchableOpacity
              style={[
                styles.button,
                {
                  width: buttonWidth,
                  backgroundColor: disabled ? "#555555" : "#000000",
                  borderColor: disabled ? "#999999" : "#0abab5",
                  opacity: disabled ? 0.5 : 1,
                },
              ]}
              onPress={() => {
                if (!disabled) handlePress("onAppleRegister");
              }}
              activeOpacity={disabled ? 1 : 0.7}
              disabled={disabled}
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
                  {translate("signUpWithApple")}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })()}


        {/* 服務條款勾選區 */}
        <TouchableOpacity
          style={[
            styles.agreeContainer,
            { width: buttonWidth, alignSelf: "center", marginHorizontal: 0 },
          ]}
          onPress={toggleAgree}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, agreeChecked && styles.checkboxChecked]}>
            {agreeChecked && <View style={styles.checkboxTick} />}
          </View>
          <RichText
            text={translate("termsAgreement")}
            baseStyle={[styles.legalText, styles.agreeText]}
            linkStyle={{ textDecorationLine: "underline" }}
            colorMap={{ tos: "#0abab5", pp: "#0abab5" }}
            onPressMap={{
              tos: props.onOpenTOS ?? (() => { }),
              pp: props.onOpenPP ?? (() => { }),
            }}
          />
        </TouchableOpacity>

        {/* 底部登入文字 */}
        <View style={styles.bottomRow}>
          <Text style={styles.bottomText}>{translate("alreadyHaveAccount")}</Text>
          <TouchableOpacity onPress={handleCancel} activeOpacity={0.7}>
            <Text
              style={[
                styles.loginLink,
              ]}
            >
              {translate("signIn")}
            </Text>
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
  bottomRow: {
    marginTop: 40,
    color: "white",
    flexDirection: "row",
    justifyContent: "center",
  },
  bottomText: {
    color: "#ffffff",
    fontSize: 21,
  },
  loginLink: {
    color: "#f0ad57",
    fontSize: 21,
    marginLeft: 5,
    textDecorationLine: "underline",
  },
  agreeContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 30,
    marginHorizontal: 10,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderColor: "#0abab5",
    borderRadius: 4,
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: "#0abab5",
  },
  checkboxTick: {
    width: 8,
    height: 12,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: "white",
    transform: [{ rotate: "45deg" },
    { scaleX: -1 }
    ],
  },
  agreeText: {
    flex: 1,
    color: "white",
    fontSize: 14,
    lineHeight: 20,
  },
  linkText: {
    color: "#0abab5",
    textDecorationLine: "underline",
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