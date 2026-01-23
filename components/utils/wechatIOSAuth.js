// 微信登入模組 - iOS 專用實現
// 簡化版：移除過度複雜的 Bridge 檢測，直接使用 NativeModules
import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

// ==================== 配置 ====================
const WX_APP_ID = 'wx277826ce3d9510c6';
const BRIDGE_TIMEOUT = 10000; // 10 秒超時

// ==================== 模組緩存 ====================
let cachedWeChat = null;
let weChatEmitter = null;
let isSDKRegistered = false;

/**
 * 獲取 WeChat 原生模組
 * 直接從 NativeModules 獲取，不做過度複雜的檢測
 */
function getWeChatModule() {
  if (Platform.OS !== 'ios') {
    return null;
  }

  // 使用緩存
  if (cachedWeChat) {
    return cachedWeChat;
  }

  try {
    const { WeChatModule } = NativeModules;
    
    // 嘗試不同的模組名稱
    // RCT_EXTERN_MODULE(WeChatModule, RCTEventEmitter) 會註冊為 "WeChatModule"
    // 但如果類名是 WeChatModule，React Native 可能會去掉 "Module" 後綴，變成 "WeChat"
    const WeChat = WeChatModule || NativeModules.WeChat;
    
    if (WeChat) {
      console.log('✅ [wechatIOSAuth] WeChat 模組已找到');
      console.log('   可用方法:', Object.keys(WeChat).filter(k => typeof WeChat[k] === 'function'));
      cachedWeChat = WeChat;
      return WeChat;
    }
    
    // 診斷：列出所有模組
    const allModules = Object.keys(NativeModules);
    console.warn('⚠️ [wechatIOSAuth] WeChat 模組未找到');
    console.warn('   已註冊的模組數量:', allModules.length);
    
    // 查找可能的微信相關模組
    const wechatRelated = allModules.filter(key => 
      key.toLowerCase().includes('wechat') || 
      key.toLowerCase().includes('weixin') ||
      key.toLowerCase().includes('wx')
    );
    
    if (wechatRelated.length > 0) {
      console.warn('   找到微信相關模組:', wechatRelated);
      // 嘗試使用找到的模組
      for (const moduleName of wechatRelated) {
        const module = NativeModules[moduleName];
        if (module && typeof module.registerApp === 'function') {
          console.log(`   使用模組: ${moduleName}`);
          cachedWeChat = module;
          return module;
        }
      }
    } else {
      console.warn('   前 20 個模組:', allModules.slice(0, 20));
    }
    
    return null;
  } catch (error) {
    console.error('❌ [wechatIOSAuth] 獲取模組時發生錯誤:', error);
    return null;
  }
}

/**
 * 等待 WeChat 模組可用（帶超時）
 * @param {number} timeout - 超時時間（毫秒）
 */
async function waitForWeChatModule(timeout = BRIDGE_TIMEOUT) {
  // 先嘗試直接獲取
  let WeChat = getWeChatModule();
  if (WeChat) {
    return WeChat;
  }
  
  console.log(`⏳ [wechatIOSAuth] 等待 WeChat 模組（最多 ${timeout}ms）...`);
  
  return new Promise((resolve) => {
    const startTime = Date.now();
    const checkInterval = 100; // 每 100ms 檢查一次
    
    const intervalId = setInterval(() => {
      WeChat = getWeChatModule();
      
      if (WeChat) {
        clearInterval(intervalId);
        console.log(`✅ [wechatIOSAuth] WeChat 模組就緒（耗時 ${Date.now() - startTime}ms）`);
        resolve(WeChat);
        return;
      }
      
      // 超時檢查
      if (Date.now() - startTime >= timeout) {
        clearInterval(intervalId);
        console.error(`❌ [wechatIOSAuth] 等待 WeChat 模組超時（${timeout}ms）`);
        
        // 最後診斷
        const allModules = Object.keys(NativeModules);
        console.error('   模組總數:', allModules.length);
        if (allModules.length === 0) {
          console.error('   ⚠️ NativeModules 為空！');
          console.error('   可能原因：');
          console.error('   1. WeChatPackage.m 語法錯誤');
          console.error('   2. WeChatModule.swift 未編譯');
          console.error('   3. 需要重新執行 pod install');
          console.error('   4. 需要清除 Xcode 構建緩存');
        } else {
          console.error('   已有模組但無 WeChat:', allModules.slice(0, 15));
        }
        
        resolve(null);
      }
    }, checkInterval);
  });
}

/**
 * 獲取事件發射器
 */
function getWeChatEmitter() {
  if (weChatEmitter) {
    return weChatEmitter;
  }
  
  const WeChat = getWeChatModule();
  if (WeChat) {
    try {
      weChatEmitter = new NativeEventEmitter(WeChat);
    } catch (e) {
      console.warn('⚠️ [wechatIOSAuth] 創建 EventEmitter 失敗:', e);
    }
  }
  return weChatEmitter;
}

/**
 * 初始化微信 SDK
 * @param {number} retryCount - 當前重試次數
 * @param {number} maxRetries - 最大重試次數
 */
export async function initWeChatSDK(retryCount = 0, maxRetries = 2) {
  if (Platform.OS !== 'ios') {
    console.warn('⚠️ [wechatIOSAuth] initWeChatSDK 僅支持 iOS 平台');
    return false;
  }

  // 如果已經註冊成功，直接返回
  if (isSDKRegistered) {
    console.log('ℹ️ [wechatIOSAuth] SDK 已經註冊，跳過');
    return true;
  }

  console.log(`🔧 [wechatIOSAuth] 開始初始化 WeChat SDK（嘗試 ${retryCount + 1}/${maxRetries + 1}）...`);

  try {
    // 等待模組可用
    const WeChat = await waitForWeChatModule(BRIDGE_TIMEOUT);
    
    if (!WeChat) {
      if (retryCount < maxRetries) {
        const delay = 1000 * (retryCount + 1);
        console.warn(`⚠️ [wechatIOSAuth] 模組未找到，${delay}ms 後重試...`);
        await new Promise(r => setTimeout(r, delay));
        return initWeChatSDK(retryCount + 1, maxRetries);
      }
      throw new Error('WeChat 原生模組未找到。請確認 WeChatModule.swift 和 WeChatPackage.m 已正確添加到 Xcode 項目。');
    }

    // 檢查 AppID
    if (!WX_APP_ID) {
      throw new Error('微信 AppID 尚未設定');
    }

    // 檢查 registerApp 方法
    if (typeof WeChat.registerApp !== 'function') {
      const methods = Object.keys(WeChat).filter(k => typeof WeChat[k] === 'function');
      throw new Error(`WeChat.registerApp 方法不存在。可用方法: ${methods.join(', ')}`);
    }

    // 嘗試手動初始化模組（如果方法存在）
    if (typeof WeChat.initializeModule === 'function') {
      try {
        await WeChat.initializeModule();
        console.log('✅ [wechatIOSAuth] 模組已初始化');
      } catch (initError) {
        console.warn('⚠️ [wechatIOSAuth] 模組初始化警告:', initError.message);
        // 繼續執行，不中斷流程
      }
    }

    // 註冊 App
    console.log(`🔧 [wechatIOSAuth] 正在註冊 AppID: ${WX_APP_ID}...`);
    const result = await WeChat.registerApp(WX_APP_ID);
    
    if (result) {
      console.log('✅ [wechatIOSAuth] 微信 SDK 註冊成功');
      isSDKRegistered = true;
      return true;
    } else {
      throw new Error('微信 SDK 註冊失敗（registerApp 返回 false）。請檢查 Universal Link 和微信開放平台配置。');
    }
  } catch (error) {
    console.error('❌ [wechatIOSAuth] SDK 初始化失敗:', error.message);
    
    // 如果還有重試機會
    if (retryCount < maxRetries) {
      const delay = 1000 * (retryCount + 1);
      console.warn(`⚠️ [wechatIOSAuth] ${delay}ms 後重試...`);
      await new Promise(r => setTimeout(r, delay));
      return initWeChatSDK(retryCount + 1, maxRetries);
    }
    
    throw error;
  }
}

/**
 * 檢查微信是否已安裝
 */
export async function isWXAppInstalled() {
  if (Platform.OS !== 'ios') {
    return false;
  }

  try {
    const WeChat = await waitForWeChatModule(BRIDGE_TIMEOUT);
    
    if (!WeChat || typeof WeChat.isWXAppInstalled !== 'function') {
      console.warn('⚠️ [wechatIOSAuth] 無法檢查微信安裝狀態');
      return false;
    }

    const installed = await WeChat.isWXAppInstalled();
    console.log(`🔍 [wechatIOSAuth] 微信是否已安裝: ${installed}`);
    return installed;
  } catch (error) {
    console.error('❌ [wechatIOSAuth] 檢查微信安裝狀態失敗:', error);
    return false;
  }
}

/**
 * 微信登入
 * @returns {Promise<string|null>} 返回授權碼 code，失敗或取消返回 null
 */
export async function wechatLogin() {
  if (Platform.OS !== 'ios') {
    throw new Error('微信登入僅支持 iOS 平台');
  }

  try {
    // 獲取模組
    const WeChat = await waitForWeChatModule(BRIDGE_TIMEOUT);
    
    if (!WeChat) {
      throw new Error('微信 SDK 模組未找到');
    }

    // 檢查方法
    if (typeof WeChat.sendAuthRequest !== 'function') {
      const methods = Object.keys(WeChat).filter(k => typeof WeChat[k] === 'function');
      throw new Error(`sendAuthRequest 方法不存在。可用方法: ${methods.join(', ')}`);
    }

    // 確保 SDK 已初始化
    await initWeChatSDK();

    // 檢查微信是否已安裝
    const isInstalled = await isWXAppInstalled();
    if (!isInstalled) {
      throw new Error('未檢測到微信應用，請先安裝微信');
    }

    // 發送授權請求
    console.log('🔧 [wechatIOSAuth] 發送授權請求...');
    const response = await WeChat.sendAuthRequest('snsapi_userinfo', '');
    
    console.log('📱 [wechatIOSAuth] 收到授權響應:', {
      hasResponse: !!response,
      hasCode: !!(response?.code),
      codeLength: response?.code?.length || 0,
      errCode: response?.errCode,
      errStr: response?.errStr,
      type: response?.type,
      fullResponse: JSON.stringify(response, null, 2),
    });
    
    if (response && response.code) {
      console.log('✅ [wechatIOSAuth] 微信授權成功，code:', response.code.substring(0, 20) + '...');
      return response.code;
    } else {
      // 詳細記錄響應異常情況
      const errorDetails = {
        hasResponse: !!response,
        errCode: response?.errCode,
        errStr: response?.errStr,
        type: response?.type,
        hasCode: !!(response?.code),
      };
      console.warn('⚠️ [wechatIOSAuth] 授權響應異常:', errorDetails);
      console.warn('   完整響應:', JSON.stringify(response, null, 2));
      
      // 如果響應存在但沒有 code，可能是後端驗證失敗或其他錯誤
      if (response && response.errCode !== undefined && response.errCode !== 0) {
        const errorMsg = response.errStr || `微信授權失敗，錯誤碼: ${response.errCode}`;
        throw new Error(errorMsg);
      }
      
      return null;
    }
  } catch (error) {
    // 用戶取消
    if (error.code === 'USER_CANCEL' || error.message?.includes('USER_CANCEL') || error.code === -2) {
      console.log('ℹ️ [wechatIOSAuth] 用戶取消微信登入');
      return null;
    }
    
    console.error('❌ [wechatIOSAuth] 微信登入失敗:', error);
    return null;
  }
}

/**
 * 監聽微信響應事件
 */
export function addWeChatResponseListener(callback) {
  if (Platform.OS !== 'ios') {
    return null;
  }

  const emitter = getWeChatEmitter();
  if (!emitter) {
    console.warn('⚠️ [wechatIOSAuth] 事件監聽器未初始化');
    return null;
  }

  return emitter.addListener('WeChat_Resp', (response) => {
    console.log('📱 [wechatIOSAuth] 收到微信響應:', response);
    callback?.(response);
  });
}

/**
 * 重置模組緩存（用於調試）
 */
export function resetWeChatModule() {
  cachedWeChat = null;
  weChatEmitter = null;
  isSDKRegistered = false;
  console.log('🔄 [wechatIOSAuth] 模組緩存已重置');
}
