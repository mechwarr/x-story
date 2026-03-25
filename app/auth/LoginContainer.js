import React, { useCallback, useEffect, useState } from "react";
import { appleLogin } from "../../components/utils/appleAuth";
import { facebookLogin } from "../../components/utils/facebookAuth";
import {
  googleSignInSilently,
  googleSignInInteractive,
  getGoogleTokens,
} from '../../components/utils/googleAuth';
import { wechatLogin } from "../../components/utils/wechatAuth";
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen"
import { RegisterXStoryScreen } from "../screens/RegisterXStoryScreen";
import { XStoryLogin } from "../screens/XStoryLogin"
import { Alert, View, BackHandler, Keyboard, KeyboardAvoidingView, TouchableWithoutFeedback, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import tokenStorage from './Storage';
import { translate } from "../i18n/i18n";
import {
  facebookLoginWithXStory,
  googleLoginWithXStory,
  appleLoginWithXStory,
  wechatLoginWithXStory
} from '../config/authApiClient';
import { useCoins } from '../store/coinContext';

export default function LoginContainer({ onLoginSuccess }) {
  const { refreshCoins } = useCoins();
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [showRegisterView, setshowRegisterView] = useState(true);
  const [historyStack, setHistoryStack] = useState([]);

  // 小工具：判斷是否為「使用者取消」的錯誤，不要跳出 alert
  // （盡量涵蓋常見的 code / message 關鍵字，若第三方 SDK 實際回傳不同，可再擴充）
  const isUserCancelError = (e) => {
    const code = (e?.code ?? e?.errorCode ?? '').toString().toLowerCase();
    const msg = (e?.message ?? '').toString().toLowerCase();
    return (
      code.includes('canceled') ||
      code.includes('cancelled') ||
      code.includes('user_cancel') ||
      msg.includes('canceled') ||
      msg.includes('cancelled') ||
      msg.includes('user canceled') ||
      msg.includes('user cancelled') ||
      msg.includes('使用者取消') ||
      msg.includes('取消')
    );
  };

  const handleXStoryLogin = () => {
    setHistoryStack((prev) => [...prev, 'emailLogin']);
    setShowEmailLogin(true);
  };

  const handleXStoryLoginCancel = () => {
    setShowEmailLogin(false);
  };

  /** 登入成功：先觸發金幣刷新（新帳號餘額），再切換至主畫面 */
  const handleLoginSuccess = useCallback(() => {
    refreshCoins(true);
    onLoginSuccess();
  }, [onLoginSuccess, refreshCoins]);

  const handleXStoryLoginSuccess = async (tokenResult) => {
    console.log('handleXStoryLoginSuccess tokenResult:', {
      hasAccessToken: !!tokenResult?.accessToken,
      hasRefreshToken: !!tokenResult?.refreshToken,
    });
    
    if (tokenResult?.accessToken) {
      console.log('[XStory Email Login] 後端回傳 accessToken:', tokenResult.accessToken);
      // 使用新的 saveLoginData 方法一次存儲所有登入資料
      await tokenStorage.saveLoginData({
        accessToken: tokenResult.accessToken,
        refreshToken: tokenResult.refreshToken,
      });
      handleLoginSuccess();
    }
  };

  const handleEmailVerificationCancel = () => {
    setShowEmailVerification(false);
  };

  const handleFacebookLogin = async () => {
    let body = null;
    try {
      console.log('[Facebook Login] 開始登入流程，平台:', Platform.OS);

      if (Platform.OS === "ios") {
        // iOS 跟 Android 一樣：直接取得 accessToken，送後端換 server token
        console.log('[Facebook Login] iOS 使用 Classic Login（取得 accessToken）');
        const accessToken = await facebookLogin();
        if (!accessToken) {
          console.log('[Facebook Login] iOS Classic 登入返回 null（可能是使用者取消）');
          return;
        }
        console.log('[Facebook Login] iOS 取得 accessToken，長度:', accessToken.length);
        body = {
          token: accessToken,
        };
      } else {
        // 走傳統 Access Token
        console.log('[Facebook Login] Android 使用傳統 Access Token');
        const accessToken = await facebookLogin();
        // 若使用者取消，不提示，直接結束
        if (!accessToken) {
          console.log('[Facebook Login] Android 登入返回 null（可能是使用者取消）');
          return;
        }

        console.log('[Facebook Login] Android 取得 accessToken，長度:', accessToken.length);

        body = {
          token: accessToken     // 統一欄位名為 token
        };
      }

      if (!body) {
        // 到這裡通常代表流程未取得必要憑證（多半是取消或無效回傳）
        console.warn('[Facebook Login] body 為空，無法繼續');
        return;
      }

      console.log('[Facebook Login] 準備呼叫後端 API，body:', {
        hasToken: !!body.token,
        tokenLength: body.token?.length || 0,
      });

      let tokenResult = await facebookLoginWithXStory(body); // 你的 API 呼叫
      if (tokenResult?.accessToken) {
        console.log('[Facebook Login] 後端回傳 accessToken:', tokenResult.accessToken);
        console.log('[Facebook Login] 後端登入成功，accessToken 長度:', tokenResult.accessToken.length);
        console.log('[Facebook Login] 後端登入成功，refreshToken 長度:', tokenResult.refreshToken?.length || 0);
        // 使用新的 saveLoginData 方法一次存儲所有登入資料
        await tokenStorage.saveLoginData({
          accessToken: tokenResult.accessToken,
          refreshToken: tokenResult.refreshToken,
        });
        // 驗證：tokenStorage 是否真的成功落盤（避免「看似成功、實際未存」）
        const storedAccessToken = await tokenStorage.getToken();
        console.log('[Facebook Login] ✅ 存入後 accessToken 長度:', storedAccessToken?.length || 0);
        console.log('[Facebook Login] ✅ 存入後 accessToken 是否等於後端回傳:', storedAccessToken === tokenResult.accessToken);
        if (storedAccessToken) {
          console.log('[Facebook Login] ✅ 存入的 accessToken:', storedAccessToken);
        }
        handleLoginSuccess();
      } else {
        console.error('[Facebook Login] 後端返回的 accessToken 為空');
        console.error('[Facebook Login] ✅ 送往後端的 token:', body?.token);
        alert("serverToken is empty, please try again");
      }
    } catch (e) {
      // 取消不提示；其他錯誤才提示
      if (isUserCancelError(e)) {
        console.log('[Facebook Login] 使用者取消登入');
        return;
      }
      console.error('[Facebook Login] 發生錯誤:', e);
      console.error('[Facebook Login] ✅ 目前取得的 token（若有）:', body?.token);
      alert("Facebook 登入錯誤: " + (e?.message ?? String(e)));
    }
  };

  const handleGoogleLogin = async () => {
    try {
      console.log('[Google Login] ========== 開始 Google 登入流程 ==========');
      console.log('[Google Login] 平台:', Platform.OS);
      
      let res = null;
      let idToken = null;
      
      // iOS 上強制使用互動式登入，確保顯示登入視窗
      if (Platform.OS === 'ios') {
        console.log('[Google Login] iOS 平台：直接使用互動式登入，確保顯示登入視窗');
        console.log('[Google Login] ⚠️ 應該會跳出 Google 登入視窗，請確認視窗是否出現');
        res = await googleSignInInteractive();
        console.log('[Google Login] 互動式登入結果:', {
          ok: res.ok,
          reason: res.reason,
          code: res.code,
          message: res.message,
          hasUser: !!res.user,
          hasIdToken: !!res.idToken,
          idTokenLength: res.idToken?.length || 0,
        });
      } else {
        // Android 上先試靜默登入，失敗再互動式登入
        console.log('[Google Login] 步驟 1: 嘗試靜默登入...');
        res = await googleSignInSilently();
        console.log('[Google Login] 靜默登入結果:', {
          ok: res.ok,
          reason: res.reason,
          code: res.code,
          message: res.message,
          hasUser: !!res.user,
          hasIdToken: !!res.idToken,
          idTokenLength: res.idToken?.length || 0,
        });
        
        // 如果靜默登入失敗或沒有有效的 idToken，使用互動式登入
        if (!res.ok || !res.idToken || res.idToken.length === 0) {
          console.log('[Google Login] 靜默登入失敗或無有效 token，嘗試互動式登入...');
          res = await googleSignInInteractive();
          console.log('[Google Login] 互動式登入結果:', {
            ok: res.ok,
            reason: res.reason,
            code: res.code,
            message: res.message,
            hasUser: !!res.user,
            hasIdToken: !!res.idToken,
            idTokenLength: res.idToken?.length || 0,
          });
        }
      }

      // 2) 檢查登入結果和 token 有效性
      if (!res || !res.ok) {
        console.error('[Google Login] 登入失敗或取消，原因:', res?.reason || '未知');
        // 若是使用者取消，不要 alert
        if (res?.reason === 'cancelled' || res?.code === 'canceled' || res?.code === 'cancelled') {
          console.log('[Google Login] 使用者取消登入，結束流程');
          return;
        }
        const errorMsg = res?.message || res?.code || 'Google 登入失敗，請稍後再試';
        console.error('[Google Login] 顯示錯誤訊息:', errorMsg);
        Alert.alert('Google 登入錯誤', errorMsg);
        return;
      }
      
      // 檢查是否有有效的 idToken
      if (!res.idToken || res.idToken.length === 0) {
        console.error('[Google Login] 登入成功但沒有有效的 idToken');
        Alert.alert('Google 登入錯誤', '未取得有效的登入憑證，請重試');
        return;
      }
      
      console.log('[Google Login] ✅ 登入成功，進入 token 處理階段');

      // 3) 成功：拿到使用者與 token
      console.log('[Google Login] 登入成功，使用者資訊:', {
        email: res.user?.email,
        id: res.user?.id,
        hasIdToken: !!res.idToken,
        idTokenLength: res.idToken?.length || 0,
        platform: Platform.OS,
      });

      // 優先用 wrapper 已帶回的 idToken；若沒有，再補拿一次（iOS 上可能需要重試）
      idToken = res.idToken ?? null;
      if (!idToken || idToken.length === 0) {
        console.log('[Google Login] res.idToken 為空，嘗試重新取得 tokens...');
        try {
          const tokens = await getGoogleTokens();
          idToken = tokens.idToken ?? null;
          console.log('[Google Login] 重新取得 tokens 結果:', {
            hasIdToken: !!idToken,
            idTokenLength: idToken?.length || 0,
          });
        } catch (tokenError) {
          console.error('[Google Login] 重新取得 tokens 失敗:', tokenError);
          const errorMsg = tokenError?.message || String(tokenError) || '無法取得登入憑證';
          Alert.alert('Google 登入錯誤', `無法取得登入憑證：${errorMsg}`);
          return;
        }
      }

      if (!idToken || idToken.length === 0) {
        console.error('[Google Login] 最終 idToken 為空，無法繼續');
        Alert.alert('Google 登入錯誤', '未取得 Google 登入憑證，請重試');
        return;
      }

      console.log('[Google Login] 準備呼叫後端 API，idToken 長度:', idToken.length);
      console.log('[Google Login] idToken 前 100 字元:', idToken.substring(0, 100));

      // 4) 呼叫你原本的後端 API 換取 server access token
      try {
        const tokenResult = await googleLoginWithXStory({ idToken });

        console.log('[Google Login] 後端 API 回應結果:', {
          hasAccessToken: !!tokenResult?.accessToken,
          accessTokenLength: tokenResult?.accessToken?.length || 0,
          hasRefreshToken: !!tokenResult?.refreshToken,
          refreshTokenLength: tokenResult?.refreshToken?.length || 0,
          tokenPreview: tokenResult?.accessToken ? tokenResult.accessToken.substring(0, 50) + '...' : null,
        });

        if (tokenResult?.accessToken) {
          console.log('[Google Login] 後端回傳 accessToken:', tokenResult.accessToken);
          console.log('[Google Login] 後端登入成功，accessToken 長度:', tokenResult.accessToken.length);
          console.log('[Google Login] 後端登入成功，refreshToken 長度:', tokenResult.refreshToken?.length || 0);
          // 使用新的 saveLoginData 方法一次存儲所有登入資料
          await tokenStorage.saveLoginData({
            accessToken: tokenResult.accessToken,
            refreshToken: tokenResult.refreshToken,
          });
          // 驗證：tokenStorage 是否真的成功落盤（避免「看似成功、實際未存」）
          const storedAccessToken = await tokenStorage.getToken();
          console.log('[Google Login] ✅ 存入後 accessToken 長度:', storedAccessToken?.length || 0);
          console.log('[Google Login] ✅ 存入後 accessToken 是否等於後端回傳:', storedAccessToken === tokenResult.accessToken);
          if (storedAccessToken) {
            console.log('[Google Login] ✅ 存入的 accessToken:', storedAccessToken);
          }
          handleLoginSuccess();
        } else {
          console.error('[Google Login] 後端返回的 accessToken 為空');
          console.error('[Google Login] 請檢查 console 中的 [Google Login API] 後端回應 日誌，查看具體錯誤訊息');
          console.error('[Google Login] ✅ 送往後端的 idToken:', idToken);
          Alert.alert('Google 登入錯誤', '伺服器驗證失敗，請稍後再試');
        }
      } catch (apiError) {
        console.error('[Google Login] 後端 API 調用失敗:', apiError);
        const errorMsg = apiError?.message || '網路請求失敗，請檢查網路連線';
        console.error('[Google Login] ✅ 送往後端的 idToken:', idToken);
        Alert.alert('Google 登入錯誤', errorMsg);
      }
    } catch (e) {
      // 所有錯誤都顯示 Alert
      console.error('[Google Login] 發生未預期的錯誤:', e);
      
      // 使用者取消不顯示錯誤
      if (isUserCancelError(e)) {
        console.log('[Google Login] 使用者取消登入');
        return;
      }
      
      // 其他錯誤都顯示
      const errorMsg = e?.message || String(e) || 'Google 登入發生錯誤，請稍後再試';
      console.error('[Google Login] ✅ 送往後端的 idToken（若有）:', idToken);
      Alert.alert('Google 登入錯誤', errorMsg);
    }
  };

  const handleAppleLogin = async () => {
    let appleAuthResult = null;
    try {
      appleAuthResult = await appleLogin();
      // 若使用者取消或未回傳 token，不提示，直接返回
      if (!appleAuthResult?.idToken) return;

      console.log('[Apple Login] Apple 回傳憑證:', {
        hasIdToken: !!appleAuthResult.idToken,
        idTokenLength: appleAuthResult.idToken?.length || 0,
        hasAuthorizationCode: !!appleAuthResult.authorizationCode,
        hasUser: !!appleAuthResult.user,
      });

      const tokenResult = await appleLoginWithXStory({
        idToken: appleAuthResult.idToken,
        authorizationCode: appleAuthResult.authorizationCode,
        user: appleAuthResult.user,
      });
      if (tokenResult?.accessToken) {
        console.log('[Apple Login] 後端回傳 accessToken:', tokenResult.accessToken);
        console.log('[Apple Login] 後端登入成功，accessToken 長度:', tokenResult.accessToken.length);
        console.log('[Apple Login] 後端登入成功，refreshToken 長度:', tokenResult.refreshToken?.length || 0);
        // 使用新的 saveLoginData 方法一次存儲所有登入資料
        await tokenStorage.saveLoginData({
          accessToken: tokenResult.accessToken,
          refreshToken: tokenResult.refreshToken,
        });
        // 驗證：tokenStorage 是否真的成功落盤（避免「看似成功、實際未存」）
        const storedAccessToken = await tokenStorage.getToken();
        console.log('[Apple Login] ✅ 存入後 accessToken 長度:', storedAccessToken?.length || 0);
        console.log('[Apple Login] ✅ 存入後 accessToken 是否等於後端回傳:', storedAccessToken === tokenResult.accessToken);
        if (storedAccessToken) {
          console.log('[Apple Login] ✅ 存入的 accessToken:', storedAccessToken);
        }
        handleLoginSuccess();
      } else {
        console.error('[Apple Login] ✅ 送往後端的 idToken:', appleAuthResult.idToken);
        console.error('[Apple Login] ✅ 送往後端的 authorizationCode:', appleAuthResult.authorizationCode);
        alert("token is empty, please try again");
      }
    } catch (e) {
      // 取消不提示；其他錯誤才提示
      if (isUserCancelError(e)) return;
      console.error('[Apple Login] ✅ Apple 已取得的憑證（若有）:', {
        hasIdToken: !!appleAuthResult?.idToken,
        idToken: appleAuthResult?.idToken,
        authorizationCode: appleAuthResult?.authorizationCode,
      });
      alert("Apple 登入錯誤: " + e.message);
    }
  };

  const handleWeChatLogin = async () => {
    let code = null;
    try {
      console.log('[WeChat Login] 開始登入流程，平台:', Platform.OS);
      
      // 添加詳細的錯誤診斷
      try {
        // 1. 從 WeChat SDK 獲取授權碼 code
        code = await wechatLogin();
        
        // 若使用者取消或未回傳 code，不提示，直接返回
        if (!code) {
          console.log('[WeChat Login] 返回 null（可能是使用者取消或失敗）');
          return;
        }

        console.log('[WeChat Login] 取得授權碼 code，長度:', code.length);
        console.log('[WeChat Login] 準備調用後端 API 換取 server token...');

        // 2. 調用後端 API 換取真正的 token
        console.log('[WeChat Login] 調用後端 API，code 長度:', code.length);
        const tokenResult = await wechatLoginWithXStory({ code });
        
        console.log('[WeChat Login] 後端 API 回應:', {
          hasTokenResult: !!tokenResult,
          hasAccessToken: !!tokenResult?.accessToken,
          accessTokenLength: tokenResult?.accessToken?.length || 0,
          hasRefreshToken: !!tokenResult?.refreshToken,
          refreshTokenLength: tokenResult?.refreshToken?.length || 0,
        });
        
        if (tokenResult?.accessToken) {
          console.log('[WeChat Login] 後端回傳 accessToken:', tokenResult.accessToken);
          console.log('[WeChat Login] ✅ 成功取得 server token');
          console.log('[WeChat Login]   accessToken 長度:', tokenResult.accessToken.length);
          console.log('[WeChat Login]   refreshToken 長度:', tokenResult.refreshToken?.length || 0);
          
          // 3. 保存真正的 token
          try {
            await tokenStorage.saveLoginData({
              accessToken: tokenResult.accessToken,
              refreshToken: tokenResult.refreshToken,
            });
            console.log('[WeChat Login] ✅ Token 已保存，登入成功');
            handleLoginSuccess();
          } catch (saveError) {
            console.error('[WeChat Login] ❌ Token 保存失敗:', saveError);
            console.error('[WeChat Login] ✅ 已取得的 code（用於換 token）:', code);
            console.error('[WeChat Login] ✅ 已取得的 accessToken（若有）:', tokenResult?.accessToken);
            Alert.alert(
              "微信登入錯誤",
              "Token 保存失敗，請重試。\n\n錯誤: " + (saveError?.message || String(saveError)),
              [{ text: "確定" }]
            );
          }
        } else {
          console.error('[WeChat Login] ❌ 後端 API 未返回有效的 token');
          console.error('[WeChat Login] tokenResult 內容:', JSON.stringify(tokenResult, null, 2));
          console.error('[WeChat Login] ✅ 送往後端的 code:', code);
          Alert.alert(
            "微信登入失敗",
            "無法從伺服器取得登入憑證，請稍後再試。\n\n如果問題持續，請聯繫客服。",
            [{ text: "確定" }]
          );
        }
      } catch (wechatError) {
        // 檢查是否為用戶取消
        if (isUserCancelError(wechatError)) {
          console.log('[WeChat Login] 使用者取消登入');
          return;
        }
        
        // 其他錯誤都顯示 Alert，這樣在 TestFlight 中也能看到
        const errorMessage = wechatError?.message || String(wechatError);
        console.error('[WeChat Login] 發生錯誤:', wechatError);
        console.error('[WeChat Login] 錯誤詳情:', {
          message: errorMessage,
          code: wechatError?.code,
          stack: wechatError?.stack,
        });
        console.error('[WeChat Login] ✅ 送往後端的 code（若有）:', code);
        
        // 在 TestFlight 中顯示詳細錯誤信息
        // 注意：這裡的 code 若未成功取得就可能是 null
        Alert.alert(
          "微信登入錯誤",
          errorMessage + "\n\n如果問題持續，請聯繫客服。",
          [{ text: "確定" }]
        );
        return;
      }
    } catch (e) {
      // 外層錯誤處理（不應該到達這裡，但以防萬一）
      if (isUserCancelError(e)) {
        console.log('[WeChat Login] 使用者取消登入');
        return;
      }
      console.error('[WeChat Login] 發生未預期的錯誤:', e);
      console.error('[WeChat Login] ✅ 送往後端的 code（若有）:', code);
      Alert.alert(
        "微信登入錯誤",
        "發生未預期的錯誤: " + (e?.message ?? String(e)),
        [{ text: "確定" }]
      );
    }
  };


  const handleRegister = async () => {
    setHistoryStack((prev) => [...prev, 'register']);
    setshowRegisterView(true);
  }

  const handleXStoryRegister = () => {
    setHistoryStack((prev) => [...prev, 'emailVerification']);
    setShowEmailVerification(true);
  };

  // 開啟服務條款（在 App 內瀏覽器）
  const handleOpenTOS = async () => {
    try {
      // TODO: 替換為實際的服務條款 URL
      const termsUrl = 'https://your-domain.com/terms-of-service';
      await WebBrowser.openBrowserAsync(termsUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        controlsColor: '#0abab5', // 使用品牌色作為控制項顏色
      });
    } catch (error) {
      console.error('開啟服務條款失敗:', error);
      // 可選：顯示錯誤提示
      // Alert.alert('錯誤', '無法開啟服務條款頁面，請稍後再試');
    }
  };

  // 開啟隱私政策（在 App 內瀏覽器）
  const handleOpenPP = async () => {
    try {
      // TODO: 替換為實際的隱私政策 URL
      const privacyUrl = 'https://your-domain.com/privacy-policy';
      await WebBrowser.openBrowserAsync(privacyUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        controlsColor: '#0abab5', // 使用品牌色作為控制項顏色
      });
    } catch (error) {
      console.error('開啟隱私政策失敗:', error);
      // 可選：顯示錯誤提示
      // Alert.alert('錯誤', '無法開啟隱私政策頁面，請稍後再試');
    }
  };

  useEffect(() => {
    const backAction = () => {
      console.log('Back button pressed');
      console.log('Current historyStack:', historyStack);

      if (historyStack.length > 0) {
        const lastAction = historyStack[historyStack.length - 1];
        console.log('Going back to:', lastAction);
        goBack();
        return true; // 阻止預設返回
      }

      console.log('No history, default back behavior');
      return false; // 沒有上一步，交給系統處理（例如退出APP）
    };

    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);

    return () => backHandler.remove();
  }, [historyStack]);

  const goBack = () => {
    setHistoryStack((prevStack) => {
      if (prevStack.length > 0) {
        const newStack = [...prevStack];
        newStack.pop();

        // 根據 newStack 的最後一個元素決定顯示畫面
        const lastView = newStack[newStack.length - 1];
        console.log('Switching to last view:', lastView);

        switch (lastView) {
          case 'register':
            setshowRegisterView(true);
            setShowEmailLogin(false);
            setShowEmailVerification(false);
            break;
          case 'emailLogin':
            setShowEmailLogin(true);
            setshowRegisterView(false);
            setShowEmailVerification(false);
            break;
          case 'emailVerification':
            setShowEmailVerification(true);
            setshowRegisterView(false);
            setShowEmailLogin(false);
            break;
          default:
            // 預設回到登入畫面
            setshowRegisterView(false);
            setShowEmailLogin(false);
            setShowEmailVerification(false);
        }

        return newStack;
      }

      return prevStack;
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={{ flex: 1 }}>
          {showEmailVerification ? (
            <RegisterXStoryScreen
              onCancel={handleEmailVerificationCancel}
              onSuccess={() => {
                setShowEmailVerification(false);
                Alert.alert(
                  translate("registerEmailSentTitle"),
                  translate("registerEmailSentMessage"),
                  [{ text: translate("ok") }]
                );
              }}
            />
          ) : showEmailLogin ? (
            <XStoryLogin
              onLoginSuccess={(token) => { handleXStoryLoginSuccess(token) }}
              onCancel={handleXStoryLoginCancel}
              onShowEmailVerification={() => { }}
            />
          ) : showRegisterView ? (
            <RegisterScreen
              onRegisterSuccess={() => { }}
              onXStoryRegister={handleXStoryRegister}
              onFacebookRegister={handleFacebookLogin}
              onAppleRegister={handleAppleLogin}
              onGoogleRegister={handleGoogleLogin}
              onWeChatRegister={handleWeChatLogin}
              onRegister={handleRegister}
              onCancel={() => setshowRegisterView(false)}
              onOpenTOS={handleOpenTOS}
              onOpenPP={handleOpenPP}
            />
          ) : (
            <LoginScreen
              onLoginSuccess={handleLoginSuccess}
              onXStoryLogin={handleXStoryLogin}
              onFacebookLogin={handleFacebookLogin}
              onAppleLogin={handleAppleLogin}
              onGoogleLogin={handleGoogleLogin}
              onWeChatLogin={handleWeChatLogin}
              onRegister={handleRegister}
            />
          )}
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
