// hooks/useInitApp.ts
import { useEffect, useState } from 'react';
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

      // ✅ 初始化微信 SDK（安全初始化，不會阻止應用啟動）
      // 延遲一小段時間確保原生模組已完全註冊
      setTimeout(() => {
        console.log('[useInitApp] 開始初始化微信 SDK...');
        initWeChatSDK().catch(err => {
          console.warn('[useInitApp] 微信 SDK 初始化失敗:', err);
        });
      }, 500); // 延遲 500ms 確保 React Native 橋接已完全初始化

      setChecking(false);
    };

    checkLoginStatus();
  }, []);

  return { checking, isLoggedIn, setIsLoggedIn };
}

