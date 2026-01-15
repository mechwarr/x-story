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
@objcMembers
public class WeChatModule: RCTEventEmitter, WXApiDelegate {
  
  // 使用 @objc 標記靜態變量，確保在 Release 構建中不被優化掉
  @objc public static var instance: WeChatModule?
  private var appId: String?
  private var authPromises: [String: RCTPromiseResolveBlock] = [:]
  private var authRejects: [String: RCTPromiseRejectBlock] = [:]
  
  // 模組初始化狀態
  private var isModuleInitialized = false
  
  // 強制保留 init 方法，防止 Release 構建優化
  @objc
  public override init() {
    super.init()
    WeChatModule.instance = self
    
    // 使用 os_log 替代 print，在 Release 構建中也能輸出
    // 同時保留 print 作為備用
    #if DEBUG
    print("✅ [WeChatModule] iOS 模組已創建")
    print("   模組將在 React Native 中註冊為: WeChat")
    print("   ⚠️ 注意：模組不會自動初始化，需要手動調用 initializeModule()")
    #else
    // Release 構建中使用 NSLog，確保日誌可見
    NSLog("✅ [WeChatModule] iOS 模組已創建")
    NSLog("   模組將在 React Native 中註冊為: WeChat")
    NSLog("   ⚠️ 注意：模組不會自動初始化，需要手動調用 initializeModule()")
    #endif
    
    // 不再自動發送事件，改為手動初始化
    // 這樣可以確保 Bridge 完全就緒後才初始化
  }
  
  /**
   * 手動初始化模組（在 Bridge 就緒後調用）
   * 發送 WeChatModuleReady 事件通知 JavaScript 端
   */
  @objc
  func initializeModule(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    // 檢查是否已經初始化
    if isModuleInitialized {
      #if DEBUG
      print("ℹ️ [WeChatModule] 模組已經初始化，跳過")
      #else
      NSLog("ℹ️ [WeChatModule] 模組已經初始化，跳過")
      #endif
      resolver(true)
      return
    }
    
    // 檢查 Bridge 是否可用
    guard let bridge = self.bridge else {
      #if DEBUG
      print("❌ [WeChatModule] Bridge 未就緒，無法初始化模組")
      #else
      NSLog("❌ [WeChatModule] Bridge 未就緒，無法初始化模組")
      #endif
      rejecter("BRIDGE_NOT_READY", "React Native Bridge is not ready", nil)
      return
    }
    
    // 發送模組就緒事件
    sendEvent(withName: "WeChatModuleReady", body: [
      "moduleName": "WeChat",
      "ready": true,
      "timestamp": Date().timeIntervalSince1970
    ])
    
    isModuleInitialized = true
    
    #if DEBUG
    print("✅ [WeChatModule] 模組已手動初始化並發送 WeChatModuleReady 事件")
    #else
    NSLog("✅ [WeChatModule] 模組已手動初始化並發送 WeChatModuleReady 事件")
    #endif
    
    resolver(true)
  }
  
  // 明確指定模組名稱
  // 注意：RCTEventEmitter 沒有 moduleName() 方法，所以不需要 override
  // 模組名稱會自動使用類名（去掉 "Module" 後綴），即 "WeChat"
  
  @objc
  public override static func requiresMainQueueSetup() -> Bool {
    return false
  }
  
  public override func supportedEvents() -> [String]! {
    return ["WeChat_Resp", "WeChatModuleReady"]
  }
  
  // MARK: - React Native 方法
  
  @objc
  func registerApp(_ appId: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    print("🔧 [WeChatModule] 正在註冊微信應用: \(appId)")
    
    self.appId = appId
    
    // 註冊微信 SDK
    // 注意：不同版本的 SDK API 可能不同
    // 如果 registerApp 不接受 delegate，需要在 handleOpenURL 中設置
    let result = WXApi.registerApp(appId, universalLink: "")
    
    if result {
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
    guard self.appId != nil else {
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
    // WXApi.send 可能返回 Void，直接調用即可
    // 成功或失敗會通過 WXApiDelegate 的 onResp 回調處理
    WXApi.send(req)
      print("✅ [WeChatModule] 授權請求已發送，等待用戶響應...")
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
  
  // MARK: - WXApiDelegate 實現
  
  public func onReq(_ req: BaseReq!) {
    // 處理來自微信的請求
    print("📱 [WeChatModule] 收到來自微信的請求: type=\(req?.type ?? -1)")
  }
  
  public func onResp(_ resp: BaseResp!) {
    // 處理來自微信的響應
    guard let resp = resp else {
      print("⚠️ [WeChatModule] 收到空的響應")
      return
    }
    handleWeChatResponse(resp)
  }
  
  // MARK: - 處理 URL 回調（由 AppDelegate 調用）
  
  @objc
  func handleOpenURL(_ url: URL) -> Bool {
    // 使用 delegate 方式處理
    // 由於 WeChatModule 實現了 WXApiDelegate，可以直接傳遞 self
    return WXApi.handleOpen(url, delegate: self)
  }
  
  @objc
  func handleOpenUniversalLink(_ userActivity: NSUserActivity) -> Bool {
    // 使用 delegate 方式處理
    // 由於 WeChatModule 實現了 WXApiDelegate，可以直接傳遞 self
    return WXApi.handleOpenUniversalLink(userActivity, delegate: self)
  }
  
  // MARK: - 獲取實例（供 AppDelegate 使用）
  
  @objc
  static func shared() -> WeChatModule? {
    return instance
  }
}

