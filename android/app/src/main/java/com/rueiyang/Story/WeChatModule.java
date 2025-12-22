package com.rueiyang.story;

import android.app.Activity;
import android.content.Intent;
import android.util.Log;

import com.facebook.react.bridge.ActivityEventListener;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

// 微信 SDK 導入
import com.tencent.mm.opensdk.modelbase.BaseReq;
import com.tencent.mm.opensdk.modelbase.BaseResp;
import com.tencent.mm.opensdk.modelmsg.SendAuth;
import com.tencent.mm.opensdk.openapi.IWXAPI;
import com.tencent.mm.opensdk.openapi.IWXAPIEventHandler;
import com.tencent.mm.opensdk.openapi.WXAPIFactory;

import java.util.HashMap;
import java.util.Map;

/**
 * 微信模組 - 完整實現
 */
public class WeChatModule extends ReactContextBaseJavaModule implements ActivityEventListener, IWXAPIEventHandler {

    private static final String TAG = "WeChatModule";
    private static WeChatModule instance;
    private IWXAPI api;
    private String appId;
    private Promise authPromise;
    private String currentState;

    public WeChatModule(ReactApplicationContext reactContext) {
        super(reactContext);
        reactContext.addActivityEventListener(this);
        instance = this;
        Log.d(TAG, "✅ WeChatModule 已創建，模組名稱: " + getName());
        Log.d(TAG, "   模組將在 React Native 中註冊為: " + getName());
    }

    public static WeChatModule getInstance() {
        return instance;
    }

    @Override
    public String getName() {
        return "WeChat";
    }

    @Override
    public Map<String, Object> getConstants() {
        final Map<String, Object> constants = new HashMap<>();
        constants.put("WXSceneSession", 0);
        constants.put("WXSceneTimeline", 1);
        constants.put("WXSceneFavorite", 2);
        return constants;
    }

    @ReactMethod
    public void registerApp(String appId, Promise promise) {
        this.appId = appId;
        try {
            api = WXAPIFactory.createWXAPI(getReactApplicationContext(), appId, true);
            boolean result = api.registerApp(appId);
            Log.d(TAG, "registerApp result: " + result);
            promise.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "registerApp error: " + e.getMessage(), e);
            promise.reject("REGISTER_ERROR", e.getMessage(), e);
        }
    }

    @ReactMethod
    public void isWXAppInstalled(Promise promise) {
        if (api == null) {
            promise.reject("NOT_REGISTERED", "WeChat API not registered");
            return;
        }
        try {
            boolean installed = api.isWXAppInstalled();
            promise.resolve(installed);
        } catch (Exception e) {
            Log.e(TAG, "isWXAppInstalled error: " + e.getMessage(), e);
            promise.reject("CHECK_ERROR", e.getMessage(), e);
        }
    }

    @ReactMethod
    public void sendAuthRequest(String scope, String state, Promise promise) {
        if (api == null) {
            promise.reject("NOT_REGISTERED", "WeChat API not registered");
            return;
        }
        if (!api.isWXAppInstalled()) {
            promise.reject("NOT_INSTALLED", "WeChat app not installed");
            return;
        }

        try {
            this.authPromise = promise;
            this.currentState = state;

            SendAuth.Req req = new SendAuth.Req();
            req.scope = scope;
            req.state = state != null ? state : "";

            boolean result = api.sendReq(req);
            if (!result) {
                authPromise = null;
                promise.reject("SEND_ERROR", "Failed to send auth request");
            }
        } catch (Exception e) {
            Log.e(TAG, "sendAuthRequest error: " + e.getMessage(), e);
            authPromise = null;
            promise.reject("SEND_ERROR", e.getMessage(), e);
        }
    }

    @Override
    public void onActivityResult(Activity activity, int requestCode, int resultCode, Intent data) {
        // 微信 SDK 會通過 onNewIntent 處理，這裡不需要處理
    }

    @Override
    public void onNewIntent(Intent intent) {
        // 微信回調會通過 WXEntryActivity 處理
    }

    public void handleIntent(Intent intent) {
        if (api != null) {
            api.handleIntent(intent, this);
        }
    }

    // 實現 IWXAPIEventHandler 接口
    @Override
    public void onReq(BaseReq req) {
        // 處理微信請求
        Log.d(TAG, "onReq: " + req.getType());
    }

    @Override
    public void onResp(BaseResp resp) {
        Log.d(TAG, "onResp: errCode=" + resp.errCode + ", type=" + resp.getType());

        WritableMap result = Arguments.createMap();
        result.putInt("errCode", resp.errCode);
        result.putString("errStr", resp.errStr);
        result.putInt("type", resp.getType());

        if (resp.getType() == 1) { // SendAuth.Resp
            SendAuth.Resp authResp = (SendAuth.Resp) resp;
            if (resp.errCode == BaseResp.ErrCode.ERR_OK) {
                result.putString("code", authResp.code);
                result.putString("state", authResp.state);
                result.putString("url", authResp.url);
                result.putString("lang", authResp.lang);
                result.putString("country", authResp.country);
            }
        }

        // 發送事件到 JS
        getReactApplicationContext()
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit("WeChat_Resp", result);

        // 處理 Promise
        if (authPromise != null) {
            if (resp.errCode == BaseResp.ErrCode.ERR_OK) {
                if (resp.getType() == 1) { // SendAuth.Resp
                    SendAuth.Resp authResp = (SendAuth.Resp) resp;
                    WritableMap promiseResult = Arguments.createMap();
                    promiseResult.putString("code", authResp.code);
                    promiseResult.putString("state", authResp.state);
                    promiseResult.putString("url", authResp.url);
                    promiseResult.putString("lang", authResp.lang);
                    promiseResult.putString("country", authResp.country);
                    authPromise.resolve(promiseResult);
                } else {
                    authPromise.resolve(result);
                }
            } else if (resp.errCode == BaseResp.ErrCode.ERR_USER_CANCEL) {
                authPromise.reject("USER_CANCEL", "User cancelled");
            } else {
                authPromise.reject("AUTH_ERROR", resp.errStr != null ? resp.errStr : "Unknown error");
            }
            authPromise = null;
        }
    }
}
