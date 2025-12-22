# 微信 SDK 設置說明

## ✅ 當前狀態

構建已成功，但微信功能暫時不可用（使用存根實現）。需要按照以下步驟完成設置。

## 📥 步驟 1：下載微信 SDK AAR 文件

### 方法一：從微信開放平台下載（推薦）

1. 前往微信開放平台：https://open.weixin.qq.com/
2. 登入您的開發者帳號
3. 進入「資源中心」→「資源下載」→「Android 資源下載」
4. 下載最新版本的 Android SDK
5. 解壓下載的文件，找到 `wechat-sdk-android-without-mta-6.8.24.aar`（版本號可能不同）

### 方法二：直接下載鏈接

如果無法從開放平台下載，可以嘗試：
- 搜索「微信開放平台 Android SDK 下載」
- 或訪問：https://developers.weixin.qq.com/doc/oplatform/Downloads/Android_Resource.html

## 📁 步驟 2：放置 AAR 文件

將下載的 AAR 文件複製到以下目錄：

```bash
android/app/libs/wechat-sdk-android-without-mta-6.8.24.aar
```

如果 `libs` 目錄不存在，它已經被創建好了。

**注意**：文件名必須與 `build.gradle` 中的配置一致。

## ⚙️ 步驟 3：啟用依賴配置

編輯 `android/app/build.gradle` 文件，找到以下行：

```gradle
// 臨時：先註釋掉，等手動下載 AAR 文件後再啟用
// 請參考 WECHAT_SDK_SETUP.md 文件獲取詳細說明
```

將其改為：

```gradle
// 使用本地 AAR 文件
implementation files('libs/wechat-sdk-android-without-mta-6.8.24.aar')
```

**注意**：如果您的 AAR 文件名不同，請相應修改。

## 🔧 步驟 4：啟用完整代碼實現

編輯 `android/app/src/main/java/com/rueiyang/story/WeChatModule.java`：

### 4.1 取消導入註釋

找到文件開頭的註釋部分，取消以下導入的註釋：

```java
import com.tencent.mm.opensdk.modelbase.BaseReq;
import com.tencent.mm.opensdk.modelbase.BaseResp;
import com.tencent.mm.opensdk.modelmsg.SendAuth;
import com.tencent.mm.opensdk.openapi.IWXAPI;
import com.tencent.mm.opensdk.openapi.IWXAPIEventHandler;
import com.tencent.mm.opensdk.openapi.WXAPIFactory;
```

### 4.2 更新類聲明

將：
```java
public class WeChatModule extends ReactContextBaseJavaModule implements ActivityEventListener {
```

改為：
```java
public class WeChatModule extends ReactContextBaseJavaModule implements ActivityEventListener, IWXAPIEventHandler {
```

### 4.3 取消方法實現的註釋

在以下方法中，取消所有 `/* ... */` 註釋塊中的代碼：
- `registerApp()` 方法
- `isWXAppInstalled()` 方法
- `sendAuthRequest()` 方法
- `handleIntent()` 方法
- `onReq()` 方法（文件末尾）
- `onResp()` 方法（文件末尾）

同時刪除或註釋掉存根實現的代碼（那些返回錯誤的代碼）。

### 4.4 取消變量聲明註釋

找到：
```java
// private IWXAPI api;  // 取消註釋後啟用
```

改為：
```java
private IWXAPI api;
```

## 🏗️ 步驟 5：重新構建項目

完成以上步驟後，重新構建項目：

```bash
cd android
./gradlew clean
./gradlew assembleDebug
```

## ✅ 驗證

構建成功後，微信登入功能應該可以正常使用了。

## 📝 注意事項

1. **版本號**：如果下載的 AAR 文件版本不是 6.8.24，請相應更新 `build.gradle` 中的文件名
2. **包名和簽名**：確保在微信開放平台正確配置了應用的包名和簽名
3. **AppID**：確保 `components/utils/wechatAuth.js` 中的 `WX_APP_ID` 正確
4. **回調 Activity**：`WXEntryActivity` 已經配置好，無需修改

## 🐛 問題排查

如果遇到問題：

1. **構建失敗**：檢查 AAR 文件是否正確放置在 `libs` 目錄
2. **功能不可用**：檢查是否完成了步驟 4 的所有操作
3. **登入失敗**：檢查微信開放平台的配置（包名、簽名、AppID）

## 📚 參考資料

- 微信開放平台：https://open.weixin.qq.com/
- Android SDK 文檔：https://developers.weixin.qq.com/doc/oplatform/Mobile_App/Access_Guide/Android.html
