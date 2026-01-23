//
//  WeChatPackage.m
//  storyappv2
//
//  WeChat 模組註冊器 - iOS 版本（Objective-C）
//  對應 Android 的 WeChatPackage.java
//
//  使用 RCT_EXTERN_MODULE 宏自動註冊 Swift 模組到 React Native Bridge
//  ⚠️ 重要：這個文件必須存在且格式正確，否則 WeChatModule 無法被 React Native 識別
//

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

// 使用 RCT_EXTERN_MODULE 宏註冊 WeChatModule（Swift 類）
// 這會自動將 WeChatModule 註冊到 React Native Bridge
// 第一個參數是 Swift 類名，第二個參數是父類
@interface RCT_EXTERN_MODULE(WeChatModule, RCTEventEmitter)

// 導出 registerApp 方法給 JavaScript 調用
// 參數名必須與 Swift 方法中的參數標籤完全匹配
RCT_EXTERN_METHOD(registerApp:(NSString *)appId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// 導出 isWXAppInstalled 方法
RCT_EXTERN_METHOD(isWXAppInstalled:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// 導出 sendAuthRequest 方法
RCT_EXTERN_METHOD(sendAuthRequest:(NSString *)scope
                  state:(NSString *)state
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// 導出 initializeModule 方法（用於手動初始化）
RCT_EXTERN_METHOD(initializeModule:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// 聲明此模組需要在主線程上初始化
// 這對於某些需要 UI 操作的模組很重要
+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

@end
