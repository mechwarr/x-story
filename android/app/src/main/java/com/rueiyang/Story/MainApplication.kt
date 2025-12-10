package com.rueiyang.story

import android.app.Application
import android.content.res.Configuration
import android.util.Log

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader

import com.facebook.FacebookSdk
import com.facebook.appevents.AppEventsLogger

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ReactNativeHostWrapper

// ✅ 來自 react-native-wechat-lib
import com.wechatlib.WeChatLibPackage

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost = ReactNativeHostWrapper(
    this,
    object : DefaultReactNativeHost(this) {

      // 等同 Java 的 protected List<ReactPackage> getPackages()
      override fun getPackages(): List<ReactPackage> {
        val packages = PackageList(this).packages.toMutableList()
        packages.add(WeChatLibPackage())   // ← 關鍵：手動加入 wechat-lib
        return packages
      }

      override fun getJSMainModuleName(): String = ".expo/.virtual-metro-entry"
      override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG
      override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
      override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
    }
  )

  override val reactHost: ReactHost
    get() = ReactNativeHostWrapper.createReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()

    try {
      val appId = getString(R.string.facebook_app_id)
      val clientToken = getString(R.string.facebook_client_token)
      Log.e("tag", "appId: $appId")
      Log.e("tag", "clientToken: $clientToken")

      FacebookSdk.setApplicationId(appId)
      FacebookSdk.setClientToken(clientToken)
      FacebookSdk.sdkInitialize(applicationContext)
      AppEventsLogger.activateApp(this)
    } catch (e: Exception) {
      Log.e("MainApplication", "Error initializing Facebook SDK: ${e.message}", e)
      // 繼續執行，不讓 Facebook SDK 初始化失敗阻止應用啟動
    }

    try {
      SoLoader.init(this, OpenSourceMergedSoMapping)
      if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
        load()
      }
      ApplicationLifecycleDispatcher.onApplicationCreate(this)
    } catch (e: Exception) {
      Log.e("MainApplication", "Error initializing SoLoader or New Architecture: ${e.message}", e)
      // 記錄錯誤但不阻止應用啟動
    }
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
