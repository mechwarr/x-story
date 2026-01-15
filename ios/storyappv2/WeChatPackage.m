//
//  WeChatPackage.m
//  storyappv2
//
//  WeChat 模組註冊器 - iOS 版本（Objective-C）
//  對應 Android 的 WeChatPackage.java
//
//  使用 RCT_EXTERN_MODULE 宏自動註冊 Swift 模組到 React Native Bridge
//

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

// 使用 RCT_EXTERN_MODULE 宏註冊 WeChatModule（Swift 類）
// 這會自動將 WeChatModule 註冊到 React Native Bridge
// 注意：必須使用 @interface 和 @end 包裝
@interface RCT_EXTERN_MODULE(WeChatModule, RCTEventEmitter)

// 導出方法給 JavaScript 調用
RCT_EXTERN_METHOD(registerApp:(NSString *)appId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(isWXAppInstalled:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(sendAuthRequest:(NSString *)scope
                  state:(NSString *)state
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(initializeModule:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end

