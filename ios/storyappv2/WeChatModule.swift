//
//  WeChatModule.swift
//  storyappv2
//
//  WeChat 原生模組實現 - iOS 版本
//  對應 Android 的 WeChatModule.java
//

import Foundation
import React
// WeChat SDK 通過 Bridging Header 導入，無需在這裡 import

@objc(WeChatModule)
public class WeChatModule: RCTEventEmitter {
  
  private static var instance: WeChatModule?
  private var api: WXApi?
  private var appId: String?
  private var authPromises: [String: RCTPromiseResolveBlock] = [:]
  private var authRejects: [String: RCTPromiseRejectBlock] = [:]
  
  override init() {
    super.init()
    WeChatModule.instance = self
    print("✅ [WeChatModule] iOS 模組已創建，模組名稱: WeChat")
  }
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
  
  override func supportedEvents() -> [String]! {
    return ["WeChat_Resp"]
  }
  
  // MARK: - React Native 方法
  
  @objc
  func registerApp(_ appId: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    print("🔧 [WeChatModule] 正在註冊微信應用: \(appId)")
    
    self.appId = appId
    
    // 註冊微信 SDK
    let result = WXApi.registerApp(appId, universalLink: "")
    
    if result {
      self.api = WXApi.shared()
      print("✅ [WeChatModule] 微信 SDK 註冊成功")
      resolver(true)
    } else {
      print("❌ [WeChatModule] 微信 SDK 註冊失敗")
      rejecter("REGISTER_ERROR", "Failed to register WeChat app", nil)
    }
  }
  
  @objc
  func isWXAppInstalled(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    // WXApi.isWXAppInstalled() 是靜態方法，不需要 api 實例
    let installed = WXApi.isWXAppInstalled()
    print("🔍 [WeChatModule] 微信是否已安裝: \(installed)")
    resolver(installed)
  }
  
  @objc
  func sendAuthRequest(_ scope: String, state: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    guard let api = self.api else {
      rejecter("NOT_REGISTERED", "WeChat API not registered", nil)
      return
    }
    
    guard WXApi.isWXAppInstalled() else {
      rejecter("NOT_INSTALLED", "WeChat app not installed", nil)
      return
    }
    
    // 創建授權請求
    let req = SendAuthReq()
    req.scope = scope
    req.state = state.isEmpty ? UUID().uuidString : state
    
    // 保存 Promise
    let requestId = req.state
    authPromises[requestId] = resolver
    authRejects[requestId] = rejecter
    
    // 發送請求
    // 注意：WXApi.send 的 API 可能因版本而異
    // 如果編譯錯誤，請根據實際 SDK 版本調整
    let result = WXApi.send(req)
    
    if !result {
      print("❌ [WeChatModule] 發送授權請求失敗")
      authPromises.removeValue(forKey: requestId)
      authRejects.removeValue(forKey: requestId)
      rejecter("SEND_ERROR", "Failed to send auth request", nil)
    } else {
      print("✅ [WeChatModule] 授權請求已發送，等待用戶響應...")
    }
  }
  
  // MARK: - WXApiDelegate (通過 handleOpenURL 設置)
  
  private func handleWeChatResponse(_ resp: BaseResp) {
    print("📱 [WeChatModule] 收到微信響應: errCode=\(resp.errCode), type=\(resp.type)")
    
    // 處理請求（如果需要）
    if resp.type == 0 {
      print("📱 [WeChatModule] 收到微信請求: type=\(resp.type)")
    }
    
    // 創建響應字典
    var result: [String: Any] = [
      "errCode": resp.errCode,
      "errStr": resp.errStr ?? "",
      "type": resp.type
    ]
    
    // 處理授權響應
    if resp.type == 1, let authResp = resp as? SendAuthResp {
      if resp.errCode == WXSuccess.rawValue {
        result["code"] = authResp.code ?? ""
        result["state"] = authResp.state ?? ""
        result["url"] = authResp.url ?? ""
        result["lang"] = authResp.lang ?? ""
        result["country"] = authResp.country ?? ""
      }
    }
    
    // 發送事件到 JavaScript
    sendEvent(withName: "WeChat_Resp", body: result)
    
    // 處理 Promise
    if let state = (resp as? SendAuthResp)?.state ?? result["state"] as? String {
      if resp.errCode == WXSuccess.rawValue {
        // 成功
        if let resolver = authPromises[state] {
          resolver(result)
          authPromises.removeValue(forKey: state)
          authRejects.removeValue(forKey: state)
        }
      } else if resp.errCode == WXErrCodeUserCancel.rawValue {
        // 用戶取消
        if let rejecter = authRejects[state] {
          rejecter("USER_CANCEL", "User cancelled", nil)
          authPromises.removeValue(forKey: state)
          authRejects.removeValue(forKey: state)
        }
      } else {
        // 其他錯誤
        if let rejecter = authRejects[state] {
          rejecter("AUTH_ERROR", resp.errStr ?? "Unknown error", nil)
          authPromises.removeValue(forKey: state)
          authRejects.removeValue(forKey: state)
        }
      }
    }
  }
  
  // MARK: - 處理 URL 回調（由 AppDelegate 調用）
  
  @objc
  func handleOpenURL(_ url: URL) -> Bool {
    return WXApi.handleOpen(url) { [weak self] resp in
      guard let self = self, let resp = resp else { return }
      self.handleWeChatResponse(resp)
    }
  }
  
  @objc
  func handleOpenUniversalLink(_ userActivity: NSUserActivity) -> Bool {
    return WXApi.handleOpenUniversalLink(userActivity) { [weak self] resp in
      guard let self = self, let resp = resp else { return }
      self.handleWeChatResponse(resp)
    }
  }
  
  // MARK: - 獲取實例（供 AppDelegate 使用）
  
  @objc
  static func shared() -> WeChatModule? {
    return instance
  }
}

