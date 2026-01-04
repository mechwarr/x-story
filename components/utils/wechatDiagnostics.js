// 微信登入診斷工具 - 用於在 TestFlight 環境中診斷問題
import { NativeModules, Platform, Alert } from 'react-native';

/**
 * 診斷微信模組狀態
 * 在 TestFlight 環境中調用此函數可以顯示詳細的診斷信息
 */
export function diagnoseWeChatModule() {
  if (Platform.OS !== 'ios') {
    Alert.alert('診斷結果', '此診斷工具僅支持 iOS 平台');
    return;
  }

  const { WeChat } = NativeModules;
  const allModules = Object.keys(NativeModules);
  const wechatRelated = allModules.filter(key => 
    key.toLowerCase().includes('wechat') || 
    key.toLowerCase().includes('weixin') ||
    key.toLowerCase().includes('wx')
  );

  let message = `微信模組診斷結果：\n\n`;
  
  // 檢查模組是否存在
  if (WeChat) {
    message += `✅ WeChat 模組已找到\n\n`;
    
    // 檢查方法
    const methods = Object.keys(WeChat).filter(key => typeof WeChat[key] === 'function');
    message += `可用方法 (${methods.length}):\n`;
    methods.forEach(method => {
      message += `  - ${method}\n`;
    });
    
    // 檢查必要方法
    const requiredMethods = ['registerApp', 'isWXAppInstalled', 'sendAuthRequest'];
    const missingMethods = requiredMethods.filter(m => !methods.includes(m));
    
    if (missingMethods.length > 0) {
      message += `\n⚠️ 缺少必要方法: ${missingMethods.join(', ')}\n`;
    } else {
      message += `\n✅ 所有必要方法都存在\n`;
    }
  } else {
    message += `❌ WeChat 模組未找到\n\n`;
    message += `已註冊的模組總數: ${allModules.length}\n`;
    
    if (wechatRelated.length > 0) {
      message += `\n找到相關模組: ${wechatRelated.join(', ')}\n`;
    } else {
      message += `\n未找到任何微信相關模組\n`;
    }
    
    message += `\n可能的原因：\n`;
    message += `1. WeChatModule.swift 未添加到 Xcode 項目\n`;
    message += `2. 模組未包含在 storyappv2 target 中\n`;
    message += `3. 模組未正確編譯\n`;
    message += `4. 需要重新構建應用\n`;
  }

  // 顯示前20個模組名稱（用於調試）
  message += `\n已註冊模組 (前20個):\n`;
  allModules.slice(0, 20).forEach((module, index) => {
    message += `${index + 1}. ${module}\n`;
  });

  Alert.alert('微信模組診斷', message, [{ text: '確定' }]);
  
  // 同時輸出到 console（如果可用）
  console.log('=== 微信模組診斷 ===');
  console.log(message);
}

