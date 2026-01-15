// 微信登入模組 - iOS 專用實現
import { NativeModules, NativeEventEmitter, Platform, DeviceEventEmitter } from 'react-native';

/**
 * 檢查 React Native Bridge 是否已就緒
 * 通過檢查是否有任何原生模組來判斷
 * 在 TestFlight 中，Bridge 初始化可能更慢
 */
function isBridgeReady() {
  try {
    const allModules = Object.keys(NativeModules);
    // 如果有任何模組（包括 Expo 模組），說明 Bridge 已初始化
    // 在 TestFlight 中，可能需要更長時間
    return allModules.length > 0;
  } catch (e) {
    return false;
  }
}

/**
 * 等待 React Native Bridge 本身初始化（不依賴特定模組）
 * 這是第一階段：等待 Bridge 就緒
 * @param {number} timeout - 超時時間（毫秒），默認 30 秒（TestFlight 需要更長時間）
 * @returns {Promise<boolean>} Bridge 是否就緒
 */
function waitForBridgeInitialization(timeout = 30000) {
  return new Promise((resolve, reject) => {
    // 先檢查是否已經就緒
    if (isBridgeReady()) {
      const allModules = Object.keys(NativeModules);
      console.log(`✅ [wechatIOSAuth] Bridge 已初始化，找到 ${allModules.length} 個模組`);
      resolve(true);
      return;
    }
    
    // 診斷：檢查 NativeModules 對象本身是否存在
    try {
      const modulesKeys = Object.keys(NativeModules);
      console.log(`🔍 [wechatIOSAuth] 診斷：NativeModules 對象存在，當前模組數量: ${modulesKeys.length}`);
      if (modulesKeys.length === 0) {
        console.log('   ⚠️ NativeModules 為空，Bridge 可能尚未初始化');
      }
    } catch (e) {
      console.error('   ❌ 無法訪問 NativeModules:', e);
    }
    
    console.log(`⏳ [wechatIOSAuth] 等待 React Native Bridge 初始化（最多 ${timeout}ms）...`);
    console.log('   📝 提示：在 TestFlight 中，Bridge 初始化可能需要更長時間');
    
    let checkCount = 0;
    const checkInterval = 200; // 每 200ms 檢查一次
    const maxChecks = Math.floor(timeout / checkInterval);
    let lastModuleCount = 0;
    
    const checkId = setInterval(() => {
      checkCount++;
      
      // 診斷：檢查模組數量變化
      try {
        const currentModules = Object.keys(NativeModules);
        const currentCount = currentModules.length;
        
        // 如果模組數量增加，說明 Bridge 正在初始化
        if (currentCount > lastModuleCount) {
          console.log(`📈 [wechatIOSAuth] Bridge 初始化進度：模組數量從 ${lastModuleCount} 增加到 ${currentCount}`);
          lastModuleCount = currentCount;
        }
      } catch (e) {
        // 忽略診斷錯誤
      }
      
      if (isBridgeReady()) {
        const allModules = Object.keys(NativeModules);
        console.log(`✅ [wechatIOSAuth] Bridge 已初始化（檢查 ${checkCount}/${maxChecks} 次）`);
        console.log(`   已註冊模組數量: ${allModules.length}`);
        if (allModules.length > 0) {
          console.log(`   前 10 個模組: ${allModules.slice(0, 10).join(', ')}`);
        }
        clearInterval(checkId);
        resolve(true);
        return;
      }
      
      // 每 2 秒輸出一次進度
      if (checkCount % 10 === 0) {
        const currentModules = Object.keys(NativeModules);
        console.log(`⏳ [wechatIOSAuth] Bridge 初始化中... (${checkCount}/${maxChecks})`);
        console.log(`   當前模組數量: ${currentModules.length}`);
        if (currentModules.length > 0) {
          console.log(`   前 5 個模組: ${currentModules.slice(0, 5).join(', ')}`);
        }
      }
    }, checkInterval);
    
    // 超時處理
    setTimeout(() => {
      clearInterval(checkId);
      const allModules = Object.keys(NativeModules);
      
      // 詳細診斷信息
      console.error(`❌ [wechatIOSAuth] Bridge 初始化超時（${timeout}ms）`);
      console.error('   ========== 詳細診斷信息 ==========');
      console.error(`   - NativeModules 對象存在: ${typeof NativeModules !== 'undefined'}`);
      console.error(`   - 模組數量: ${allModules.length}`);
      console.error(`   - 檢查次數: ${checkCount}/${maxChecks}`);
      
      if (allModules.length > 0) {
        console.warn(`⚠️ [wechatIOSAuth] 超時但找到 ${allModules.length} 個模組，視為成功`);
        console.warn(`   前 10 個模組: ${allModules.slice(0, 10).join(', ')}`);
        resolve(true);
      } else {
        console.error('   ========== 可能的原因 ==========');
        console.error('   1. JS Bundle 未正確加載');
        console.error('      → 檢查 Xcode 控制台是否有 JS Bundle 加載錯誤');
        console.error('   2. Bridge 初始化失敗');
        console.error('      → 檢查 AppDelegate.swift 中的 startReactNative 是否被調用');
        console.error('   3. 應用啟動時機問題');
        console.error('      → useInitApp 可能在 Bridge 初始化之前執行');
        console.error('   4. TestFlight 構建配置問題');
        console.error('      → 檢查 Archive 配置和 JS Bundle 路徑');
        console.error('   5. Expo 配置問題');
        console.error('      → 檢查 bundleURL() 是否返回正確的路徑');
        console.error('   =================================');
        
        // 檢查是否可以訪問其他 React Native API
        try {
          const { AppState } = require('react-native');
          console.error(`   - AppState 可用: ${!!AppState}`);
        } catch (e) {
          console.error(`   - AppState 不可用: ${e.message}`);
        }
        
        reject(new Error(`Bridge 初始化超時（${timeout}ms）。NativeModules 為空，表示整個 React Native Bridge 未初始化。請檢查 JS Bundle 是否正確加載。`));
      }
    }, timeout);
  });
}

// 全局狀態：Bridge 就緒 Promise 緩存
let bridgeReadyPromise = null;
let bridgeReady = false;

/**
 * 重置 Bridge 就緒狀態（用於調試或重新初始化）
 */
function resetBridgeReadyState() {
  bridgeReady = false;
  bridgeReadyPromise = null;
  console.log('🔄 [wechatIOSAuth] Bridge 就緒狀態已重置');
}

/**
 * 等待 React Native Bridge 就緒（簡化版：只等待 Bridge 初始化）
 * 不再等待 WeChatModuleReady 事件，因為改為手動初始化
 * @param {number} timeout - 超時時間（毫秒），默認 15 秒
 * @returns {Promise<boolean>} Bridge 是否就緒
 */
function waitForBridgeReady(timeout = 15000) {
  // 如果已經就緒，立即返回
  if (bridgeReady) {
    return Promise.resolve(true);
  }
  
  // 如果已經有 Promise，返回同一個（避免重複等待）
  if (bridgeReadyPromise) {
    return bridgeReadyPromise;
  }
  
  // 先快速檢查是否已經就緒
  if (isBridgeReady()) {
    const allModules = Object.keys(NativeModules);
    bridgeReady = true;
    console.log(`✅ [wechatIOSAuth] Bridge 已就緒，找到 ${allModules.length} 個模組`);
    return Promise.resolve(true);
  }
  
  // 創建新的 Promise（只等待 Bridge 初始化）
  console.log('🔧 [wechatIOSAuth] 創建新的 Bridge 就緒 Promise...');
  bridgeReadyPromise = waitForBridgeInitialization(timeout);
  
  bridgeReadyPromise.then(() => {
    bridgeReady = true;
  }).catch(() => {
    // 失敗時不設置 bridgeReady，允許重試
  });
  
  return bridgeReadyPromise;
}

/**
 * 動態獲取微信原生模組（僅 iOS）
 * 使用函數而不是靜態變量，確保在模組註冊後才獲取
 * 注意：此函數是同步的，不會等待 Bridge 就緒
 * 如果需要等待 Bridge，請使用 getWeChatModuleAsync()
 */
function getWeChatModule() {
  // 確保只在 iOS 平台執行
  if (Platform.OS !== 'ios') {
    console.warn('⚠️ [wechatIOSAuth] 此模組僅支持 iOS 平台');
    return null;
  }

  try {
    const allModules = Object.keys(NativeModules);
    
    // 關鍵診斷：如果所有模組都是空的，說明 Bridge 還沒初始化
    if (allModules.length === 0) {
      // 不輸出錯誤，因為這可能是正常的（Bridge 尚未初始化）
      // 調用者應該使用 getWeChatModuleAsync() 來等待
      return null;
    }
    
    const { WeChat } = NativeModules;
    
    // 調試信息：檢查模組是否可用
      console.log('🔍 [wechatIOSAuth] 檢查微信原生模組 (iOS)...');
      console.log('   Platform:', Platform.OS);
      console.log('   NativeModules.WeChat:', !!WeChat);
    console.log('   NativeModules keys 總數:', allModules.length);
    console.log('   前10個模組:', allModules.slice(0, 10));
      
      if (WeChat) {
        console.log('   ✅ WeChat 模組已找到');
        const methods = Object.keys(WeChat).filter(key => typeof WeChat[key] === 'function');
        console.log('   模組方法:', methods);
        console.log('   所有屬性:', Object.keys(WeChat));
      } else {
        console.warn('   ⚠️ WeChat 模組未找到');
      console.warn('   所有 NativeModules keys (前30個):', allModules.slice(0, 30));
        
        // 檢查是否有其他可能的微信模組名稱
      const wechatKeys = allModules.filter(key => 
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
        console.warn('   4. 在 Expo 項目中可能需要使用 Expo Modules API 註冊');
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
 * 異步獲取微信原生模組（等待 Bridge 就緒並初始化模組）
 * @returns {Promise<object|null>} WeChat 模組或 null
 */
async function getWeChatModuleAsync() {
  // 第一階段：等待 Bridge 初始化（任何模組出現）
  console.log('📡 [wechatIOSAuth] 第一階段：等待 React Native Bridge 初始化...');
  console.log('   ⏱️ 超時時間：30 秒（TestFlight 需要更長時間）');
  const bridgeInitSuccess = await waitForBridgeInitialization(30000);
  
  if (!bridgeInitSuccess) {
    console.error('❌ [wechatIOSAuth] Bridge 初始化失敗，無法獲取 WeChat 模組');
    return null;
  }
  
  console.log('✅ [wechatIOSAuth] Bridge 已初始化，開始獲取 WeChat 模組...');
  
  // Bridge 已就緒，獲取模組
  const WeChat = getWeChatModule();
  
  if (!WeChat) {
    console.error('❌ [wechatIOSAuth] WeChat 模組未找到');
    return null;
  }
  
  // 第二階段：手動初始化 WeChatModule（發送就緒事件）
  console.log('📡 [wechatIOSAuth] 第二階段：手動初始化 WeChatModule...');
  try {
    if (typeof WeChat.initializeModule === 'function') {
      await WeChat.initializeModule();
      console.log('✅ [wechatIOSAuth] WeChatModule 已手動初始化');
    } else {
      console.warn('⚠️ [wechatIOSAuth] WeChat.initializeModule 方法不存在，跳過手動初始化');
    }
  } catch (error) {
    console.error('❌ [wechatIOSAuth] WeChatModule 初始化失敗:', error);
    // 即使初始化失敗，也返回模組（可能仍然可用）
  }
  
  return WeChat;
}

/**
 * 初始化微信 SDK（支持延遲重試）- iOS 專用
 * 在應用啟動時調用，確保微信功能可用
 * 如果初始化失敗，不會拋出錯誤，避免應用崩潰
 */
export async function initWeChatSDK(retryCount = 0, maxRetries = 3) {
  if (Platform.OS !== 'ios') {
    console.warn('⚠️ [wechatIOSAuth] initWeChatSDK 僅支持 iOS 平台');
    return Promise.resolve(false);
  }

  try {
    // ⚠️ 關鍵：先等待 Bridge 初始化成功，然後獲取並初始化模組
    console.log(`🔧 [wechatIOSAuth] 開始初始化 WeChat SDK (嘗試 ${retryCount + 1}/${maxRetries + 1})...`);
    const WeChat = await getWeChatModuleAsync();
    
    if (!WeChat) {
      // 如果模組未找到且還有重試次數，延遲重試
      if (retryCount < maxRetries) {
        const delay = 1000 * (retryCount + 1);
        console.warn(`⚠️ [wechatIOSAuth] WeChat 模組未找到，${delay}ms 後重試 (${retryCount + 1}/${maxRetries})...`);
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(initWeChatSDK(retryCount + 1, maxRetries));
          }, delay);
        });
      }
      
      // 所有重試都失敗，返回錯誤信息
      const errorMessage = 'WeChat 原生模組初始化失敗';
      console.error('❌ [wechatIOSAuth]', errorMessage);
      console.error('   可能的原因：');
      console.error('   1. Bridge 初始化失敗');
      console.error('   2. WeChatModule.swift 未添加到 Xcode 項目');
      console.error('   3. WeChatPackage.m 未添加到 Xcode 項目');
      console.error('   4. 模組未正確編譯');
      console.error('   5. 文件未包含在 storyappv2 target 中');
      
      // 拋出錯誤，讓調用者處理（顯示 Alert）
      throw new Error(`${errorMessage}。請檢查 Xcode 項目配置。`);
    }

    if (!WX_APP_ID || WX_APP_ID === '') {
      const errorMessage = '微信 AppId 尚未設定';
      console.error('❌ [wechatIOSAuth]', errorMessage);
      throw new Error(errorMessage);
    }

    // 檢查 registerApp 方法是否存在
    if (typeof WeChat.registerApp !== 'function') {
      const errorMessage = 'WeChat.registerApp 方法不存在';
      console.error('❌ [wechatIOSAuth]', errorMessage);
      const availableMethods = Object.keys(WeChat).filter(key => typeof WeChat[key] === 'function');
      console.error('   可用的方法:', availableMethods);
      console.error('   所有屬性:', Object.keys(WeChat));
      throw new Error(`${errorMessage}。可用方法: ${availableMethods.join(', ')}`);
    }

    console.log(`🔧 [wechatIOSAuth] 正在註冊微信 SDK (AppID: ${WX_APP_ID})...`);
    
    const result = await WeChat.registerApp(WX_APP_ID);
    
    if (result) {
      console.log('✅ [wechatIOSAuth] 微信 SDK 註冊成功');
      return true;
    } else {
      const errorMessage = '微信 SDK 註冊失敗（registerApp 返回 false）';
      console.error('❌ [wechatIOSAuth]', errorMessage);
      console.error('   可能的原因：');
      console.error('   1. AppID 配置錯誤');
      console.error('   2. 微信開放平台配置不正確（Bundle ID）');
      console.error('   3. 應用未通過微信審核（測試環境可能需要配置）');
      console.error('   4. Info.plist 中缺少 URL Scheme 配置');
      throw new Error(errorMessage);
    }
  } catch (error) {
    // 捕獲所有錯誤，記錄詳細信息
    console.error('❌ [wechatIOSAuth] WeChat SDK 初始化失敗:', error);
    console.error('   錯誤類型:', error?.constructor?.name);
    console.error('   錯誤消息:', error?.message);
    if (error?.code) {
      console.error('   錯誤代碼:', error.code);
    }
    if (error?.stack) {
      console.error('   錯誤堆棧:', error.stack);
    }
    
    // 重新拋出錯誤，讓調用者處理（顯示 Alert）
    throw error;
  }
}

/**
 * 檢查微信是否已安裝 - iOS 專用
 */
export async function isWXAppInstalled() {
  if (Platform.OS !== 'ios') {
    console.warn('⚠️ [wechatIOSAuth] isWXAppInstalled 僅支持 iOS 平台');
    return false;
  }

  // ⚠️ 關鍵：先等待 Bridge 就緒
  const WeChat = await getWeChatModuleAsync();
  
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
    // ⚠️ 關鍵：使用異步版本，自動等待 Bridge 就緒
    const WeChat = await getWeChatModuleAsync();
    
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

