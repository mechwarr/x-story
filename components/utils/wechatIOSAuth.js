// 微信登入模組 - iOS 專用實現
import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

/**
 * 動態獲取微信原生模組（僅 iOS）
 * 使用函數而不是靜態變量，確保在模組註冊後才獲取
 * 支持延遲重試，因為模組可能在應用啟動後才完全註冊
 */
function getWeChatModule() {
  // 確保只在 iOS 平台執行
  if (Platform.OS !== 'ios') {
    console.warn('⚠️ [wechatIOSAuth] 此模組僅支持 iOS 平台');
    return null;
  }

  try {
    const { WeChat } = NativeModules;
    
    // 調試信息：檢查模組是否可用
    if (__DEV__) {
      console.log('🔍 [wechatIOSAuth] 檢查微信原生模組 (iOS)...');
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
          console.warn('   1. iOS 原生模組尚未實現（WeChatModule.swift 不存在）');
          console.warn('   2. 模組未註冊到 React Native Bridge');
          console.warn('   3. 需要安裝 WeChat SDK 並配置 Podfile');
          console.warn('   4. 請參考 ios/WECHAT_IOS_SETUP.md 進行配置');
        }
      }
    }
    
    return WeChat;
  } catch (error) {
    console.error('❌ [wechatIOSAuth] 獲取微信模組時發生錯誤:', error);
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
 * 初始化微信 SDK（支持延遲重試）- iOS 專用
 * 在應用啟動時調用，確保微信功能可用
 * 如果初始化失敗，不會拋出錯誤，避免應用崩潰
 */
export function initWeChatSDK(retryCount = 0, maxRetries = 3) {
  if (Platform.OS !== 'ios') {
    console.warn('⚠️ [wechatIOSAuth] initWeChatSDK 僅支持 iOS 平台');
    return Promise.resolve(false);
  }

  const WeChat = getWeChatModule();
  
  if (!WeChat) {
    // 如果模組未找到且還有重試次數，延遲重試
    if (retryCount < maxRetries) {
      console.log(`⏳ [iOS] WeChat 模組未找到，${1000 * (retryCount + 1)}ms 後重試 (${retryCount + 1}/${maxRetries})...`);
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(initWeChatSDK(retryCount + 1, maxRetries));
        }, 1000 * (retryCount + 1)); // 遞增延遲：1s, 2s, 3s
      });
    }
    
    console.warn('⚠️ [iOS] WeChat 原生模組未找到，請檢查：');
    console.warn('   1. iOS 原生模組尚未實現（WeChatModule.swift 不存在）');
    console.warn('   2. 模組未註冊到 React Native Bridge');
    console.warn('   3. 需要安裝 WeChat SDK 並配置 Podfile');
    console.warn('   4. 請參考 ios/WECHAT_IOS_SETUP.md 進行配置');
    console.warn('   5. 或使用現成的 npm 套件：npm install react-native-wechat-lib');
    return Promise.resolve(false);
  }

  if (!WX_APP_ID || WX_APP_ID === '') {
    console.warn('⚠️ 微信AppId 尚未設定');
    return Promise.resolve(false);
  }

  // 檢查 registerApp 方法是否存在
  if (typeof WeChat.registerApp !== 'function') {
    console.error('❌ [iOS] WeChat.registerApp 方法不存在');
    const availableMethods = Object.keys(WeChat).filter(key => typeof WeChat[key] === 'function');
    console.error('   可用的方法:', availableMethods);
    console.error('   所有屬性:', Object.keys(WeChat));
    return Promise.resolve(false);
  }

  console.log(`🔧 [iOS] 正在初始化微信 SDK (AppID: ${WX_APP_ID})...`);
  
  return WeChat.registerApp(WX_APP_ID)
    .then((result) => {
      if (result) {
        console.log('✅ [iOS] 微信 SDK 初始化成功');
      } else {
        console.warn('⚠️ [iOS] 微信 SDK 初始化失敗（registerApp 返回 false）');
        console.warn('   可能的原因：');
        console.warn('   1. AppID 配置錯誤');
        console.warn('   2. 微信開放平台配置不正確（Bundle ID）');
        console.warn('   3. 應用未通過微信審核（測試環境可能需要配置）');
        console.warn('   4. Info.plist 中缺少 URL Scheme 配置');
      }
      return result;
    })
    .catch((error) => {
      console.warn('⚠️ [iOS] 微信 SDK 初始化失敗:', error.message);
      console.error('初始化錯誤詳情:', error);
      if (error.code) {
        console.error('   錯誤代碼:', error.code);
      }
      return false;
    });
}

/**
 * 檢查微信是否已安裝 - iOS 專用
 */
export async function isWXAppInstalled() {
  if (Platform.OS !== 'ios') {
    console.warn('⚠️ [wechatIOSAuth] isWXAppInstalled 僅支持 iOS 平台');
    return false;
  }

  const WeChat = getWeChatModule();
  
  if (!WeChat) {
    console.warn('⚠️ [iOS] WeChat 原生模組未找到');
    return false;
  }

  if (typeof WeChat.isWXAppInstalled !== 'function') {
    console.error('❌ [iOS] WeChat.isWXAppInstalled 方法不存在');
    return false;
  }

  try {
    const installed = await WeChat.isWXAppInstalled();
    return installed;
  } catch (error) {
    console.error('❌ [iOS] 檢查微信安裝狀態失敗:', error);
    return false;
  }
}

/**
 * 微信登入 - iOS 專用
 * @returns {Promise<string|null>} 返回授權碼 code，失敗或取消返回 null
 */
export async function wechatLogin() {
  if (Platform.OS !== 'ios') {
    console.warn('⚠️ [wechatIOSAuth] wechatLogin 僅支持 iOS 平台');
    throw new Error('微信登入僅支持 iOS 平台');
  }

  try {
    // 動態獲取模組
    const WeChat = getWeChatModule();
    
    // 檢查模組是否可用
    if (!WeChat) {
      const { NativeModules } = require('react-native');
      const allModules = Object.keys(NativeModules);
      const wechatRelated = allModules.filter(key => 
        key.toLowerCase().includes('wechat') || 
        key.toLowerCase().includes('weixin') ||
        key.toLowerCase().includes('wx')
      );
      
      const errorMsg = `微信 SDK 模組未找到。\n已註冊的模組數量: ${allModules.length}\n微信相關模組: ${wechatRelated.length > 0 ? wechatRelated.join(', ') : '無'}\n\n請確認：\n1) WeChatModule.swift 已添加到 Xcode 項目\n2) 模組已正確編譯\n3) 文件包含在 storyappv2 target 中`;
      console.error('❌ [iOS]', errorMsg);
      console.error('   所有 NativeModules keys (前30個):', allModules.slice(0, 30));
      throw new Error(errorMsg);
    }
    
    // 檢查必要的方法是否存在
    if (typeof WeChat.sendAuthRequest !== 'function') {
      const availableMethods = Object.keys(WeChat).filter(key => typeof WeChat[key] === 'function');
      const errorMsg = `WeChat 模組方法不完整。缺少 sendAuthRequest。可用方法: ${availableMethods.join(', ')}`;
      console.error('❌ [iOS]', errorMsg);
      throw new Error(errorMsg);
    }

    // 如果沒 AppId，直接返回 null
    if (!WX_APP_ID || WX_APP_ID === '') {
      const errorMsg = '微信 AppID 尚未設定';
      console.warn('⚠️', errorMsg);
      throw new Error(errorMsg);
    }

    // 確保 SDK 已初始化
    const registered = await initWeChatSDK();
    if (!registered) {
      const errorMsg = '微信 SDK 初始化失敗。請檢查 AppID 和 Bundle ID 配置';
      console.warn('⚠️ [iOS]', errorMsg);
      throw new Error(errorMsg);
    }

    // 檢查微信是否已安裝
    const isInstalled = await isWXAppInstalled();
    if (!isInstalled) {
      const errorMsg = '未檢測到微信應用，請先安裝微信';
      console.warn('⚠️ [iOS]', errorMsg);
      throw new Error(errorMsg);
    }

    // 發送授權請求
    // sendAuthRequest 接受 scope (字符串) 和可選的 state
    try {
      const response = await WeChat.sendAuthRequest("snsapi_userinfo", "");
      
      // 如果成功，response 應該包含 code
      if (response && response.code) {
        console.log('✅ [iOS] 微信授權成功，code:', response.code);
        return response.code;
      } else {
        console.warn('⚠️ [iOS] 微信授權響應異常:', response);
        return null;
      }
    } catch (authError) {
      // sendAuthRequest 在失敗時會 reject
      if (authError.code === -2 || authError.message?.includes('USER_CANCEL')) {
        // -2 或用戶取消
        console.log('ℹ️ [iOS] 用戶取消微信登入');
        return null;
      } else {
        console.warn('⚠️ [iOS] 微信授權失敗:', authError.message || authError);
        return null;
      }
    }
  } catch (error) {
    console.error("❌ [iOS] WeChat login error:", error);
    // 不拋出錯誤，返回 null 讓調用端處理
    return null;
  }
}

/**
 * 監聽微信響應事件（可選，用於處理其他類型的響應）- iOS 專用
 */
export function addWeChatResponseListener(callback) {
  if (Platform.OS !== 'ios') {
    console.warn('⚠️ [wechatIOSAuth] addWeChatResponseListener 僅支持 iOS 平台');
    return null;
  }

  const emitter = getWeChatEmitter();
  
  if (!emitter) {
    console.warn('⚠️ [iOS] WeChat 事件監聽器未初始化');
    return null;
  }

  return emitter.addListener('WeChat_Resp', (response) => {
    console.log('📱 [iOS] 收到微信響應:', response);
    if (callback) {
      callback(response);
    }
  });
}

