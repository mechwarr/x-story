import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Image,
    Modal,
} from "react-native";
import { XStoryForgetPassword } from "./XStoryForgetPassword";
import { translate } from "../i18n/i18n";
import { loginWithXStory, LoginTokenResult } from "../config/authApiClient";
import useResponsive from "../hook/useResponsive";

interface Props {
    onLoginSuccess: (tokenResult: LoginTokenResult) => void;
    onCancel: () => void;
}

export function XStoryLogin({ onLoginSuccess, onCancel }: Props) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showForgetPassword, setShowForgetPassword] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const { isTablet, maxContentWidth } = useResponsive();

    const handleLogin = async () => {
        const tokenResult = await loginWithXStory({ email, password });
        if (tokenResult) onLoginSuccess(tokenResult);
    };

    return (
        <View style={[styles.container, isTablet && { paddingHorizontal: 24 }]}>
            <View style={styles.logoContainer}>
                <Image style={styles.imgIcon} source={require("../../assets/blueeye.png")} />
            </View>

            <View style={[styles.formWrap, isTablet && { maxWidth: maxContentWidth, width: '100%' }]}>
            <Text style={styles.title}>{translate("signInTitle")}</Text>

            <TextInput
                style={styles.input}
                placeholder={translate("email")}
                placeholderTextColor="#7F7F7F"
                value={email}
                onChangeText={setEmail}  // ← 綁定內部狀態
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
            />

            <View style={styles.passwordInputWrapper}>
                <TextInput
                    style={styles.passwordInput}
                    placeholder={translate("password")}
                    placeholderTextColor="#7F7F7F"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword((p) => !p)}>
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

            <TouchableOpacity style={styles.linkButton} onPress={() => setShowForgetPassword(true)}>
                <Text style={styles.linkButtonText}>{translate("forgotPasswordLink")}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
                <Text style={styles.loginButtonText}>{translate("signIn")}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
                <Text style={styles.cancelButtonText}>{translate("cancel")}</Text>
            </TouchableOpacity>
            </View>

            <Modal
                visible={showForgetPassword}
                animationType="slide"                 // 你可改 "fade" / "none"
                presentationStyle="overFullScreen"    // iOS：全螢幕覆蓋
                transparent={false}                   // false = 直接覆蓋底色，不透明
                onRequestClose={() => setShowForgetPassword(false)} // Android 返回鍵處理
            >
                <XStoryForgetPassword
                    onEmailChange={(v) => setEmail(v)}          // ← 正確把字串值往上傳
                    onCancel={() => setShowForgetPassword(false)}
                    onSuccess={() => setShowForgetPassword(false)}
                />
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
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
    },
    input: {
        width: "100%",
        height: 50,
        borderRadius: 25,
        backgroundColor: "#1C1C1C",
        paddingHorizontal: 20,
        fontSize: 16,
        color: "white",
        marginBottom: 15,
    },
    loginButton: {
        width: "100%",
        height: 50,
        borderRadius: 25,
        backgroundColor: "#0ABAB5",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 15,
        marginTop: 15,
    },
    loginButtonText: {
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
        marginBottom: 15,
    },
    cancelButtonText: {
        color: "#CCCCCC",
        fontSize: 16,
    },
    linkButton: {
        marginBottom: 30,
        marginRight: 10,
        alignSelf: "flex-end",
    },
    linkButtonText: {
        color: "#f0ad57",
        fontSize: 18,
        textDecorationLine: "underline",
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
    passwordInput: {
        flex: 1,
        fontSize: 16,
        color: "white",
    },
    eyeButton: { padding: 5 },
    eyeIcon: { width: 24, height: 24, tintColor: "#AAAAAA" },
});
