// RootLayout.tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import SafeAreaWrapper from './components/SafeAreaWrapper';
import BootScreen from './components/BootScreen';
import AppNavigator from './navigations/AppNavigator';
import LoginContainer from './auth/LoginContainer';
import { LoadingProvider, useLoading } from './screens/LoadingContext';
import { LoadingOverlay } from './components/LoadingOverlay';
import useInitApp from './hook/useInitApp';
import * as Linking from "expo-linking";
import { VerifyMail, tokenRefreshService, logoutWithXStory } from './config/authApiClient';
import tokenStorage from './auth/Storage';
import { ResetPasswordScreen } from './screens/ResetPasswordScreen';
import { emitVerifyRedirect } from './auth/verifyRedirect';
import { AuthProvider } from "./auth/AuthContext";
import { CoinProvider } from './store/coinContext';
import { clearAllUserData } from './services/clearUserDataService';
import { checkAccountSuspended } from './config/userApiClient';
import { translate } from './i18n/i18n';
import { CustomAlertHost, showAlert } from './components/CustomAlert';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import { registerSessionExpiredHandler, resetSessionExpiredLatch } from './config/sessionAuth';
import { registerSuspendedHandler, resetSuspensionLatch } from './config/suspensionGuard';

// 以目前語系為 key 包住主畫面：手動切換語系時整個子樹重新掛載，
// 讓所有畫面重新讀取 translate() 並套用新語系（translate 本身不會觸發重繪）。
function LanguageGate({ children }: { children: React.ReactNode }) {
  const { lang } = useLanguage();
  return <React.Fragment key={lang}>{children}</React.Fragment>;
}

// 內部組件，用於訪問 LoadingContext
function RootLayoutContent() {
  const { showLoading, hideLoading } = useLoading();
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const appState = useRef(AppState.currentState);
  const coinResetRef = useRef<(() => void) | null>(null);
  // token 刷新成功後，透過此 ref 觸發金幣以新 token 重抓（CoinProvider 掛載時填入）。
  const coinRefreshRef = useRef<((force?: boolean) => void) | null>(null);

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
    () => coinResetRef.current?.(), // 冷啟動時 token 過期/刷新失敗登出前也重置金幣
    () => coinRefreshRef.current?.() // 冷啟動 token 刷新成功後，用新 token 立即重抓金幣
  );

  // 目前 UI 是否為登入態。全域的「權限過期」處理是註冊進 sessionAuth 的常駐 callback，
  // 讀不到最新的 state，故以 ref 同步。
  const isLoggedInRef = useRef(isLoggedIn);
  useEffect(() => {
    isLoggedInRef.current = isLoggedIn;
  }, [isLoggedIn]);

  // 處理 token 刷新失敗：顯示 alert 並清除資料（用於應用喚醒場景）
  const handleTokenRefreshFailed = useCallback(() => {
    // 畫面不在登入態時一律不跳窗。兩種情況：
    //  1. 已登出／未登入 —— 資料早已清乾淨，再彈「帳戶權限過期」只是噪音。
    //  2. 登入成功後、進主畫面前的空窗（saveLoginData 已寫 token 並解鎖閂鎖，
    //     但 onLoginSuccess 尚未執行）——此時 profile／金幣等請求若回 401 會走到這裡，
    //     不可跳窗、更不可清掉剛存好的登入資料，否則會把正在登入的使用者打回登入頁。
    //     token 若真的無效，進主畫面後的 API 仍會 401 並走正常過期流程。
    if (!isLoggedInRef.current) {
      console.log('[RootLayout] ⏸ 目前非登入態，略過權限過期彈窗');
      // 觸發端已取用過閂鎖，這裡沒真的提示就要還回去，
      // 否則之後進入主畫面真的發生權限過期時會被靜靜吞掉。
      resetSessionExpiredLatch();
      return;
    }
    showAlert(
      translate('authExpiredTitle'),
      translate('authExpiredMessage'),
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

  // 註：此處原本有一段「token 有值就 setStoreToken(token)」的 effect，已移除。
  // 這個 token state 只由 reset-password deep link 設值（見 handleDeepLink），
  // 等於把「重設密碼用的一次性 token」寫進 SecureStore 的 accessToken 欄位，
  // 導致下次冷啟動被誤判為已登入 → 背景刷新必失敗 → 誤跳「帳戶權限過期」。
  // 真正的 accessToken 一律由登入流程的 Storage.saveLoginData 寫入。

  // 停權即時攔截（登入後才被停權）：喚醒刷新 token 後重查 roleLevel，若已被停權（<=0）→ 提示並登出。
  const handleAccountSuspended = useCallback(() => {
    // 與權限過期同理：非登入態不跳窗。登入當下的停權攔截由 LoginContainer 自行處理
    //（清 token + 跳停權提示 + 不進主畫面），這裡再跳一則會變成登入頁上的重複彈窗。
    if (!isLoggedInRef.current) {
      console.log('[RootLayout] ⏸ 目前非登入態，略過停權彈窗');
      // 同樣把閂鎖還回去，避免之後真的進入 App 後停權驅離被吞掉。
      resetSuspensionLatch();
      return;
    }
    showAlert(
      translate('accountSuspendedTitle'),
      translate('accountSuspendedMessage'),
      [
        {
          text: translate('ok'),
          onPress: async () => {
            coinResetRef.current?.(); // 換帳號後不殘留上一用戶金幣
            await clearAllUserData();
            setIsLoggedIn(false);
            console.log('[RootLayout] ✅ 帳號已停權，已登出並返回登入頁面');
          },
        },
      ],
      { cancelable: false }
    );
  }, [setIsLoggedIn]);

  // 註冊「被動式權限過期」處理：任一支帶授權的 API 收到 401 且刷新失敗（token_invalid）時，
  // 由底層透過 sessionAuth 觸發這裡，走與喚醒刷新失敗相同的登出流程（顯示 alert、清資料、回登入頁）。
  // sessionAuth 內部已對同一波併發 401 去重，這裡不會被重複觸發。
  useEffect(() => {
    registerSessionExpiredHandler(handleTokenRefreshFailed);
  }, [handleTokenRefreshFailed]);

  // 註冊「停權強制驅離」處理：任一支帶 token 的 API 活動觸發（節流的）停權重查，
  // 查得 roleLevel <= 0 時由 suspensionGuard 觸發這裡——顯示停權提示、確認後清資料登出。
  // suspensionGuard 內部有閂鎖，同一波不會重複觸發。
  useEffect(() => {
    registerSuspendedHandler(handleAccountSuspended);
  }, [handleAccountSuspended]);


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
            showAlert(
              translate('sessionExpiredTitle'),
              translate('sessionExpiredMessage'),
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
            showAlert(
              translate('networkErrorTitle'),
              translate('networkErrorMessage'),
              [{ text: translate('ok') }]
            );
          };

          const refreshed = await tokenRefreshService.refreshToken(
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

          // 喚醒刷新成功後，用（可能是新的）token 立即重抓金幣，避免回到前景時卡著舊餘額（修法 3）。
          if (refreshed) {
            coinRefreshRef.current?.();
            // 停權即時攔截：刷新後重查 roleLevel，若已被停權（<=0）→ 提示並登出。
            checkAccountSuspended()
              .then((suspended) => { if (suspended) handleAccountSuspended(); })
              .catch((e) => console.warn('[RootLayout] 停權檢查例外（忽略）:', (e as any)?.message));
          }
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
  }, [isLoggedIn, showLoading, hideLoading, handleTokenRefreshFailed, handleAccountSuspended, setIsLoggedIn]);

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

          const verified = await VerifyMail({
            email: email || "",
            token: token,
          });
          if (verified) {
            // 驗證成功：顯示 i18n 標題／內文，按 OK 後跳回會員 Email 登入頁
            showAlert(
              translate("emailVerifiedTitle"),
              translate("emailVerifiedMessage"),
              [{ text: translate("ok"), onPress: () => emitVerifyRedirect() }]
            );
          }
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

  // token 檢查期間與後續的「初始落點判定」（AppNavigator）共用同一張過場畫面
  // （App 底色＋進度圈），啟動全程不落白畫面、不先誤入任何頁面。
  if (checking) {
    return (
      <SafeAreaWrapper style={{ flex: 1 }}>
        <BootScreen />
      </SafeAreaWrapper>
    );
  }

  return (
    <AuthProvider value={{ isLoggedIn, setIsLoggedIn, logout, logoutLocalOnly }}>
      <CoinProvider resetRef={coinResetRef} refreshRef={coinRefreshRef}>
        <LanguageProvider>
        <SafeAreaWrapper style={{ flex: 1 }}>
        <LanguageGate>
        {isLoggedIn ? (
          // ✅ 已登入：進入主導覽
          <AppNavigator />
        ) : isResetPassword && token ? (
          // 🔐 重設密碼畫面
          <ResetPasswordScreen
            token={token}
            // 取消：回到登入首頁
            onCancel={() => {
              setIsResetPassword(false);
              setToken(null);
            }}
            // 成功：回到「會員 Email 登入頁」讓使用者用新密碼登入（沿用信箱驗證成功的導向機制）
            onSuccess={() => {
              emitVerifyRedirect();
              setIsResetPassword(false);
              setToken(null);
            }}
          />
        ) : (
          // 🔑 尚未登入：顯示登入容器
          <LoginContainer onLoginSuccess={() => setIsLoggedIn(true)} />
        )}
        </LanguageGate>

        {/* 全域載入覆蓋層 */}
        <LoadingOverlay />
        {/* 全域自訂 Alert 覆蓋層（取代原生 Alert.alert） */}
        <CustomAlertHost />
        </SafeAreaWrapper>
        </LanguageProvider>
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

