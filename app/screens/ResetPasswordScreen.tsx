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
} from "react-native";
import { translate } from "../i18n/i18n";
import { resetXStoryPassword } from "../config/authApiClient";
import useResponsive from "../hook/useResponsive";
import { HEADER_ICON_BASE_SIZE } from "../config/responsive";

interface Props {
    token: string;               // 由 deep link 解析得到
    onCancel: () => void;
    onSuccess: () => void;
}

export function ResetPasswordScreen({ token, onCancel, onSuccess }: Props) {
    // ---- 狀態 ----
    const [pwd, setPwd] = useState("");
    const [pwd2, setPwd2] = useState("");
    const [showPwd, setShowPwd] = useState(false);
    const [showPwd2, setShowPwd2] = useState(false);
    const [isSending, setIsSending] = useState(false);

    // ---- 基本驗證 ----
    const MIN_LEN = 8;
    const isValid =
        pwd.length >= MIN_LEN &&
        pwd2.length >= MIN_LEN &&
        pwd === pwd2 &&
        !!token;

    // ---- 送出 ----
    const submit = async () => {
        // 統一的 Alert 介面：所有彈窗都走這裡
        const showAlert = (
            titleKey: string,
            messageKey: string,
            opts?: { success?: boolean }
        ) => {
            Alert.alert(
                translate(titleKey),
                translate(messageKey),
                [{ text: translate("ok"), onPress: opts?.success ? onSuccess : undefined }],
            );
        };

        // ✅ 本地驗證（僅在 !isValid 時檢查，維持你原本的邏輯）
        if (!isValid) {
            if (!token) {
                // 連結失效
                showAlert("resetLinkInvalidTitle", "resetLinkInvalidMessage");
                return;
            }
            if (pwd !== pwd2) {
                // 兩次密碼不一致
                showAlert("passwordMismatchTitle", "passwordMismatchMessage");
                return;
            }
            if (pwd.length < MIN_LEN) {
                // 密碼過短（MIN_LEN 的數字請在 i18n 文字內處理）
                showAlert("passwordTooShortTitle", "passwordTooShortMessage");
                return;
            }
        }

        // ✅ 呼叫 API
        try {
            setIsSending(true);
            const ok = await resetXStoryPassword({ token, newPassword: pwd });
            setIsSending(false);

            if (ok) {
                // 更新成功
                showAlert("passwordUpdatedTitle", "passwordUpdatedMessage", { success: true });
            } else {
                // API 回傳失敗
                showAlert("passwordUpdateFailedTitle", "passwordUpdateFailedMessage");
            }
        } catch (_err) {
            setIsSending(false);
            // 例外錯誤（網路、中斷等）
            showAlert("passwordUpdateErrorTitle", "passwordUpdateErrorMessage");
        }
    };


    const { isTablet, maxContentWidth, scale } = useResponsive();
    const headerIconSize = Math.round(HEADER_ICON_BASE_SIZE * scale);

    return (
        <View style={[styles.container, isTablet && { paddingHorizontal: 24 }]}>
            <View style={styles.logoContainer}>
                <Image style={[styles.imgIcon, { width: headerIconSize, height: headerIconSize }]} source={require("../../assets/blueeye.png")} />
            </View>

            <View style={[styles.formWrap, isTablet && { maxWidth: maxContentWidth, width: '100%' }]}>
            <View style={{ alignItems: "center", marginBottom: 30 }}>
                <Text style={styles.title}>{translate("resetPassword")}</Text>
            </View>

            {/* 新密碼 */}
            <View style={styles.inputRow}>
                <TextInput
                    style={styles.input}
                    placeholder={translate("newPassword")}
                    placeholderTextColor="#7F7F7F"
                    secureTextEntry={!showPwd}
                    value={pwd}
                    onChangeText={setPwd}
                    autoCapitalize="none"
                />
                <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPwd(prev => !prev)}
                    accessibilityRole="button"
                    accessibilityLabel={showPwd ? "隱藏密碼" : "顯示密碼"}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Image
                        source={
                            showPwd
                                ? require("../../assets/auth/eye_open.png")
                                : require("../../assets/auth/eye_closed.png")
                        }
                        style={styles.eyeIcon}
                    />
                </TouchableOpacity>
            </View>

            {/* 再次輸入新密碼 */}
            <View style={[styles.inputRow, { marginTop: 12 }]}>
                <TextInput
                    style={styles.input}
                    placeholder={translate("confirmPassword")}
                    placeholderTextColor="#7F7F7F"
                    secureTextEntry={!showPwd2}
                    value={pwd2}
                    onChangeText={setPwd2}
                    autoCapitalize="none"
                />
                <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPwd2(prev => !prev)}
                    accessibilityRole="button"
                    accessibilityLabel={showPwd2 ? "隱藏密碼" : "顯示密碼"}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Image
                        source={
                            showPwd2
                                ? require("../../assets/auth/eye_open.png")
                                : require("../../assets/auth/eye_closed.png")
                        }
                        style={styles.eyeIcon}
                    />
                </TouchableOpacity>
            </View>

            {/* 提交按鈕 / Loading */}
            {isSending ? (
                <ActivityIndicator size="large" color="#0ABAB5" style={{ marginTop: 24 }} />
            ) : (
                <TouchableOpacity
                    style={[styles.primaryBtn, !isValid && { opacity: 0.6 }]}
                    onPress={submit}
                    disabled={!isValid}
                >
                    <Text style={styles.primaryBtnText}>{translate("updatePassword")}</Text>
                </TouchableOpacity>
            )}

            {/* 取消 */}
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel} disabled={isSending}>
                <Text style={styles.cancelButtonText}>{translate("cancel")}</Text>
            </TouchableOpacity>
            </View>
        </View>
    );
}

// ---- 樣式（深色主題 + 圓角 + 置中）----
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#39393B",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 28,
    },
    formWrap: {
        width: "100%",
    },
    logoContainer: {
        position: "absolute",
        top: 20,
        left: 20,
        zIndex: 10,
    },
    imgIcon: {
        resizeMode: "contain",
    },
    title: {
        fontSize: 28,
        fontWeight: "bold",
        color: "white",
        letterSpacing: 1,
    },
    inputRow: {
        width: "100%",
        height: 52,
        borderRadius: 14,
        backgroundColor: "#1C1C1C",
        flexDirection: "row",
        alignItems: "center",
        paddingLeft: 16,
    },
    input: {
        flex: 1,
        color: "white",
        fontSize: 16,
    },
    // 新增：眼睛按鈕與圖示
    eyeButton: {
        height: "100%",
        paddingHorizontal: 16,
        justifyContent: "center",
        alignItems: "center",
    },
    eyeIcon: {
        width: 22,
        height: 22,
        resizeMode: "contain",
        opacity: 0.9,
        tintColor: "#AAAAAA",
    },
    primaryBtn: {
        width: "100%",
        height: 52,
        borderRadius: 14,
        backgroundColor: "#0ABAB5",
        justifyContent: "center",
        alignItems: "center",
        marginTop: 24,
    },
    primaryBtnText: {
        color: "white",
        fontSize: 18,
        fontWeight: "bold",
        letterSpacing: 1,
    },
    cancelButton: {
        width: "100%",
        height: 46,
        borderRadius: 14,
        backgroundColor: "#555555",
        justifyContent: "center",
        alignItems: "center",
        marginTop: 14,
    },
    cancelButtonText: {
        color: "#CCCCCC",
        fontSize: 16,
    },
});
