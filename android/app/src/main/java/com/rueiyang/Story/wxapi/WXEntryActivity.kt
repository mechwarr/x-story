package com.rueiyang.story.wxapi

import android.app.Activity
import android.os.Bundle
import android.util.Log
import com.rueiyang.story.WeChatModule

/**
 * 微信回調 Activity
 * 
 * 注意：
 * - 必須放在 wxapi 包下
 * - 必須在 AndroidManifest.xml 中註冊
 * - Android 12+ 必須設置 android:exported="true"
 */
class WXEntryActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        try {
            // 使用靜態方法獲取 WeChatModule 實例
            val weChatModule = WeChatModule.getInstance()
            if (weChatModule != null) {
                weChatModule.handleIntent(intent)
                Log.d("WXEntryActivity", "✅ 微信回調已處理")
            } else {
                Log.e("WXEntryActivity", "❌ WeChatModule 實例未找到，可能 React Native 尚未初始化")
                Log.e("WXEntryActivity", "   這通常發生在應用剛啟動時，微信回調可能會丟失")
            }
        } catch (e: Exception) {
            Log.e("WXEntryActivity", "❌ 處理微信回調時發生錯誤: ${e.message}", e)
            e.printStackTrace()
        }
        
        // 立即關閉 Activity（因為這是一個透明的回調頁面）
        finish()
    }
}

