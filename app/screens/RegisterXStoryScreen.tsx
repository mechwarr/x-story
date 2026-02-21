import { useState } from "react";
import {
  TextInput,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Image,
} from "react-native";
import { translate } from "../i18n/i18n";
import { registerWithXStory, resentRegisterMail, ResentRegisterMailRequest } from "../config/authApiClient";
import useResponsive from "../hook/useResponsive";

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
    if (!email) { alert("請輸入 Email"); return; }
    if (!password) { alert("請輸入密碼"); return; }
    if (!confirmPassword) { alert("請確認密碼"); return; }
    if (password !== confirmPassword) { alert("兩次輸入的密碼不相同"); return; }

    const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,20}$/;
    if (!passwordPattern.test(password)) {
      alert("密碼需8-20字元，且包含至少一個大寫字母、一個小寫字母及一個數字");
      return;
    }

    setIsSending(true);
    const registerAccount = await registerWithXStory({ email, password });
    setIsSending(false);
    setWaitingVerification(true);

    if (registerAccount) {
      setWaitingVerification(false);
      onSuccess();
    } else {
      setWaitingVerification(false);
    }
  };

  // --- 重發驗證信：送出 ---
  const onResendSubmit = async () => {
    if (!resendEmail) { alert("請輸入 Email"); return; }
    try {
      setIsResending(true);
      const request: ResentRegisterMailRequest = { email: resendEmail };
      await resentRegisterMail(request);
      alert("已寄出驗證信，請至信箱收信");
      setShowResendOverlay(false); // 關閉覆蓋層
    } catch (e: any) {
      alert("重發失敗：" + (e?.message ?? String(e)));
    } finally {
      setIsResending(false);
    }
  };

  const { isTablet, maxContentWidth } = useResponsive();

  return (
    <View style={[styles.container, isTablet && { paddingHorizontal: 24 }]}>
      <View style={styles.logoContainer}>
        <Image style={styles.imgIcon} source={require("../../assets/blueeye.png")} />
      </View>

      <View style={[styles.formWrap, isTablet && { maxWidth: maxContentWidth, width: '100%' }]}>
      <Text style={styles.title}>{translate("registerAccount")}</Text>

      {!waitingVerification ? (
        <>
          <TextInput
            style={styles.input}
            placeholder={translate("enterEmail")}
            placeholderTextColor="#7F7F7F"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isSending}
          />

          <View style={styles.passwordInputWrapper}>
            <TextInput
              style={styles.passwordInput}
              placeholder={translate("enterPassword")}
              placeholderTextColor="#7F7F7F"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              editable={!isSending}
              autoCapitalize="none"
              autoCorrect={false}
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
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              editable={!isSending}
              autoCapitalize="none"
              autoCorrect={false}
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

          <Text style={styles.passwordHelpText}>{translate("createPassword")}</Text>

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
            <Text style={styles.resendmailtext}>重發驗證信</Text>
          </TouchableOpacity>
        </>
      ) : (
        <Text style={styles.waitingText}>{translate("verificationSent")}</Text>
      )}
      </View>

      {/* 覆蓋層：顯示重發驗證信表單（不使用 Modal / navigation） */}
      {showResendOverlay && (
        <View style={styles.overlay} pointerEvents="auto">
          <View style={styles.overlayCard}>
            <Text style={styles.overlayTitle}>重發驗證信</Text>

            <TextInput
              style={styles.input}
              placeholder="請輸入 Email"
              placeholderTextColor="#7F7F7F"
              value={resendEmail}
              onChangeText={setResendEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isResending}
            />

            {isResending ? (
              <ActivityIndicator size="large" color="#0ABAB5" style={{ marginVertical: 20 }} />
            ) : (
              <TouchableOpacity style={styles.sendButton} onPress={onResendSubmit}>
                <Text style={styles.sendButtonText}>送出</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowResendOverlay(false)}
              disabled={isResending}
            >
              <Text style={styles.cancelButtonText}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // 共用：深色背景置中
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
    marginBottom: 20,
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
  imgIcon: { width: 40, height: 40, resizeMode: "contain" },
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
  passwordInput: { flex: 1, fontSize: 16, color: "white" },
  eyeButton: { padding: 5 },
  eyeIcon: { width: 24, height: 24, tintColor: "#AAAAAA" },

  resendmailtext: {
    color: "#f0ad57",
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  resendLinkWrap: {
    width: "100%",
    marginTop: 10,
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
