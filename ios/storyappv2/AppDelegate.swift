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
    // 使用 Objective-C 運行時動態調用，避免編譯時找不到類
    if url.scheme == "wx277826ce3d9510c6" {
      if let weChatModuleClass = NSClassFromString("WeChatModule") as? NSObject.Type {
        // 調用 shared() 方法
        let sharedSelector = NSSelectorFromString("shared")
        if weChatModuleClass.responds(to: sharedSelector) {
          if let sharedMethod = weChatModuleClass.perform(sharedSelector) {
            if let weChatModule = sharedMethod.takeUnretainedValue() as? NSObject {
              // 調用 handleOpenURL: 方法
              let handleSelector = NSSelectorFromString("handleOpenURL:")
              if weChatModule.responds(to: handleSelector) {
                if let handleMethod = weChatModule.perform(handleSelector, with: url) {
                  if let result = handleMethod.takeUnretainedValue() as? Bool, result {
                    return true
                  }
                }
              }
            }
          }
        }
      }
    }
    
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    // 處理 WeChat Universal Links
    // 使用 Objective-C 運行時動態調用，避免編譯時找不到類
    if let weChatModuleClass = NSClassFromString("WeChatModule") as? NSObject.Type {
      // 調用 shared() 方法
      let sharedSelector = NSSelectorFromString("shared")
      if weChatModuleClass.responds(to: sharedSelector) {
        if let sharedMethod = weChatModuleClass.perform(sharedSelector) {
          if let weChatModule = sharedMethod.takeUnretainedValue() as? NSObject {
            // 調用 handleOpenUniversalLink: 方法
            let handleSelector = NSSelectorFromString("handleOpenUniversalLink:")
            if weChatModule.responds(to: handleSelector) {
              if let handleMethod = weChatModule.perform(handleSelector, with: userActivity) {
                if let result = handleMethod.takeUnretainedValue() as? Bool, result {
                  return true
                }
              }
            }
          }
        }
      }
    }
    
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
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
