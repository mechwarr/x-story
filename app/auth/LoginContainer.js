import React, { useEffect, useState } from "react";
import { appleLogin } from "../../components/utils/appleAuth";
import { facebookLogin, facebookLimitedLoginIOS } from "../../components/utils/facebookAuth";
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
  appleLoginWithXStory
} from '../config/authApiClient';

export default function LoginContainer({ onLoginSuccess }) {
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

  const handleXStoryLoginSuccess = async (token) => {
    console.log('handleXStoryLoginSuccess token: ' + token);
    await tokenStorage.setStoreToken(token);
    if (token) {
      onLoginSuccess();
    }
  };

  const handleEmailVerificationCancel = () => {
    setShowEmailVerification(false);
  };

  const handleFacebookLogin = async () => {
    try {
      console.log('[Facebook Login] 開始登入流程，平台:', Platform.OS);
      let body = null;

      if (Platform.OS === "ios") {
        // 走 Limited Login（id_token）
        console.log('[Facebook Login] iOS 使用 Limited Login');
        const r = await facebookLimitedLoginIOS();
        // 若使用者取消，SDK 通常會回傳 undefined/null；此時不提示，直接結束
        if (!r) {
          console.log('[Facebook Login] iOS Limited Login 返回 null（可能是使用者取消）');
          return;
        }

        console.log('[Facebook Login] iOS Limited Login 結果:', {
          hasIdToken: !!r?.idToken,
          idTokenLength: r?.idToken?.length || 0,
          hasRawNonce: !!r?.rawNonce,
        });

        if (r?.idToken) {
          body = {
            token: r.idToken,      // id_token (JWT)
            rawNonce: r.rawNonce   // 強烈建議一併傳給後端做 nonce 驗證
          };
        } else {
          console.error('[Facebook Login] iOS Limited Login 未取得 idToken');
        }
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
        hasRawNonce: !!body.rawNonce,
      });

      const serverToken = await facebookLoginWithXStory(body); // 你的 API 呼叫
      if (serverToken && serverToken.length > 0) {
        console.log('[Facebook Login] 後端登入成功，token 長度:', serverToken.length);
        await tokenStorage.setStoreToken(serverToken);
        onLoginSuccess();
      } else {
        console.error('[Facebook Login] 後端返回的 accessToken 為空');
        alert("serverToken is empty, please try again");
      }
    } catch (e) {
      // 取消不提示；其他錯誤才提示
      if (isUserCancelError(e)) {
        console.log('[Facebook Login] 使用者取消登入');
        return;
      }
      console.error('[Facebook Login] 發生錯誤:', e);
      alert("Facebook 登入錯誤: " + (e?.message ?? String(e)));
    }
  };

  const handleGoogleLogin = async () => {
    try {
      // 1) 先試靜默登入，有紀錄就不跳 UI；沒有再互動式登入
      let res = await googleSignInSilently();
      if (!res.ok) {
        res = await googleSignInInteractive();
      }

      // 2) 取消或錯誤
      if (!res.ok) {
        // 若是使用者取消，不要 alert
        if (res.reason === 'cancelled' || res.code === 'canceled' || res.code === 'cancelled') {
          return;
        }
        const msg =
          res.reason === 'cancelled'
            ? '' // 已在上面 return，不會進到這裡
            : `Google 登入錯誤：${res.code ?? ''} ${res.message ?? ''}`;
        const trimmed = msg.trim();
        if (trimmed.length > 0) alert(trimmed);
        return;
      }

      // 3) 成功：拿到使用者與 token
      console.log('[Google Login] 登入成功，使用者資訊:', {
        email: res.user?.email,
        id: res.user?.id,
        hasIdToken: !!res.idToken,
        idTokenLength: res.idToken?.length || 0,
        platform: Platform.OS,
      });

      // 優先用 wrapper 已帶回的 idToken；若沒有，再補拿一次（iOS 上可能需要重試）
      let idToken = res.idToken ?? null;
      if (!idToken) {
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
        }
      }

      if (!idToken || idToken.length === 0) {
        console.error('[Google Login] 最終 idToken 為空，無法繼續');
        alert('未取得 Google idToken，請重試');
        return;
      }

      console.log('[Google Login] 準備呼叫後端 API，idToken 長度:', idToken.length);
      console.log('[Google Login] idToken 前 100 字元:', idToken.substring(0, 100));

      // 4) 呼叫你原本的後端 API 換取 server access token
      const serverGoogleLoginAccessToken = await googleLoginWithXStory({ idToken });

      console.log('[Google Login] 後端 API 回應結果:', {
        hasToken: !!serverGoogleLoginAccessToken,
        tokenLength: serverGoogleLoginAccessToken?.length || 0,
        tokenPreview: serverGoogleLoginAccessToken ? serverGoogleLoginAccessToken.substring(0, 50) + '...' : null,
      });

      if (serverGoogleLoginAccessToken && serverGoogleLoginAccessToken.length > 0) {
        console.log('[Google Login] 後端登入成功，token 長度:', serverGoogleLoginAccessToken.length);
        await tokenStorage.setStoreToken(serverGoogleLoginAccessToken);
        onLoginSuccess();
      } else {
        console.error('[Google Login] 後端返回的 accessToken 為空');
        console.error('[Google Login] 請檢查 console 中的 [Google Login API] 後端回應 日誌，查看具體錯誤訊息');
        alert('serverGoogleLoginAccessToken is empty, please try again');
      }
    } catch (e) {
      // 取消不提示；其他錯誤才提示
      if (isUserCancelError(e)) return;
      alert('Google 登入錯誤: ' + (e?.message ?? String(e)));
    }
  };

  const handleAppleLogin = async () => {
    try {
      const appletoken = await appleLogin();
      // 若使用者取消或未回傳 token，不提示，直接返回
      if (!appletoken) return;

      console.log('apple appletoken: ' + appletoken);

      const token = await appleLoginWithXStory({ idToken: appletoken });
      if (token && token.length > 0) {
        await tokenStorage.setStoreToken(token);
        console.log('apple login: ' + token);
        onLoginSuccess();
      } else {
        alert("token is empty, please try again");
      }
    } catch (e) {
      // 取消不提示；其他錯誤才提示
      if (isUserCancelError(e)) return;
      alert("Apple 登入錯誤: " + e.message);
    }
  };

  const handleWeChatLogin = async () => {
    try {
      console.log('[WeChat Login] 開始登入流程，平台:', Platform.OS);
      
      // 添加詳細的錯誤診斷
      try {
        const code = await wechatLogin();
        
        // 若使用者取消或未回傳 code，不提示，直接返回
        if (!code) {
          console.log('[WeChat Login] 返回 null（可能是使用者取消或失敗）');
          return;
        }

        console.log('[WeChat Login] 取得授權碼 code，長度:', code.length);
        console.log('[WeChat Login] ⚠️ 注意：WeChat 登入目前直接使用 code 作為 token，建議改為調用後端 API 換取 server token');

        // TODO: 應該要像 Google/Facebook 一樣，調用後端 API 換取 server token
        // 目前暫時直接使用 code，但這不是最佳實踐
        // const serverToken = await wechatLoginWithXStory({ code });
        // if (serverToken && serverToken.length > 0) {
        //   await tokenStorage.setStoreToken(serverToken);
        //   onLoginSuccess();
        // } else {
        //   alert("WeChat 登入失敗，請稍後再試");
        // }

        await tokenStorage.setStoreToken(code);
        console.log('[WeChat Login] 直接使用 code 作為 token（臨時方案）');
        onLoginSuccess();
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
        
        // 在 TestFlight 中顯示詳細錯誤信息
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
              onLoginSuccess={onLoginSuccess}
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
