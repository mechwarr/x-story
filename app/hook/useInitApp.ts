// hooks/useInitApp.ts
import { useEffect, useState } from 'react';
import { Platform, AppState, InteractionManager } from 'react-native';
import { showAlert } from "../components/CustomAlert";
import tokenStorage from '../auth/Storage';
import {initLanguageByLoginStatus} from '../i18n/initLanguage';
import { translate } from '../i18n/i18n';
import { initWeChatSDK } from '../../components/utils/wechatAuth';
import { tokenRefreshService } from '../config/authApiClient';
import { clearAllUserData } from '../services/clearUserDataService';

export default function useInitApp(
  onTokenRefreshProgress?: (isProgress: boolean) => void,
  onTokenRefreshFailed?: () => void,
  onBeforeLogout?: () => void
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
        
        // 調用刷新 token（內部會先檢查是否超過 30 天）；網路異常時不登出
        await tokenRefreshService.refreshToken(
          onTokenRefreshProgress,
          refreshFailedCallback,
          handleLoginExpired,
          undefined // onNetworkError：應用重啟時可選提示，此處不額外處理
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

