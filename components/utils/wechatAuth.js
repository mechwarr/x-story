// 安全地導入 WeChat 模組，如果模組未正確連結則為 null
let WeChat = null;
try {
  WeChat = require("react-native-wechat-lib");
  // 檢查導入的模組是否有效
  if (!WeChat || typeof WeChat.registerApp !== 'function') {
    WeChat = null;
  }
} catch (error) {
  console.warn('微信 SDK 模組載入失敗:', error.message);
  WeChat = null;
}

const WX_APP_ID = 'wx277826ce3d9510c6';

// SDK 初始化已關閉
// if (WX_APP_ID && WX_APP_ID !== '' && WeChat) {
//   WeChat.registerApp(WX_APP_ID);
// } else {
//   console.warn('微信AppId 尚未設定，跳過微信SDK初始化');
// }

export async function wechatLogin() {
  try {
    // 檢查 WeChat 模組是否可用
    if (!WeChat) {
      console.warn('微信 SDK 模組未正確初始化，無法使用微信登入');
      return null;
    }

    // 如果沒 AppId 或跳過初始化，直接拋錯或回傳 null
    if (!WX_APP_ID || WX_APP_ID === '') {
      console.warn('微信AppId 尚未設定，無法使用微信登入');
      return null;
    }

    const isInstalled = await WeChat.isWXAppInstalled();
    if (!isInstalled) {
      throw new Error("WeChat app not installed");
    }

    const response = await WeChat.sendAuthRequest("snsapi_userinfo");
    if (response.errCode === 0) {
      return response.code;
    } else {
      return null;
    }
  } catch (error) {
    console.error("WeChat login error:", error);
    return null;
  }
}
