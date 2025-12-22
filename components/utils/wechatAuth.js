// 微信登入模組 - 使用 react-native-wechat-android 原生實現
import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

/**
 * 動態獲取微信原生模組
 * 使用函數而不是靜態變量，確保在模組註冊後才獲取
 * 支持延遲重試，因為模組可能在應用啟動後才完全註冊
 */
function getWeChatModule() {
  try {
    const { WeChat } = NativeModules;
    
    // 調試信息：檢查模組是否可用
    if (__DEV__) {
      console.log('🔍 [wechatAuth] 檢查微信原生模組...');
      console.log('   Platform:', Platform.OS);
      console.log('   NativeModules.WeChat:', !!WeChat);
      console.log('   NativeModules keys 總數:', Object.keys(NativeModules).length);
      
      if (WeChat) {
        console.log('   ✅ WeChat 模組已找到');
        const methods = Object.keys(WeChat).filter(key => typeof WeChat[key] === 'function');
        console.log('   模組方法:', methods);
        console.log('   所有屬性:', Object.keys(WeChat));
      } else {
        console.warn('   ⚠️ WeChat 模組未找到');
        console.warn('   所有 NativeModules keys (前30個):', Object.keys(NativeModules).slice(0, 30));
        
        // 檢查是否有其他可能的微信模組名稱
        const wechatKeys = Object.keys(NativeModules).filter(key => 
          key.toLowerCase().includes('wechat') || 
          key.toLowerCase().includes('weixin')
        );
        if (wechatKeys.length > 0) {
          console.warn('   找到可能的微信相關模組:', wechatKeys);
        } else {
          console.warn('   ⚠️ 未找到任何微信相關模組');
          console.warn('   可能的原因：');
          console.warn('   1. WeChatPackage 未正確添加到 MainApplication');
          console.warn('   2. 未重新構建應用（需要 ./gradlew clean && ./gradlew assembleDebug）');
          console.warn('   3. 模組註冊時機問題，嘗試延遲初始化');
        }
      }
    }
    
    return WeChat;
  } catch (error) {
    console.error('❌ [wechatAuth] 獲取微信模組時發生錯誤:', error);
    return null;
  }
}

// 創建事件監聽器（延遲初始化）
let weChatEmitter = null;
function getWeChatEmitter() {
  if (!weChatEmitter) {
    const WeChat = getWeChatModule();
    if (WeChat) {
      weChatEmitter = new NativeEventEmitter(WeChat);
    }
  }
  return weChatEmitter;
}

const WX_APP_ID = 'wx277826ce3d9510c6';

/**
 * 初始化微信 SDK（支持延遲重試）
 * 在應用啟動時調用，確保微信功能可用
 * 如果初始化失敗，不會拋出錯誤，避免應用崩潰
 */
export function initWeChatSDK(retryCount = 0, maxRetries = 3) {
  const WeChat = getWeChatModule();
  
  if (!WeChat) {
    // 如果模組未找到且還有重試次數，延遲重試
    if (retryCount < maxRetries) {
      console.log(`⏳ WeChat 模組未找到，${1000 * (retryCount + 1)}ms 後重試 (${retryCount + 1}/${maxRetries})...`);
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(initWeChatSDK(retryCount + 1, maxRetries));
        }, 1000 * (retryCount + 1)); // 遞增延遲：1s, 2s, 3s
      });
    }
    
    console.warn('⚠️ WeChat 原生模組未找到，請檢查：');
    console.warn('   1. MainApplication.kt 中是否添加了 WeChatPackage');
    console.warn('   2. 是否重新構建了應用（不只是重啟 Metro）');
    console.warn('   3. 運行: cd android && ./gradlew clean && ./gradlew assembleDebug');
    console.warn('   4. 檢查 logcat 中是否有 "WeChatPackage 已成功添加" 和 "WeChatModule 已創建" 的日誌');
    console.warn('   5. 確認 AAR 文件已正確放置在 android/app/libs/ 目錄');
    return Promise.resolve(false);
  }

  if (!WX_APP_ID || WX_APP_ID === '') {
    console.warn('⚠️ 微信AppId 尚未設定');
    return Promise.resolve(false);
  }

  // 檢查 registerApp 方法是否存在
  if (typeof WeChat.registerApp !== 'function') {
    console.error('❌ WeChat.registerApp 方法不存在');
    const availableMethods = Object.keys(WeChat).filter(key => typeof WeChat[key] === 'function');
    console.error('   可用的方法:', availableMethods);
    console.error('   所有屬性:', Object.keys(WeChat));
    return Promise.resolve(false);
  }

  console.log(`🔧 正在初始化微信 SDK (AppID: ${WX_APP_ID})...`);
  
  return WeChat.registerApp(WX_APP_ID)
    .then((result) => {
      if (result) {
        console.log('✅ 微信 SDK 初始化成功');
      } else {
        console.warn('⚠️ 微信 SDK 初始化失敗（registerApp 返回 false）');
        console.warn('   可能的原因：');
        console.warn('   1. AppID 配置錯誤');
        console.warn('   2. 微信開放平台配置不正確（包名、簽名）');
        console.warn('   3. 應用未通過微信審核（測試環境可能需要配置簽名）');
      }
      return result;
    })
    .catch((error) => {
      console.warn('⚠️ 微信 SDK 初始化失敗:', error.message);
      console.error('初始化錯誤詳情:', error);
      if (error.code) {
        console.error('   錯誤代碼:', error.code);
      }
      return false;
    });
}

/**
 * 檢查微信是否已安裝
 */
export async function isWXAppInstalled() {
  const WeChat = getWeChatModule();
  
  if (!WeChat) {
    console.warn('⚠️ WeChat 原生模組未找到');
    return false;
  }

  if (typeof WeChat.isWXAppInstalled !== 'function') {
    console.error('❌ WeChat.isWXAppInstalled 方法不存在');
    return false;
  }

  try {
    const installed = await WeChat.isWXAppInstalled();
    return installed;
  } catch (error) {
    console.error('❌ 檢查微信安裝狀態失敗:', error);
    return false;
  }
}

/**
 * 微信登入
 * @returns {Promise<string|null>} 返回授權碼 code，失敗或取消返回 null
 */
export async function wechatLogin() {
  try {
    // 動態獲取模組
    const WeChat = getWeChatModule();
    
    // 檢查模組是否可用
    if (!WeChat) {
      console.error('❌ [wechatLogin] 微信 SDK 模組未正確初始化，無法使用微信登入');
      console.error('   請檢查：');
      console.error('   1. MainApplication.kt 中是否添加了 WeChatPackage');
      console.error('   2. 是否重新構建了應用（不只是重啟 Metro）');
      console.error('   3. 運行: cd android && ./gradlew clean && ./gradlew assembleDebug');
      console.error('   4. 檢查 logcat 中是否有 "WeChatPackage 已成功添加" 的日誌');
      console.error('   5. 檢查 logcat 中是否有 "WeChatModule 已創建" 的日誌');
      return null;
    }
    
    // 檢查必要的方法是否存在
    if (typeof WeChat.sendAuthRequest !== 'function') {
      console.error('❌ [wechatLogin] WeChat.sendAuthRequest 方法不存在');
      console.error('   可用的方法:', Object.keys(WeChat).filter(key => typeof WeChat[key] === 'function'));
      return null;
    }

    // 如果沒 AppId，直接返回 null
    if (!WX_APP_ID || WX_APP_ID === '') {
      console.warn('⚠️ 微信AppId 尚未設定，無法使用微信登入');
      return null;
    }

    // 確保 SDK 已初始化
    const registered = await initWeChatSDK();
    if (!registered) {
      console.warn('⚠️ 微信 SDK 初始化失敗，無法使用微信登入');
      return null;
    }

    // 檢查微信是否已安裝
    const isInstalled = await isWXAppInstalled();
    if (!isInstalled) {
      console.warn('⚠️ 微信應用未安裝');
      throw new Error("WeChat app not installed");
    }

    // 發送授權請求
    // sendAuthRequest 接受 scope (字符串) 和可選的 state
    try {
      const response = await WeChat.sendAuthRequest("snsapi_userinfo", "");
      
      // 如果成功，response 應該包含 code
      if (response && response.code) {
        console.log('✅ 微信授權成功，code:', response.code);
        return response.code;
      } else {
        console.warn('⚠️ 微信授權響應異常:', response);
        return null;
      }
    } catch (authError) {
      // sendAuthRequest 在失敗時會 reject
      if (authError.code === -2 || authError.message?.includes('USER_CANCEL')) {
        // -2 或用戶取消
        console.log('ℹ️ 用戶取消微信登入');
        return null;
      } else {
        console.warn('⚠️ 微信授權失敗:', authError.message || authError);
        return null;
      }
    }
  } catch (error) {
    console.error("❌ WeChat login error:", error);
    // 不拋出錯誤，返回 null 讓調用端處理
    return null;
  }
}

/**
 * 監聽微信響應事件（可選，用於處理其他類型的響應）
 */
export function addWeChatResponseListener(callback) {
  const emitter = getWeChatEmitter();
  
  if (!emitter) {
    console.warn('⚠️ WeChat 事件監聽器未初始化');
    return null;
  }

  return emitter.addListener('WeChat_Resp', (response) => {
    console.log('📱 收到微信響應:', response);
    if (callback) {
      callback(response);
    }
  });
}
