package com.rueiyang.story;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class WeChatPackage implements ReactPackage {

    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
        List<NativeModule> modules = new ArrayList<>();
        try {
            WeChatModule weChatModule = new WeChatModule(reactContext);
            modules.add(weChatModule);
            android.util.Log.d("WeChatPackage", "✅ WeChatModule 已添加到模組列表");
        } catch (Exception e) {
            android.util.Log.e("WeChatPackage", "❌ 創建 WeChatModule 失敗: " + e.getMessage(), e);
            e.printStackTrace();
        }
        return modules;
    }

    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }
}

