// hooks/useInitApp.ts
import { useEffect, useState } from 'react';
import { Platform, AppState, InteractionManager } from 'react-native';
import { showAlert } from "../components/CustomAlert";
import tokenStorage from '../auth/Storage';
import {initLanguageByLoginStatus} from '../i18n/initLanguage';
import { translate } from '../i18n/i18n';
import { initWeChatSDK } from '../../components/utils/wechatAuth';
import { tokenRefreshService } from '../config/authApiClient';
import { checkAccountSuspended } from '../config/userApiClient';
import { clearAllUserData } from '../services/clearUserDataService';

export default function useInitApp(
  onTokenRefreshProgress?: (isProgress: boolean) => void,
  onTokenRefreshFailed?: () => void,
  onBeforeLogout?: () => void,
  onTokenRefreshed?: () => void
) {
  const [checking, setChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const checkLoginStatus = async () => {
      const token = await tokenStorage.getToken();
      const loggedIn = !!token;

      console.log("[useInitApp] Token retrieved:", token ? `長度 ${token.length}` : 'null');
      setIsLoggedIn(loggedIn);

      // ✅ 初始化語言（根據登入與否判斷從 SecureStore or 裝置）
      // 包 try/catch：語系初始化失敗時最差退回英文，絕不可阻擋 App 啟動
      try {
        await initLanguageByLoginStatus(loggedIn);
      } catch (e) {
        console.error('[useInitApp] 語系初始化失敗，退回預設語言:', e);
      }

      // ✅ 如果已登入，檢查登入是否過期並刷新 token
      if (loggedIn) {
        console.log('[useInitApp] 🔄 檢測到登入狀態，檢查登入時間和刷新 token...');

        // 停權即時攔截（登入後才被停權的情境）：App 重新啟動時重查一次 roleLevel，
        // 若已被停權（<=0）→ 跳提示並登出（清資料、回登入頁）。獨立於 token 刷新的 1 小時
        // 節流，確保「每次重啟」都會重查。背景執行、不阻塞啟動；取不到 profile 時不誤登出。
        const handleSuspended = () => {
          showAlert(
            translate('accountSuspendedTitle'),
            translate('accountSuspendedMessage'),
            [
              {
                text: translate('ok'),
                onPress: async () => {
                  onBeforeLogout?.(); // 例如重置金幣 Context，避免換帳號後殘留
                  await clearAllUserData();
                  setIsLoggedIn(false);
                  console.log('[useInitApp] ✅ 帳號已停權，已登出並返回登入頁面');
                },
              },
            ],
            { cancelable: false }
          );
        };
        checkAccountSuspended()
          .then((suspended) => { if (suspended) handleSuspended(); })
          .catch((e) => console.warn('[useInitApp] 停權檢查例外（忽略）:', (e as any)?.message));

        // 創建登入過期處理函數（超過 30 天需要重新登入）
        const handleLoginExpired = () => {
          showAlert(
            '登入已過期',
            '您的登入已超過 30 天，為了帳戶安全，請重新登入。',
            [
              {
                text: translate('ok'),
                onPress: async () => {
                  onBeforeLogout?.(); // 例如重置金幣 Context，避免換帳號後殘留
                  await clearAllUserData();
                  setIsLoggedIn(false);
                  console.log('[useInitApp] ✅ 登入已過期，已退出登入，返回登入頁面');
                },
              },
            ],
            { cancelable: false }
          );
        };
        
        // 創建刷新失敗處理函數（可以訪問內部的 setIsLoggedIn）
        const handleRefreshFailed = () => {
          showAlert(
            '帳戶權限過期',
            '您的登入權限已過期，請重新登入。',
            [
              {
                text: translate('ok'),
                onPress: async () => {
                  onBeforeLogout?.(); // 例如重置金幣 Context，避免換帳號後殘留
                  await clearAllUserData();
                  setIsLoggedIn(false);
                  console.log('[useInitApp] ✅ 已退出登入，返回登入頁面');
                },
              },
            ],
            { cancelable: false }
          );
        };
        
        // 如果外部提供了失敗回調，優先使用外部的（用於應用喚醒場景）
        // 否則使用內部的失敗處理（用於應用重啟場景）
        const refreshFailedCallback = onTokenRefreshFailed || handleRefreshFailed;

        // 背景刷新 token（不 await）：避免刷新端點連不上時，啟動畫面卡在網路 timeout（~70s）。
        // 關鍵在於「不 await」→ 不阻塞下方 setChecking(false)，App 先以現有 token 進入主畫面。
        // onProgress 維持原機制（刷新期間顯示／結束隱藏 loading）；註：未達刷新間隔(1h)會提早
        // return、根本不會觸發 onProgress，故正常啟動不會閃 loading。
        // 刷新成功會更新 token，真·權限過期 / 超過 30 天仍由 callback 提示登出，網路異常則不登出。
        tokenRefreshService
          .refreshToken(
            onTokenRefreshProgress, // onProgress：刷新進度（顯示/隱藏 loading）
            refreshFailedCallback,
            handleLoginExpired,
            undefined // onNetworkError：網路異常不登出
          )
          .then((ok) => {
            // 刷新成功（或未達刷新間隔仍視為 token 有效）後，用（可能是新的）token 立即重抓金幣，
            // 避免 AppHeader 先前用舊/過期 token 抓失敗後卡著舊餘額（修法 3）。
            if (ok) onTokenRefreshed?.();
          })
          .catch((e) =>
            console.warn('[useInitApp] 背景刷新 token 例外（忽略）:', (e as any)?.message)
          );
      }

      // ✅ 初始化微信 SDK（僅在 iOS 平台）
      // 優先執行 Bridge 初始化，成功後才初始化 WeChatModule
      // 使用 InteractionManager 確保在應用完全啟動後再初始化
      if (Platform.OS === 'ios') {
        // 等待下一個事件循環，確保 Bridge 有時間初始化
        InteractionManager.runAfterInteractions(() => {
          // 再等待一小段時間，確保 Bridge 完全初始化
          setTimeout(() => {
            console.log('[useInitApp] 開始初始化微信 SDK（Bridge 優先）...');
            console.log(`   當前 AppState: ${AppState.currentState}`);
            
            initWeChatSDK()
              .then((success) => {
                if (success) {
                  console.log('✅ [useInitApp] 微信 SDK 初始化成功');
                } else {
                  console.warn('⚠️ [useInitApp] 微信 SDK 初始化返回 false');
                }
              })
              .catch((error) => {
                // 捕獲錯誤並顯示 Alert
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error('❌ [useInitApp] 微信 SDK 初始化失敗:', error);
                console.error('   錯誤詳情:', {
                  message: errorMessage,
                  stack: error instanceof Error ? error.stack : undefined,
                  appState: AppState.currentState,
                });
                
                // 顯示 Alert 通知用戶
                showAlert(
                  '微信功能初始化失敗',
                  `${errorMessage}\n\n微信登入功能可能無法使用。如果問題持續，請聯繫客服。`,
                  [{ text: translate('ok') }]
                );
              });
          }, 500); // 額外等待 500ms，確保 Bridge 有時間初始化
        });
      }

      setChecking(false);
    };

    checkLoginStatus();
  }, []);

  return { checking, isLoggedIn, setIsLoggedIn };
}

