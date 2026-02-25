import { AppleButton } from "@invertase/react-native-apple-authentication";
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
  const { contentWidth, isTablet, maxContentWidth, scale } = useResponsive();
  const buttonWidth = Math.min(420, Math.max(260, Math.round(contentWidth * 0.82)));
  const headerIconSize = Math.round(HEADER_ICON_BASE_SIZE * scale);


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
                  alignSelf: "center",
                  justifyContent: "center",
                  backgroundColor: disabled ? "#555555" : "#000000",
                  borderColor: disabled ? "#999999" : "#0abab5",
                  borderWidth: 1,
                  borderRadius: 25,
                  opacity: disabled ? 0.5 : 1, // <--- 禁用時的灰階效果
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                },
              ]}
              onPress={() => {
                if (!disabled) handlePress(onPressProp);
              }}
              activeOpacity={disabled ? 1 : 0.7}
              disabled={disabled}
            >
              {icon && <Image source={icon} style={styles.icon} />}
              <Text
                style={[styles.buttonText, { color: "white", flexShrink: 1 }]}
                numberOfLines={1}
                ellipsizeMode="tail" >
                {translate(title)}
              </Text>
            </TouchableOpacity>
          );
        })}

        {Platform.OS === "ios" && (
          <View
            style={[
              { 
                width: buttonWidth, 
                alignSelf: "center",
                marginTop: 10,
                marginBottom: 15,
              }
            ]}
          >
            <AppleButton
              buttonType={AppleButton.Type.SIGN_UP}
              buttonStyle={AppleButton.Style.BLACK}
              cornerRadius={25}
              style={[
                styles.appleButton,
                {
                  // 根據 agreeChecked 調整邊框顏色
                  borderColor: agreeChecked ? "#0abab5" : "transparent",
                  // 統一邊框寬度，禁用時隱藏邊框
                  borderWidth: agreeChecked ? 2 : 0, 
                  // 確保邊框有圓角
                  borderRadius: 25,
                  opacity: agreeChecked ? 1 : 0.5,
                },
              ]}
              onPress={() => handlePress("onAppleRegister")}
              accessibilityRole="button"
            />
            {/* 覆蓋層 - 蓋在按鈕上方 */}
            {!agreeChecked && (
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: "#555555",
                  borderRadius: 25,
                  zIndex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 20,
                }}
                pointerEvents="auto"
              >
                <Text
                  style={[styles.buttonText, { color: "white", flexShrink: 1 }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {translate("signUpWithApple")}
                </Text>
              </View>
            )}
          </View>
        )}


        {/* 服務條款勾選區 */}
        <TouchableOpacity
          style={styles.agreeContainer}
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