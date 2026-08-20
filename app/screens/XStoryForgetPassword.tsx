import { useState } from "react";
import {
  TextInput,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { showAlert } from "../components/CustomAlert";
import { forgotXStoryPassword } from "../config/authApiClient";
import { translate } from "../i18n/i18n";
import useResponsive from "../hook/useResponsive";
import HeaderEyeLogo from "../components/HeaderEyeLogo";

// Email 格式驗證（與註冊共用同一規則）
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      showAlert(translate("genericErrorTitle"), translate("emailRequired"));
      return;
    }
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      showAlert(translate("genericErrorTitle"), translate("invalidEmailMessage"));
      return;
    }
    setIsSending(true);

    const ok = await forgotXStoryPassword({ email: normalizedEmail });

    setIsSending(false);
    setWaitingVerification(false);

    if (ok) {
      // 同步回父層（可選）
      onEmailChange(normalizedEmail);

      showAlert(
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
      <HeaderEyeLogo />

      <View style={[styles.formWrap, isTablet && { maxWidth: maxContentWidth, width: '100%' }]}>
      <Text style={styles.title}>{translate("forgotPassword")}</Text>

      {!waitingVerification ? (
        <>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder={translate("enterEmail")}
              placeholderTextColor="#7F7F7F"
              selectionColor="#009688"
              value={email}
              onChangeText={(v) => {
                setEmail(v);  
                onEmailChange(v);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              autoComplete="email"
              returnKeyType="send"
              maxLength={254}
              onSubmitEditing={sendResetEmail}
              editable={!isSending}
            />
          </View>

          {isSending ? (
            <ActivityIndicator size="large" color="#0ABAB5" style={{ marginVertical: 20 }} />
          ) : (
            <TouchableOpacity style={styles.sendButton} onPress={sendResetEmail}>
              <Text style={styles.sendButtonText}>{translate("sendResetEmail")}</Text>
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
      {/* 補齊與登入頁的表單高度差，讓垂直置中後標題與登入頁同高 */}
      <View style={styles.bottomSpacer} />
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
    textAlign: "center",
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
    marginTop: 35, // 與登入頁「忘記密碼→登入鈕」相同的 45px 間距（輸入框 marginBottom 10 + 35）
  },
  sendButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  cancelButton: {
    width: "100%",
    height: 50,
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
  // 忘記密碼頁表單比登入頁少了密碼欄與忘記密碼連結，補上高度差讓標題置中後對齊登入頁
  bottomSpacer: {
    height: 100,
  },
});
