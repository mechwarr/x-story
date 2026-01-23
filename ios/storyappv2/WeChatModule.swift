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
    guard self.bridge != nil else {
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
  
  // ⚠️ 重要：返回 YES 確保模組在主線程上初始化
  // 這對於與 Bridge 的正確交互至關重要
  @objc
  public override static func requiresMainQueueSetup() -> Bool {
    return true
  }
  
  public override func supportedEvents() -> [String]! {
    return ["WeChat_Resp", "WeChatModuleReady"]
  }
  
  // MARK: - React Native 方法
  
  // ⚠️ 重要：必須在微信開放平台配置相同的 Universal Link
  // 格式：https://你的域名/app/ 或 https://你的域名/wechat/
  // 同時需要在 Associated Domains 中添加 applinks:你的域名
  private static let WECHAT_UNIVERSAL_LINK = "https://xstudio-mclub.url.tw/app/"
  
  @objc
  func registerApp(_ appId: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    #if DEBUG
    print("🔧 [WeChatModule] 正在註冊微信應用: \(appId)")
    print("   Universal Link: \(WeChatModule.WECHAT_UNIVERSAL_LINK)")
    #else
    NSLog("🔧 [WeChatModule] 正在註冊微信應用: %@", appId)
    NSLog("   Universal Link: %@", WeChatModule.WECHAT_UNIVERSAL_LINK)
    #endif
    
    self.appId = appId
    
    // 註冊微信 SDK
    // ⚠️ WechatOpenSDK 1.8.6+ 版本強制要求 Universal Link
    // 如果 universalLink 為空或無效，registerApp 會返回 false
    let result = WXApi.registerApp(appId, universalLink: WeChatModule.WECHAT_UNIVERSAL_LINK)
    
    if result {
      #if DEBUG
      print("✅ [WeChatModule] 微信 SDK 註冊成功")
      #else
      NSLog("✅ [WeChatModule] 微信 SDK 註冊成功")
      #endif
      resolver(true)
    } else {
      #if DEBUG
      print("❌ [WeChatModule] 微信 SDK 註冊失敗")
      print("   可能原因：")
      print("   1. Universal Link 配置不正確")
      print("   2. appId 格式錯誤")
      print("   3. 微信開放平台未配置此 Universal Link")
      #else
      NSLog("❌ [WeChatModule] 微信 SDK 註冊失敗")
      NSLog("   可能原因：Universal Link 配置不正確或微信開放平台未配置")
      #endif
      rejecter("REGISTER_ERROR", "Failed to register WeChat app. Check Universal Link configuration.", nil)
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
    
    #if DEBUG
    print("✅ [WeChatModule] 授權請求已發送，等待用戶響應...")
    #else
    NSLog("✅ [WeChatModule] 授權請求已發送，等待用戶響應...")
    #endif
  }
  
  // MARK: - WXApiDelegate (通過 handleOpenURL 設置)
  
  private func handleWeChatResponse(_ resp: BaseResp) {
    // 確保在主執行緒上執行
    assert(Thread.isMainThread, "handleWeChatResponse 必須在主執行緒上調用")
    
    #if DEBUG
    print("📱 [WeChatModule] 收到微信響應: errCode=\(resp.errCode), type=\(resp.type)")
    #else
    NSLog("📱 [WeChatModule] 收到微信響應: errCode=%d, type=%d", resp.errCode, resp.type)
    #endif
    
    // 處理請求（如果需要）
    if resp.type == 0 {
      #if DEBUG
      print("📱 [WeChatModule] 收到微信請求: type=\(resp.type)")
      #else
      NSLog("📱 [WeChatModule] 收到微信請求: type=%d", resp.type)
      #endif
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
    
    // 確保 Bridge 可用後再發送事件
    guard self.bridge != nil else {
      #if DEBUG
      print("⚠️ [WeChatModule] Bridge 未就緒，無法發送事件，將延遲處理")
      #else
      NSLog("⚠️ [WeChatModule] Bridge 未就緒，無法發送事件，將延遲處理")
      #endif
      
      // 延遲處理，等待 Bridge 就緒
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
        guard let self = self, self.bridge != nil else {
          #if DEBUG
          print("❌ [WeChatModule] 延遲處理失敗，Bridge 仍未就緒")
          #else
          NSLog("❌ [WeChatModule] 延遲處理失敗，Bridge 仍未就緒")
          #endif
          return
        }
        self.sendEvent(withName: "WeChat_Resp", body: result)
        self.resolveAuthPromise(for: resp, with: result)
      }
      return
    }
    
    // 發送事件到 JavaScript
    sendEvent(withName: "WeChat_Resp", body: result)
    
    // 處理 Promise
    resolveAuthPromise(for: resp, with: result)
  }
  
  // 分離 Promise 處理邏輯，提高可讀性和可維護性
  private func resolveAuthPromise(for resp: BaseResp, with result: [String: Any]) {
    // 嘗試從多個來源獲取 state
    var state: String? = nil
    
    if let authResp = resp as? SendAuthResp {
      state = authResp.state
    }
    
    if state == nil || state?.isEmpty == true {
      state = result["state"] as? String
    }
    
    // 如果仍然沒有 state，嘗試從所有保存的 Promise 中找到匹配的（可能是最後一個）
    if state == nil || state?.isEmpty == true {
      // 如果是授權響應（type == 1），嘗試使用第一個可用的 Promise
      if resp.type == 1 && !authPromises.isEmpty {
        state = authPromises.keys.first
        #if DEBUG
        print("⚠️ [WeChatModule] 無法從響應中獲取 state，使用第一個可用的 Promise key: \(state ?? "nil")")
        #else
        NSLog("⚠️ [WeChatModule] 無法從響應中獲取 state，使用第一個可用的 Promise key")
        #endif
      } else {
        #if DEBUG
        print("❌ [WeChatModule] 無法解析 state，無法處理 Promise。響應類型: \(resp.type), errCode: \(resp.errCode)")
        print("   當前保存的 Promise keys: \(Array(authPromises.keys))")
        #else
        NSLog("❌ [WeChatModule] 無法解析 state，無法處理 Promise")
        #endif
        
        // 如果無法匹配 state，但還有待處理的 Promise，嘗試處理第一個
        if !authPromises.isEmpty, let firstState = authPromises.keys.first, let rejecter = authRejects[firstState] {
          rejecter("STATE_MISMATCH", "無法匹配授權請求的 state，可能是回調延遲或應用重啟", nil)
          authPromises.removeValue(forKey: firstState)
          authRejects.removeValue(forKey: firstState)
        }
        return
      }
    }
    
    guard let validState = state, !validState.isEmpty else {
      #if DEBUG
      print("❌ [WeChatModule] state 為空，無法處理 Promise")
      #else
      NSLog("❌ [WeChatModule] state 為空，無法處理 Promise")
      #endif
      return
    }
    
    if resp.errCode == WXSuccess.rawValue {
      // 成功
      if let resolver = authPromises[validState] {
        resolver(result)
        authPromises.removeValue(forKey: validState)
        authRejects.removeValue(forKey: validState)
        #if DEBUG
        print("✅ [WeChatModule] Promise 已 resolve，state: \(validState)")
        #else
        NSLog("✅ [WeChatModule] Promise 已 resolve")
        #endif
      } else {
        #if DEBUG
        print("⚠️ [WeChatModule] 找不到對應的 resolver，state: \(validState)")
        print("   當前保存的 Promise keys: \(Array(authPromises.keys))")
        #else
        NSLog("⚠️ [WeChatModule] 找不到對應的 resolver")
        #endif
      }
    } else if resp.errCode == WXErrCodeUserCancel.rawValue {
      // 用戶取消
      if let rejecter = authRejects[validState] {
        rejecter("USER_CANCEL", "User cancelled", nil)
        authPromises.removeValue(forKey: validState)
        authRejects.removeValue(forKey: validState)
      }
    } else {
      // 其他錯誤
      if let rejecter = authRejects[validState] {
        let errorMessage = (resp.errStr ?? "").isEmpty ? "Unknown error" : (resp.errStr ?? "")
        rejecter("AUTH_ERROR", errorMessage, nil)
        authPromises.removeValue(forKey: validState)
        authRejects.removeValue(forKey: validState)
      }
    }
  }
  
  // MARK: - WXApiDelegate 實現
  // 注意：Objective-C 協議定義為 BaseReq* 和 BaseResp*，在 Swift 中對應可選類型 BaseReq? 和 BaseResp?
  
  public func onReq(_ req: BaseReq?) {
    // 處理來自微信的請求
    guard let req = req else {
      print("⚠️ [WeChatModule] 收到空的請求")
      return
    }
    print("📱 [WeChatModule] 收到來自微信的請求: type=\(req.type)")
  }
  
  public func onResp(_ resp: BaseResp?) {
    // 處理來自微信的響應
    guard let resp = resp else {
      #if DEBUG
      print("⚠️ [WeChatModule] 收到空的響應")
      #else
      NSLog("⚠️ [WeChatModule] 收到空的響應")
      #endif
      return
    }
    
    // 確保在主執行緒上處理響應，特別是發送事件到 JavaScript
    if Thread.isMainThread {
      handleWeChatResponse(resp)
    } else {
      DispatchQueue.main.async { [weak self] in
        guard let self = self else { return }
        self.handleWeChatResponse(resp)
      }
    }
  }
  
  // MARK: - 處理 URL 回調（由 AppDelegate 調用）
  
  @objc
  func handleOpenURL(_ url: URL) -> Bool {
    // 確保在主執行緒上執行
    guard Thread.isMainThread else {
      var result = false
      DispatchQueue.main.sync {
        result = self.handleOpenURL(url)
      }
      return result
    }
    
    // 使用 delegate 方式處理
    // 由於 WeChatModule 實現了 WXApiDelegate，可以直接傳遞 self
    // 確保實例被正確保留，避免在回調過程中被釋放
    let result = WXApi.handleOpen(url, delegate: self)
    
    #if DEBUG
    print("📱 [WeChatModule] handleOpenURL 結果: \(result)")
    #else
    NSLog("📱 [WeChatModule] handleOpenURL 結果: %@", result ? "YES" : "NO")
    #endif
    
    return result
  }
  
  @objc
  func handleOpenUniversalLink(_ userActivity: NSUserActivity) -> Bool {
    // 確保在主執行緒上執行
    guard Thread.isMainThread else {
      var result = false
      DispatchQueue.main.sync {
        result = self.handleOpenUniversalLink(userActivity)
      }
      return result
    }
    
    // 使用 delegate 方式處理
    // 由於 WeChatModule 實現了 WXApiDelegate，可以直接傳遞 self
    // 確保實例被正確保留，避免在回調過程中被釋放
    let result = WXApi.handleOpenUniversalLink(userActivity, delegate: self)
    
    #if DEBUG
    print("📱 [WeChatModule] handleOpenUniversalLink 結果: \(result)")
    #else
    NSLog("📱 [WeChatModule] handleOpenUniversalLink 結果: %@", result ? "YES" : "NO")
    #endif
    
    return result
  }
  
  // MARK: - 獲取實例（供 AppDelegate 使用）
  
  @objc
  static func shared() -> WeChatModule? {
    return instance
  }
}

