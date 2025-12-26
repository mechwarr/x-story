// RootLayout.tsx
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import SafeAreaWrapper from './components/SafeAreaWrapper';
import AppNavigator from './navigations/AppNavigator';
import LoginContainer from './auth/LoginContainer';
import { LoadingProvider } from './screens/LoadingContext';
import { LoadingOverlay } from './components/LoadingOverlay';
import useInitApp from './hook/useInitApp';
import * as Linking from "expo-linking";
import { VerifyMail } from './config/authApiClient';
import tokenStorage from './auth/Storage';
import { ResetPasswordScreen } from './screens/ResetPasswordScreen';
import { AuthProvider } from "./auth/AuthContext";
import { CoinProvider } from './store/coinContext';


export default function RootLayout() {
  const { checking, isLoggedIn, setIsLoggedIn } = useInitApp();
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (token && token.length > 0) {
      tokenStorage.setStoreToken(token);
    }
  }, [token]);


  useEffect(() => {
    // 初次開啟 app 時處理 deep link
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    // App 運行中收到新的 deep link
    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleDeepLink(url);
    });

    return () => subscription.remove(); // 清除事件
  }, []);

  const handleDeepLink = async (url: string) => {
    try {
      const parsed = Linking.parse(url);
      console.log("📨 接收到 URL:", parsed);

      // 兼容 Android 將 "verify-email" 視為 hostname 的情況
      // 也處理像 xstoryscheme:///verify-email 這種會出現 path 前導斜線
      const routeRaw = (parsed.path ?? parsed.hostname ?? "").toString();
      const route = routeRaw.replace(/^\/+/, ""); // 移除前導 '/'

      const token = parsed.queryParams?.token as string | undefined;
      const email = parsed.queryParams?.email as string | undefined;

      if (!route) {
        console.log("⛔️ 不支援的連結格式（route 為空）");
        return;
      }

      switch (route) {
        case "verify-email": {
          if (!token) {
            console.log("⛔️ 缺少 token，無法驗證信箱");
            return;
          }
          console.log("🔗 處理驗證連結，token:", token);

          await VerifyMail({
            email: email || "",
            token: token,
          });
          break;
        }

        case "reset-password": {
          if (!token) {
            console.log("⛔️ 缺少 token，無法進入重設密碼流程");
            return;
          }
          console.log("🛠️ 進入重設密碼流程，token:", token);

          setIsResetPassword(true);
          setToken(token);
          break;
        }

        default:
          console.log("⛔️ 不支援的連結格式，route:", route);
          break;
      }
    } catch (err) {
      console.log("❌ handleDeepLink 發生錯誤:", err);
    }
  };

  const logout = async () => {
    setIsLoggedIn(false);
  };

  if (checking) {
    return (
      <SafeAreaWrapper style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </SafeAreaWrapper>
    );
  }

  return (
    <LoadingProvider>
      <AuthProvider value={{ isLoggedIn, setIsLoggedIn, logout }}>
        <CoinProvider>
          <SafeAreaWrapper style={{ flex: 1 }}>
          {isLoggedIn ? (
            // ✅ 已登入：進入主導覽
            <AppNavigator />
          ) : isResetPassword && token ? (
            // 🔐 重設密碼畫面
            <ResetPasswordScreen
              token={token}
              onCancel={() => setIsResetPassword(false)}   // 取消回到登入頁
              onSuccess={() => setIsResetPassword(false)}  // 成功後回到登入頁（也可改成直接導向登入）
            />
          ) : (
            // 🔑 尚未登入：顯示登入容器
            <LoginContainer onLoginSuccess={() => setIsLoggedIn(true)} />
          )}

          {/* 全域載入覆蓋層 */}
          <LoadingOverlay />
          </SafeAreaWrapper>
        </CoinProvider>
      </AuthProvider>
    </LoadingProvider>
  );

}

const styles = StyleSheet.create({
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
