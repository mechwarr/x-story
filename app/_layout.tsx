// RootLayout.tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ActivityIndicator, StyleSheet, AppState, AppStateStatus, Alert } from 'react-native';
import SafeAreaWrapper from './components/SafeAreaWrapper';
import AppNavigator from './navigations/AppNavigator';
import LoginContainer from './auth/LoginContainer';
import { LoadingProvider, useLoading } from './screens/LoadingContext';
import { LoadingOverlay } from './components/LoadingOverlay';
import useInitApp from './hook/useInitApp';
import * as Linking from "expo-linking";
import { VerifyMail, tokenRefreshService, logoutWithXStory } from './config/authApiClient';
import tokenStorage from './auth/Storage';
import { ResetPasswordScreen } from './screens/ResetPasswordScreen';
import { AuthProvider } from "./auth/AuthContext";
import { CoinProvider } from './store/coinContext';
import { clearAllUserData } from './services/clearUserDataService';
import { translate } from './i18n/i18n';

// 內部組件，用於訪問 LoadingContext
function RootLayoutContent() {
  const { showLoading, hideLoading } = useLoading();
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const appState = useRef(AppState.currentState);
  const coinResetRef = useRef<(() => void) | null>(null);

  // 傳遞 progress callback 給 useInitApp（應用重啟時使用）
  const handleTokenRefreshProgress = (isProgress: boolean) => {
    if (isProgress) {
      showLoading();
    } else {
      hideLoading();
    }
  };

  const { checking, isLoggedIn, setIsLoggedIn } = useInitApp(
    handleTokenRefreshProgress,
    undefined,
    () => coinResetRef.current?.() // 冷啟動時 token 過期/刷新失敗登出前也重置金幣
  );

  // 處理 token 刷新失敗：顯示 alert 並清除資料（用於應用喚醒場景）
  const handleTokenRefreshFailed = useCallback(() => {
    Alert.alert(
      '帳戶權限過期',
      '您的登入權限已過期，請重新登入。',
      [
        {
          text: translate('ok'),
          onPress: async () => {
            coinResetRef.current?.(); // 換帳號後不殘留上一用戶金幣
            await clearAllUserData();
            setIsLoggedIn(false);
            console.log('[RootLayout] ✅ 已退出登入，返回登入頁面');
          },
        },
      ],
      { cancelable: false }
    );
  }, [setIsLoggedIn]);

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

  // ✅ 監聽應用狀態變化（喚醒事件）
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      console.log('[RootLayout] 📱 AppState 變化:', {
        previous: appState.current,
        next: nextAppState,
      });

      // 當應用從背景恢復到前景時
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('[RootLayout] 🔄 應用已喚醒，檢查是否需要刷新 token...');
        // 短暫延遲再刷新，避免剛喚醒時網路尚未就緒導致請求失敗
        await new Promise((r) => setTimeout(r, 400));

        // 檢查是否有登入狀態
        const existingToken = await tokenStorage.getToken();
        if (existingToken && isLoggedIn) {
          console.log('[RootLayout] ✅ 檢測到登入狀態，檢查登入時間和刷新 token...');
          
          // 創建登入過期處理函數（超過 30 天需要重新登入）
          const handleLoginExpired = () => {
            Alert.alert(
              '登入已過期',
              '您的登入已超過 30 天，為了帳戶安全，請重新登入。',
              [
                {
                  text: translate('ok'),
                  onPress: async () => {
                    coinResetRef.current?.(); // 換帳號後不殘留上一用戶金幣
                    await clearAllUserData();
                    setIsLoggedIn(false);
                    console.log('[RootLayout] ✅ 登入已過期，已退出登入');
                  },
                },
              ],
              { cancelable: false }
            );
          };

          // 網路異常時僅提示、不登出（超過一小時回來若網路未就緒常會觸發）
          const handleNetworkError = () => {
            Alert.alert(
              '網路異常',
              '無法連線更新登入狀態，請檢查網路後再試。您可繼續使用，下次回到 App 時會再嘗試更新。',
              [{ text: translate('ok') }]
            );
          };

          await tokenRefreshService.refreshToken(
            (isProgress) => {
              if (isProgress) {
                showLoading();
              } else {
                hideLoading();
              }
            },
            handleTokenRefreshFailed,
            handleLoginExpired,
            handleNetworkError
          );
        } else {
          console.log('[RootLayout] ⚠️ 未登入或無 token，跳過刷新');
        }
      }

      appState.current = nextAppState;
    };

    // 監聽 AppState 變化
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [isLoggedIn, showLoading, hideLoading, handleTokenRefreshFailed, setIsLoggedIn]);

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
    await logoutWithXStory(); // 帶上 refreshToken、accessToken 讓後端失效
    await clearAllUserData();
    coinResetRef.current?.(); // 清除金幣 Context 狀態，避免換帳號後仍顯示上一用戶餘額
    setIsLoggedIn(false);
  };

  /** 僅清除本地資料並登出，不呼叫後端（用於刪除帳號成功後） */
  const logoutLocalOnly = async () => {
    await clearAllUserData();
    coinResetRef.current?.();
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
    <AuthProvider value={{ isLoggedIn, setIsLoggedIn, logout, logoutLocalOnly }}>
      <CoinProvider resetRef={coinResetRef}>
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
  );
}

// 導出組件，外層包裹 LoadingProvider
export default function RootLayout() {
  return (
    <LoadingProvider>
      <RootLayoutContent />
    </LoadingProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
