// 微信登入模組 - 統一入口，根據平台自動選擇實現
import { Platform } from 'react-native';

// 根據平台動態載入對應的實現（延遲載入，避免模組不存在時報錯）
function getPlatformAuth() {
  if (Platform.OS === 'android') {
    return require('./wechatAndroidAuth');
  } else if (Platform.OS === 'ios') {
    return require('./wechatIOSAuth');
  }
  return null;
}

/**
 * 初始化微信 SDK
 * 根據平台自動調用對應的實現
 * @param {number} retryCount - 重試次數（內部使用）
 * @param {number} maxRetries - 最大重試次數（內部使用）
 * @returns {Promise<boolean>} 初始化是否成功
 */
export function initWeChatSDK(retryCount = 0, maxRetries = 3) {
  const platformAuth = getPlatformAuth();
  if (platformAuth) {
    return platformAuth.initWeChatSDK(retryCount, maxRetries);
  } else {
    console.warn(`⚠️ [wechatAuth] 不支持的平台: ${Platform.OS}`);
    return Promise.resolve(false);
  }
}

/**
 * 檢查微信是否已安裝
 * 根據平台自動調用對應的實現
 * @returns {Promise<boolean>} 微信是否已安裝
 */
export async function isWXAppInstalled() {
  const platformAuth = getPlatformAuth();
  if (platformAuth) {
    return platformAuth.isWXAppInstalled();
  } else {
    console.warn(`⚠️ [wechatAuth] 不支持的平台: ${Platform.OS}`);
    return false;
  }
}

/**
 * 微信登入
 * 根據平台自動調用對應的實現
 * @returns {Promise<string|null>} 返回授權碼 code，失敗或取消返回 null
 */
export async function wechatLogin() {
  const platformAuth = getPlatformAuth();
  if (platformAuth) {
    return platformAuth.wechatLogin();
  } else {
    console.warn(`⚠️ [wechatAuth] 不支持的平台: ${Platform.OS}`);
    return null;
  }
}

/**
 * 監聽微信響應事件（可選，用於處理其他類型的響應）
 * 根據平台自動調用對應的實現
 * @param {Function} callback - 回調函數
 * @returns {EventSubscription|null} 事件訂閱對象，可用於取消監聽
 */
export function addWeChatResponseListener(callback) {
  const platformAuth = getPlatformAuth();
  if (platformAuth) {
    return platformAuth.addWeChatResponseListener(callback);
  } else {
    console.warn(`⚠️ [wechatAuth] 不支持的平台: ${Platform.OS}`);
    return null;
  }
}
