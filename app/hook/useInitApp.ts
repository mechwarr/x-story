// hooks/useInitApp.ts
import { useEffect, useState } from 'react';
import { Alert, Platform, AppState, InteractionManager } from 'react-native';
import tokenStorage from '../auth/Storage';
import {initLanguageByLoginStatus} from '../i18n/initLanguage';
import { initWeChatSDK } from '../../components/utils/wechatAuth';

export default function useInitApp() {
  const [checking, setChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const checkLoginStatus = async () => {
      const token = await tokenStorage.getToken();
      const loggedIn = !!token;

      console.log("[useInitApp] Token retrieved:", token);
      setIsLoggedIn(loggedIn);

      // ✅ 初始化語言（根據登入與否判斷從 SecureStore or 裝置）
      await initLanguageByLoginStatus(loggedIn);

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
                Alert.alert(
                  '微信功能初始化失敗',
                  `${errorMessage}\n\n微信登入功能可能無法使用。如果問題持續，請聯繫客服。`,
                  [{ text: '確定' }]
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

