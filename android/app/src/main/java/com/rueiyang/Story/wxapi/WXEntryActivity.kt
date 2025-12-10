package com.rueiyang.story.wxapi

import android.app.Activity
import android.os.Bundle
import com.wechatlib.WeChatLibModule

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
        // 處理微信回調
        WeChatLibModule.handleIntent(intent)
        // 立即關閉 Activity（因為這是一個透明的回調頁面）
        finish()
    }
}

