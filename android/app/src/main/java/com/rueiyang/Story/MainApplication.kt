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

// ✅ 使用自定義的微信原生模組
import com.rueiyang.story.WeChatPackage

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost = ReactNativeHostWrapper(
    this,
    object : DefaultReactNativeHost(this) {

      // 等同 Java 的 protected List<ReactPackage> getPackages()
      override fun getPackages(): List<ReactPackage> {
        val packages = PackageList(this).packages.toMutableList()
        // ✅ 安全地添加微信原生模組
        try {
          packages.add(WeChatPackage())
          Log.d("MainApplication", "✅ WeChatPackage 已成功添加")
        } catch (e: Exception) {
          Log.e("MainApplication", "❌ 添加 WeChatPackage 失敗: ${e.message}", e)
          e.printStackTrace()
          // 繼續執行，不讓微信模組初始化失敗阻止應用啟動
        }
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

    // Facebook SDK 18：Manifest 已有 ApplicationId/ClientToken 會自動初始化。
    // 僅在尚未初始化時手動設定，避免重複初始化導致閃退（與 build.gradle 鎖定 18.0.2 一致）。
    try {
      if (!FacebookSdk.isInitialized()) {
        val appId = getString(R.string.facebook_app_id)
        val clientToken = getString(R.string.facebook_client_token)
        FacebookSdk.setApplicationId(appId)
        FacebookSdk.setClientToken(clientToken)
        FacebookSdk.sdkInitialize(applicationContext)
      }
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
