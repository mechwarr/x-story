import Expo
import React
import ReactAppDependencyProvider
// WeChat SDK 通過 Bridging Header 導入，無需在這裡 import

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    // 處理 WeChat 回調
    // 確保在主執行緒上執行，避免記憶體管理問題
    if url.scheme == "wx277826ce3d9510c6" {
      // 使用主執行緒確保執行緒安全
      if Thread.isMainThread {
        return handleWeChatURL(url)
      } else {
        var result = false
        DispatchQueue.main.sync {
          result = handleWeChatURL(url)
        }
        if result {
          return true
        }
      }
    }
    
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }
  
  // 安全的 WeChat URL 處理方法
  private func handleWeChatURL(_ url: URL) -> Bool {
    // 使用更安全的方式獲取 WeChatModule 實例
    guard let weChatModule = WeChatModule.shared() else {
      print("⚠️ [AppDelegate] WeChatModule 實例未找到，可能尚未初始化")
      return false
    }
    
    // 確保 Bridge 已就緒
    guard weChatModule.bridge != nil else {
      print("⚠️ [AppDelegate] React Native Bridge 尚未就緒，延遲處理 URL")
      // 延遲處理，等待 Bridge 就緒
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
        _ = weChatModule.handleOpenURL(url)
      }
      return true // 返回 true 表示已處理（延遲處理）
    }
    
    // 安全地調用 handleOpenURL
    return weChatModule.handleOpenURL(url)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    // 處理 WeChat Universal Links
    // 檢查是否為 WeChat Universal Link
    if userActivity.activityType == NSUserActivityTypeBrowsingWeb,
       let url = userActivity.webpageURL,
       url.absoluteString.contains("xstudio-mclub.url.tw/app/") {
      // 確保在主執行緒上執行
      if Thread.isMainThread {
        if handleWeChatUniversalLink(userActivity) {
          return true
        }
      } else {
        var result = false
        DispatchQueue.main.sync {
          result = handleWeChatUniversalLink(userActivity)
        }
        if result {
          return true
        }
      }
    }
    
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
  
  // 安全的 WeChat Universal Link 處理方法
  private func handleWeChatUniversalLink(_ userActivity: NSUserActivity) -> Bool {
    // 使用更安全的方式獲取 WeChatModule 實例
    guard let weChatModule = WeChatModule.shared() else {
      print("⚠️ [AppDelegate] WeChatModule 實例未找到，可能尚未初始化")
      return false
    }
    
    // 確保 Bridge 已就緒
    guard weChatModule.bridge != nil else {
      print("⚠️ [AppDelegate] React Native Bridge 尚未就緒，延遲處理 Universal Link")
      // 延遲處理，等待 Bridge 就緒
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
        _ = weChatModule.handleOpenUniversalLink(userActivity)
      }
      return true // 返回 true 表示已處理（延遲處理）
    }
    
    // 安全地調用 handleOpenUniversalLink
    return weChatModule.handleOpenUniversalLink(userActivity)
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
