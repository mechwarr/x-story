# accessToken 登出後是否移除、換帳號是否覆蓋 — 分析

## 你的疑問
是否可能因為 **accessToken 登出後沒有被移除**，或 **換帳號登入沒有覆蓋**，導致 **call API 時仍用上一位的 token**，所以看到上一位的資料？

---

## 結論：從程式碼看，token 有被清除也有被覆蓋，API 每次請求都重新讀 token

也就是說，「登出沒清掉 / 登入沒覆蓋 → API 一直用舊 token」這條路在目前實作下**較不可能**是主因；比較可能仍是 **畫面上的 state / 焦點載入時機**（例如我們已改的 Profile 用 `useFocusEffect`、金幣用 `coinResetRef`）。

以下為依據程式碼的整理與可選驗證方式。

---

## 1. 登出時 accessToken 是否有移除？

有。

- 登出流程會呼叫 `clearAllUserData()`，裡面會呼叫 `tokenStorage.clearLoginData()`。
- `clearLoginData()` 會執行：
  - `removeToken()` → `SecureStore.deleteItemAsync(TOKEN_KEY)`（`TOKEN_KEY = "authToken"`）
  - 以及 refreshToken、loginTime、lastRefreshTime 的刪除。
- 因此登出後，**authToken（accessToken）會被從 SecureStore 移除**。

程式路徑：

- `_layout.tsx` 的 `logout()` → `clearAllUserData()` → `clearUserDataService.ts` → `tokenStorage.clearLoginData()` → `Storage.ts` 的 `removeToken()`。

---

## 2. 換帳號登入時是否有覆蓋？

有。

- 所有第三方 / Email 登入成功後，都會呼叫 `tokenStorage.saveLoginData({ accessToken, refreshToken })`。
- `saveLoginData()` 會呼叫 `setStoreToken(tokens.accessToken)`，也就是對**同一個 key** `TOKEN_KEY = "authToken"` 做 `SecureStore.setItemAsync(TOKEN_KEY, token)`。
- 登出後 SecureStore 裡已沒有舊的 authToken，新登入會寫入新的 token；若因任何理由舊 token 還在，同一 key 的 `setItemAsync` 也會**覆蓋**成新 token。

且登入流程中都是 **先 `await tokenStorage.saveLoginData(...)`，再呼叫 `handleLoginSuccess()`**（再 `setIsLoggedIn(true)`），因此**導向主畫面時，新 token 理論上已寫入完成**。

---

## 3. Call API 時拿的是哪一個 token？

每次請求都是**當下從 SecureStore 讀取**，沒有在 app 內做「token 快取」或「共用一份舊 token」。

- `userApiClient.ts`（以及其他使用 token 的 API）在要打 API 時都會：
  - `const token = await tokenStorage.getToken();`
  - 再組 `headers['Authorization'] = 'Bearer ' + token` 傳給當次請求。
- `getToken()` 實作是：`return await SecureStore.getItemAsync(TOKEN_KEY);`，**沒有**在記憶體裡 cache token。
- `RestfulApi` 也沒有在 instance 上保存 Authorization header，每次 `get/post/...` 都是當次傳入的 `headers`。

因此：
- 登出後：SecureStore 已刪除 authToken，之後的 `getToken()` 會是 `null`。
- 新帳號登入並 `await saveLoginData(...)` 之後：之後的 `getToken()` 會是新 token。
- 所以「call API 一直用上一位的 token」只有在「登出沒清掉」或「新登入沒覆蓋」時才會發生，而目前程式碼顯示兩者都有做。

---

## 4. 可能造成「像用舊 token」的邊界情況（僅供排查）

1. **登出沒跑完 / 沒跑到 clear**  
   若某條登出路徑沒有呼叫 `clearAllUserData()`（或沒 await），理論上會殘留舊 token；目前我們已補齊各登出路徑並在登出前做金幣重置與 clear，這部分已一致。

2. **saveLoginData 失敗但仍導向主畫面**  
   `saveLoginData` 內是 try/catch 只 log、不 throw，若 `setStoreToken` 失敗，仍會執行 `handleLoginSuccess()`。此時：
   - 若先前登出有清掉 token → SecureStore 無 token，API 會拿到 `null`，較會是 401/錯誤，而不是「顯示上一位資料」。
   - 若先前登出沒清掉（例如該路徑漏掉 clear）→ 才會出現「仍用舊 token、看到上一位資料」；這又回到要確保每條登出都做 clear。

3. **Deep link 的 reset-password token 寫入同一個 key**  
   `_layout.tsx` 裡有 `useEffect` 在 `token` state 變化時呼叫 `tokenStorage.setStoreToken(token)`，而該 `token` 來自重設密碼 deep link 的 query。也就是說，若使用者點擊「重設密碼」連結，會把**密碼重設用 token** 寫進 **authToken** 的 key，暫時覆蓋或污染登入用 token。這和「登出後換帳號」無直接關係，但若在登入前後有開過重設密碼連結，有可能造成短暫 token 錯亂；若要嚴謹可考慮用不同 key 或不同 storage 存 reset token。

---

## 5. 建議驗證方式（可選）

若要在裝置上**直接驗證**「登出有清、登入有蓋、API 拿的是新 token」，可在現有流程加一點 log（僅建議，不一定要上線）：

- **登出後**（在 `clearAllUserData()` 之後）：  
  `const t = await tokenStorage.getToken(); console.log('[DEBUG] 登出後 getToken:', t ? '有值' : 'null');`
- **登入成功並 saveLoginData 之後**（在 `handleLoginSuccess()` 之前）：  
  `const t = await tokenStorage.getToken(); console.log('[DEBUG] 登入後 getToken 前幾字:', t?.substring(0, 20));`  
  比對是否與後端回傳的 accessToken 前幾字一致。

這樣可以確認：  
- 登出後讀到的是 null；  
- 登入後讀到的是新 token；  
- 之後 call API 時用的就是這次讀到的那個 token（因為沒有別處 cache）。

---

## 6. 總結表

| 項目 | 是否有做 | 說明 |
|------|----------|------|
| 登出時移除 accessToken | 有 | `clearLoginData()` → `removeToken()` → `SecureStore.deleteItemAsync(TOKEN_KEY)` |
| 登入時寫入（覆蓋）accessToken | 有 | `saveLoginData()` → `setStoreToken(accessToken)`，且先 await 再導向主畫面 |
| API 是否每次從 Storage 讀 token | 是 | `getToken()` 每次 `SecureStore.getItemAsync(TOKEN_KEY)`，無記憶體快取 |
| 是否可能因 token 沒清/沒蓋而一直用上一位？ | 依目前程式較不可能 | 有清、有蓋、每次請求都重新讀；若仍見舊資料，較可能來自畫面 state / 載入時機，而非「API 一直用舊 token」 |

若你願意，我可以再根據你實際遇到的操作步驟（例如：先按登出再換帳號、或權限過期後換帳號）對應到具體程式路徑，幫你加一兩行上述驗證 log 的位置與範例程式碼。
