import { useState } from "react";
import {
  TextInput,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from "react-native";
import { showAlert } from "../components/CustomAlert";
import { translate } from "../i18n/i18n";
import { registerWithXStory, resentRegisterMail, ResentRegisterMailRequest } from "../config/authApiClient";
import useResponsive from "../hook/useResponsive";
import { HEADER_ICON_BASE_SIZE } from "../config/responsive";

// Email 格式驗證（與忘記密碼/登入共用同一規則）
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// 密碼政策：8-20 字、至少一個大寫、一個小寫、一個數字
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,20}$/;

interface Props {
  onCancel: () => void;
  onSuccess: () => void;
  onEmailChange?: (email: string) => void;
}

export function RegisterXStoryScreen({ onCancel, onSuccess }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [waitingVerification, setWaitingVerification] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // --- 重發驗證信 覆蓋層狀態（非 Modal / 非 navigation） ---
  const [showResendOverlay, setShowResendOverlay] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [isResending, setIsResending] = useState(false);

  const sendVerificationEmail = async () => {
    // 正規化：去除前後空白並轉小寫，避免鍵盤建議列/貼上帶入空白導致驗證失敗
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) { showAlert(translate("genericErrorTitle"), translate("emailRequired")); return; }
    if (!EMAIL_REGEX.test(normalizedEmail)) { showAlert(translate("genericErrorTitle"), translate("invalidEmailMessage")); return; }
    if (!password) { showAlert(translate("genericErrorTitle"), translate("passwordRequired")); return; }
    if (!confirmPassword) { showAlert(translate("genericErrorTitle"), translate("confirmPasswordRequired")); return; }
    if (password !== confirmPassword) { showAlert(translate("genericErrorTitle"), translate("passwordMismatchMessage")); return; }
    if (!PASSWORD_REGEX.test(password)) { showAlert(translate("genericErrorTitle"), translate("passwordPolicyMessage")); return; }

    setIsSending(true);
    const registerAccount = await registerWithXStory({ email: normalizedEmail, password });
    setIsSending(false);

    if (registerAccount) {
      // 註冊成功：顯示「請至信箱收驗證信」等待畫面（onSuccess 由使用者按提示後流程決定）
      setWaitingVerification(true);
      onSuccess();
    }
    // 失敗時 registerWithXStory 內部已彈出錯誤訊息，這裡維持表單供重試
  };

  // --- 重發驗證信：送出 ---
  const onResendSubmit = async () => {
    const normalizedEmail = resendEmail.trim().toLowerCase();
    if (!normalizedEmail) { showAlert(translate("genericErrorTitle"), translate("emailRequired")); return; }
    if (!EMAIL_REGEX.test(normalizedEmail)) { showAlert(translate("genericErrorTitle"), translate("invalidEmailMessage")); return; }
    try {
      setIsResending(true);
      const request: ResentRegisterMailRequest = { email: normalizedEmail };
      // 成功/失敗訊息由 resentRegisterMail 內部統一彈出，避免重複彈窗
      const ok = await resentRegisterMail(request);
      if (ok) setShowResendOverlay(false); // 僅成功才關閉覆蓋層
    } catch (e: any) {
      showAlert(translate("resendFailed"), e?.message ?? String(e));
    } finally {
      setIsResending(false);
    }
  };

  const { isTablet, maxContentWidth, ms } = useResponsive();
  const headerIconSize = ms(HEADER_ICON_BASE_SIZE);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.logoContainer}>
        <Image style={[styles.imgIcon, { width: headerIconSize, height: headerIconSize }]} source={require("../../assets/blueeye.png")} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, isTablet && { paddingHorizontal: 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
      <View style={[styles.formWrap, isTablet && { maxWidth: maxContentWidth, width: '100%' }]}>
      <Text style={styles.title}>{translate("registerAccount")}</Text>

      {!waitingVerification ? (
        <>
          <TextInput
            style={styles.input}
            placeholder={translate("registerEmailPlaceholder")}
            placeholderTextColor="#7F7F7F"
            selectionColor="#009688"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            autoComplete="email"
            returnKeyType="next"
            maxLength={254}
            editable={!isSending}
          />

          <View style={styles.passwordInputWrapper}>
            <TextInput
              style={styles.passwordInput}
              placeholder={translate("enterPassword")}
              placeholderTextColor="#7F7F7F"
              selectionColor="#009688"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              editable={!isSending}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              autoComplete="password-new"
              returnKeyType="next"
              maxLength={20}
            />
            <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(p => !p)}>
              <Image
                source={
                  showPassword
                    ? require("../../assets/auth/eye_open.png")
                    : require("../../assets/auth/eye_closed.png")
                }
                style={styles.eyeIcon}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.passwordInputWrapper}>
            <TextInput
              style={styles.passwordInput}
              placeholder={translate("confirmPassword")}
              placeholderTextColor="#7F7F7F"
              selectionColor="#009688"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              editable={!isSending}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              autoComplete="password-new"
              returnKeyType="done"
              maxLength={20}
              onSubmitEditing={sendVerificationEmail}
            />
            <TouchableOpacity style={styles.eyeButton} onPress={() => setShowConfirmPassword(p => !p)}>
              <Image
                source={
                  showConfirmPassword
                    ? require("../../assets/auth/eye_open.png")
                    : require("../../assets/auth/eye_closed.png")
                }
                style={styles.eyeIcon}
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.passwordHelpText}>{translate("passwordPolicyHint")}</Text>

          {isSending ? (
            <ActivityIndicator size="large" color="#0ABAB5" style={{ marginVertical: 20 }} />
          ) : (
            <TouchableOpacity style={styles.sendButton} onPress={sendVerificationEmail}>
              <Text style={styles.sendButtonText}>{translate("sendVerification")}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.cancelButton} onPress={onCancel} disabled={isSending}>
            <Text style={styles.cancelButtonText}>{translate("cancel")}</Text>
          </TouchableOpacity>

          {/* 重發驗證信（在同頁加覆蓋層呈現） */}
          <TouchableOpacity
            style={styles.resendLinkWrap}
            onPress={() => {
              setResendEmail(email);     // 預帶目前輸入的 email
              setShowResendOverlay(true);
            }}
            disabled={isSending}
          >
            <Text style={styles.resendmailtext}>{translate("resendVerification")}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <Text style={styles.waitingText}>{translate("verificationSent")}</Text>
      )}
      </View>
      </ScrollView>

      {/* 覆蓋層：顯示重發驗證信表單（不使用 Modal / navigation） */}
      {showResendOverlay && (
        <View style={styles.overlay} pointerEvents="auto">
          <View style={styles.overlayCard}>
            <Text style={styles.overlayTitle}>{translate("resendVerification")}</Text>

            <TextInput
              style={styles.input}
              placeholder={translate("resendEmailPlaceholder")}
              placeholderTextColor="#7F7F7F"
              selectionColor="#009688"
              value={resendEmail}
              onChangeText={setResendEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              autoComplete="email"
              returnKeyType="done"
              maxLength={254}
              onSubmitEditing={onResendSubmit}
              editable={!isResending}
            />

            {isResending ? (
              <ActivityIndicator size="large" color="#0ABAB5" style={{ marginVertical: 20 }} />
            ) : (
              <TouchableOpacity style={styles.sendButton} onPress={onResendSubmit}>
                <Text style={styles.sendButtonText}>{translate("resendSubmit")}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowResendOverlay(false)}
              disabled={isResending}
            >
              <Text style={styles.cancelButtonText}>{translate("cancel")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // KeyboardAvoidingView 根容器
  flex: {
    flex: 1,
    backgroundColor: "#39393B",
  },
  // ScrollView 內容：可捲動且在內容不滿一頁時置中
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
    paddingVertical: 40,
  },
  // 共用：深色背景置中（保留供其他樣式參考）
  container: {
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
  input: {
    width: "100%",
    height: 50,
    borderRadius: 25,
    backgroundColor: "#1C1C1C",
    paddingHorizontal: 20,
    fontSize: 16,
    color: "white",
    marginBottom: 10,
  },
  passwordHelpText: {
    color: "#AAAAAA",
    fontSize: 12,
    marginBottom: 20,
    marginLeft: 10,
    alignSelf: "flex-start",
  },
  sendButton: {
    width: "100%",
    height: 50,
    borderRadius: 25,
    backgroundColor: "#0ABAB5",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 20,
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
  imgIcon: { resizeMode: "contain" },
  logoContainer: { position: "absolute", top: 20, left: 20, zIndex: 10 },

  passwordInputWrapper: {
    width: "100%",
    height: 50,
    borderRadius: 25,
    backgroundColor: "#1C1C1C",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  // padding 歸零 + includeFontPadding：Android 的 TextInput 有原生預設內距，
  // 不覆寫會疊加在 wrapper 的 paddingHorizontal 上，導致與 input（Email 欄）左右／垂直位置不一致
  passwordInput: {
    flex: 1,
    fontSize: 16,
    color: "white",
    padding: 0,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  eyeButton: { padding: 5 },
  eyeIcon: { width: 24, height: 24, tintColor: "#AAAAAA" },

  resendmailtext: {
    color: "#f0ad57",
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  resendLinkWrap: {
    width: "100%",
    marginTop: 24,
    alignItems: "flex-start",
  },

  // 覆蓋層樣式（半透明背景 + 置中卡片）
  overlay: {
    position: "absolute",
    inset: 0 as any,            // RN 0.71+ 支援；若舊版可改為 top: 0, right: 0, bottom: 0, left: 0
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  overlayCard: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#2f3136",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 24,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  overlayTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "white",
    marginBottom: 24,
    textAlign: "center",
  },
});
