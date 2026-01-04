# WeChat 登入模組重構說明

## 📋 重構內容

已將原本的 `wechatAuth.js` 重構為平台特定的實現，並保留統一的入口點。

## 📁 文件結構

```
components/utils/
├── wechatAuth.js          ← 統一入口（根據平台自動選擇）
├── wechatAndroidAuth.js   ← Android 專用實現
└── wechatIOSAuth.js       ← iOS 專用實現
```

## 🔄 變更說明

### 1. `wechatAuth.js`（統一入口）

- **功能**：根據 `Platform.OS` 自動選擇使用 Android 或 iOS 實現
- **導出接口**：保持不變，確保現有代碼無需修改
  - `initWeChatSDK()`
  - `isWXAppInstalled()`
  - `wechatLogin()`
  - `addWeChatResponseListener()`

### 2. `wechatAndroidAuth.js`（Android 專用）

- **功能**：僅包含 Android 平台的實現
- **特點**：
  - 添加了平台檢查，確保只在 Android 上執行
  - 所有日誌標記為 `[Android]` 以便區分
  - 保留了原有的所有功能

### 3. `wechatIOSAuth.js`（iOS 專用）

- **功能**：iOS 平台的實現（目前模組尚未實現，會返回適當的錯誤提示）
- **特點**：
  - 添加了平台檢查，確保只在 iOS 上執行
  - 所有日誌標記為 `[iOS]` 以便區分
  - 當原生模組不存在時，會提供清晰的錯誤提示和配置指引

## ✅ 兼容性

**現有代碼無需修改！**

所有現有的導入和使用方式都保持不變：

```javascript
// 這些導入仍然有效
import { wechatLogin } from "../../components/utils/wechatAuth";
import { initWeChatSDK } from '../../components/utils/wechatAuth';
```

## 🎯 使用方式

### 在 Android 上

當在 Android 設備上運行時：
1. `wechatAuth.js` 檢測到 `Platform.OS === 'android'`
2. 自動載入 `wechatAndroidAuth.js`
3. 調用 Android 原生模組實現

### 在 iOS 上

當在 iOS 設備上運行時：
1. `wechatAuth.js` 檢測到 `Platform.OS === 'ios'`
2. 自動載入 `wechatIOSAuth.js`
3. 調用 iOS 原生模組實現（如果已實現）

## 📊 平台檢測流程

```
JavaScript 調用
    ↓
wechatAuth.js (統一入口)
    ↓
Platform.OS 檢測
    ├─→ android → wechatAndroidAuth.js → Android 原生模組
    └─→ ios     → wechatIOSAuth.js     → iOS 原生模組（待實現）
```

## 🔍 日誌標記

為了便於調試，所有日誌都添加了平台標記：

- **Android**：`[Android]` 或 `[wechatAndroidAuth]`
- **iOS**：`[iOS]` 或 `[wechatIOSAuth]`

這樣在查看日誌時可以清楚知道是哪個平台的實現。

## ⚠️ iOS 狀態

目前 iOS 版本會：
- ✅ 正確檢測平台
- ✅ 嘗試查找原生模組
- ⚠️ 如果模組不存在，會返回 `null` 並提供清晰的錯誤提示
- 📝 提供配置指引（參考 `ios/WECHAT_IOS_SETUP.md`）

## 🚀 下一步

當 iOS 原生模組實現後：
1. 實現 `WeChatModule.swift` 或 `.m`
2. 註冊模組到 React Native Bridge
3. `wechatIOSAuth.js` 將自動開始工作，無需修改其他代碼

## 📝 注意事項

1. **不要直接導入平台特定文件**：
   ```javascript
   // ❌ 不建議
   import { wechatLogin } from './wechatAndroidAuth';
   
   // ✅ 正確
   import { wechatLogin } from './wechatAuth';
   ```

2. **統一入口保持接口一致**：
   - 所有平台特定的實現必須導出相同的函數簽名
   - 返回值和錯誤處理應該保持一致

3. **平台檢查**：
   - 平台特定的實現都包含平台檢查
   - 如果錯誤的平台調用，會返回安全的默認值

## 🎉 優勢

1. **代碼分離**：Android 和 iOS 實現完全分離，易於維護
2. **向後兼容**：現有代碼無需修改
3. **清晰調試**：日誌標記讓調試更容易
4. **易於擴展**：未來可以輕鬆添加其他平台的實現
5. **類型安全**：每個平台的文件可以獨立優化

