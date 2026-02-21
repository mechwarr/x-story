import { useState } from "react";
import {
  Alert,
  TextInput,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { forgotXStoryPassword } from "../config/authApiClient";
import { translate } from "../i18n/i18n";
import useResponsive from "../hook/useResponsive";

interface Props {
  onEmailChange: (email: string) => void;
  onCancel: () => void;
  onSuccess: () => void;
}

export function XStoryForgetPassword({ onEmailChange, onCancel, onSuccess }: Props) {
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [waitingVerification, setWaitingVerification] = useState(false);
  const { isTablet, maxContentWidth } = useResponsive();

  const sendResetEmail = async () => {
    if (!email) {
      Alert.alert(translate("error"), translate("pleaseEnterEmail"));
      return;
    }
    setIsSending(true);

    const ok = await forgotXStoryPassword({ email });

    setIsSending(false);
    setWaitingVerification(false);

    if (ok) {
      // 同步回父層（可選）
      onEmailChange(email);

      Alert.alert(
        translate("resetEmailSentTitle"),
        translate("resetEmailSentMessage"),
        [{ text: translate("ok"), onPress: onSuccess }]
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, isTablet && { paddingHorizontal: 24 }]}
      behavior={Platform.select({ ios: "padding", android: undefined })}
    >
      <View style={styles.logoContainer}>
        <Image style={styles.imgIcon} source={require("../../assets/blueeye.png")} />
      </View>

      <View style={[styles.formWrap, isTablet && { maxWidth: maxContentWidth, width: '100%' }]}>
      <Text style={styles.title}>{translate("forgotPasswordTitle") || "忘記密碼"}</Text>

      {!waitingVerification ? (
        <>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder={translate("pleaseEnterEmail") || "請輸入您的Email"}
              placeholderTextColor="#7F7F7F"
              value={email}
              onChangeText={(v) => {
                setEmail(v);  
                onEmailChange(v);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSending}
            />
          </View>

          {isSending ? (
            <ActivityIndicator size="large" color="#0ABAB5" style={{ marginVertical: 20 }} />
          ) : (
            <TouchableOpacity style={styles.sendButton} onPress={sendResetEmail}>
              <Text style={styles.sendButtonText}>{translate("sendResetEmail") || "發送重設信"}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.cancelButton} onPress={onCancel} disabled={isSending}>
            <Text style={styles.cancelButtonText}>{translate("cancel") || "取消"}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <Text style={styles.waitingText}>
          {translate("resetEmailSentMessage") || "重設信已發送，請到信箱確認。"}
        </Text>
      )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // 用 Modal 後，這裡就是一個一般頁面容器即可
  screen: {
    flex: 1,
    backgroundColor: "#39393B",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  formWrap: {
    width: "100%",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
    marginBottom: 40,
  },
  inputWrapper: {
    width: "100%",
    height: 50,
    borderRadius: 25,
    backgroundColor: "#1C1C1C",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "white",
  },
  sendButton: {
    width: "100%",
    height: 50,
    borderRadius: 25,
    backgroundColor: "#0ABAB5",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    marginTop: 20,
  },
  sendButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  cancelButton: {
    width: "100%",
    height: 45,
    borderRadius: 25,
    backgroundColor: "#555555",
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#CCCCCC",
    fontSize: 16,
  },
  waitingText: {
    color: "#AAAAAA",
    fontSize: 16,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  imgIcon: {
    width: 40,
    height: 40,
    resizeMode: "contain",
  },
  logoContainer: {
    position: "absolute",
    top: 20,
    left: 20,
    zIndex: 10,
  },
});
