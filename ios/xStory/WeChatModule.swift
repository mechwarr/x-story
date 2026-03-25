import Foundation
import React

@objc(WeChatModule)
@objcMembers
final class WeChatModule: RCTEventEmitter, WXApiDelegate {
  private static let universalLink = "https://xstudio-mclub.url.tw/app/"
  private static var sharedInstance: WeChatModule?

  private var appId: String?
  private var authPromises: [String: RCTPromiseResolveBlock] = [:]
  private var authRejecters: [String: RCTPromiseRejectBlock] = [:]
  private var moduleInitialized = false

  override init() {
    super.init()
    Self.sharedInstance = self
  }

  override static func requiresMainQueueSetup() -> Bool {
    true
  }

  override func supportedEvents() -> [String]! {
    ["WeChat_Resp", "WeChatModuleReady"]
  }

  @objc
  func initializeModule(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    if moduleInitialized {
      resolver(true)
      return
    }
    guard bridge != nil else {
      rejecter("BRIDGE_NOT_READY", "React Native Bridge is not ready", nil)
      return
    }
    moduleInitialized = true
    sendEvent(withName: "WeChatModuleReady", body: ["ready": true])
    resolver(true)
  }

  @objc
  func registerApp(_ appId: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    self.appId = appId
    let ok = WXApi.registerApp(appId, universalLink: Self.universalLink)
    if ok {
      resolver(true)
    } else {
      rejecter("REGISTER_ERROR", "Failed to register WeChat app", nil)
    }
  }

  @objc
  func isWXAppInstalled(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    resolver(WXApi.isWXAppInstalled())
  }

  @objc
  func sendAuthRequest(_ scope: String, state: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    guard appId != nil else {
      rejecter("NOT_REGISTERED", "WeChat not registered", nil)
      return
    }
    guard WXApi.isWXAppInstalled() else {
      rejecter("NOT_INSTALLED", "WeChat app not installed", nil)
      return
    }

    let req = SendAuthReq()
    req.scope = scope
    req.state = state.isEmpty ? UUID().uuidString : state

    authPromises[req.state] = resolver
    authRejecters[req.state] = rejecter
    WXApi.send(req)
  }

  func onReq(_ req: BaseReq?) {}

  func onResp(_ resp: BaseResp?) {
    guard let resp else { return }
    let handle: () -> Void = { [weak self] in
      guard let self else { return }
      self.handleResponse(resp)
    }
    if Thread.isMainThread {
      handle()
    } else {
      DispatchQueue.main.async(execute: handle)
    }
  }

  private func handleResponse(_ resp: BaseResp) {
    var result: [String: Any] = [
      "errCode": resp.errCode,
      "errStr": resp.errStr ?? "",
      "type": resp.type,
    ]

    var state: String?
    if let authResp = resp as? SendAuthResp {
      state = authResp.state
      result["state"] = authResp.state ?? ""
      if resp.errCode == WXSuccess.rawValue {
        result["code"] = authResp.code ?? ""
        result["lang"] = authResp.lang ?? ""
        result["country"] = authResp.country ?? ""
      }
    }

    sendEvent(withName: "WeChat_Resp", body: result)

    guard let requestState = state ?? authPromises.keys.first else { return }

    if resp.errCode == WXSuccess.rawValue {
      authPromises[requestState]?(result)
    } else if resp.errCode == WXErrCodeUserCancel.rawValue {
      authRejecters[requestState]?("USER_CANCEL", "User cancelled", nil)
    } else {
      authRejecters[requestState]?("AUTH_ERROR", resp.errStr ?? "Unknown error", nil)
    }
    authPromises.removeValue(forKey: requestState)
    authRejecters.removeValue(forKey: requestState)
  }

  @objc
  func handleOpenURL(_ url: URL) -> Bool {
    WXApi.handleOpen(url, delegate: self)
  }

  @objc
  func handleOpenUniversalLink(_ userActivity: NSUserActivity) -> Bool {
    WXApi.handleOpenUniversalLink(userActivity, delegate: self)
  }

  @objc
  static func shared() -> WeChatModule? {
    sharedInstance
  }
}
