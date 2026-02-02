# 金幣餘額 log 在轉場時被呼叫多次的原因分析

## 兩則 log 的來源

| Log 內容 | 出處 |
|----------|------|
| `✓ 成功獲取用戶金幣餘額:', { balance: 545 }` | `userApiClient.ts` 的 `getUserCoinBalance()` |
| `✓ 從 API 刷新金幣餘額:', 545` | `coinContext.tsx` 的 `loadCoinsFromAPI()`（內部呼叫 `getUserCoinBalance()` 後打這行 log） |

也就是說：**只要有人呼叫 `refreshCoins()`，就會先觸發 userApiClient 的 log，再觸發 coinContext 的 log**（一組兩次）。

---

## 為什麼轉場時會「呼叫那麼多次」？

### 1. 多個畫面在 focus 時都呼叫 `refreshCoins()`

以下畫面在 **獲得焦點** 時都會呼叫 `refreshCoins()`（即打 API + 上述兩則 log）：

- **ProfileScreen**：`useFocusEffect` → `refreshCoins()`
- **ShopScreen**：`useFocusEffect` → `refreshCoins()`

轉場時（例如從首頁 → 設定區 → Profile，或切到 Shop 再切回來），每次「該畫面獲得焦點」就會觸發一次，所以 **一次轉場可能觸發 1～2 次**（依經過哪些畫面而定）。

---

### 2. AppHeader 的 `useEffect` 依賴未穩定的 `refreshCoins`（主要放大因素）

**AppHeader.js**（有 AppHeader 的畫面如 SettingTopTabNavigator）內有：

```javascript
useEffect(() => {
  refreshCoins();
}, [refreshCoins]);
```

而 **CoinProvider 裡的 `refreshCoins` 沒有用 `useCallback` 包住**，代表：

- 每次 `CoinProvider` 重新 render，都會產生一個**新的** `refreshCoins` 函式參考。
- `refreshCoins()` 會呼叫 `loadCoinsFromAPI()` → `getUserCoinBalance()` → `setCoinsState(balance)`。
- `setCoinsState` 會讓 **CoinProvider 再 re-render** → 又產生新的 `refreshCoins`。
- AppHeader 的 `useEffect` 依賴 `[refreshCoins]`，參考一變就再跑一次 → 又呼叫 `refreshCoins()`。

結果是：**只要有一次 `refreshCoins()` 被呼叫（例如某個畫面的 useFocusEffect），就會觸發 setState → re-render → 新的 refreshCoins → AppHeader 的 effect 再跑 → 再打一次 API**，形成連鎖，所以 **同一段轉場內會看到多組「成功獲取用戶金幣餘額 + 從 API 刷新金幣餘額」**。

---

### 3. CoinHistoryScreen 自己又打了一次餘額 API

**CoinHistoryScreen** 的 `fetchData()` 會直接呼叫：

- `getUserCoinBalance()`  
- `getCoinLedger()`

所以進入金幣紀錄畫面時，**至少會再多一次**「成功獲取用戶金幣餘額」（這支只會出現在 userApiClient，不會出現 coinContext 的「從 API 刷新金幣餘額」，因為這裡沒有呼叫 `refreshCoins()`）。

若同時又觸發了上面的「AppHeader effect 連鎖」或其它畫面的 `useFocusEffect`，就會和前面幾點疊加，看起來像「轉場時被呼叫很多次」。

---

## 總結

| 原因 | 說明 |
|------|------|
| 多處 useFocusEffect 呼叫 refreshCoins | ProfileScreen、ShopScreen 在 focus 時各呼叫一次，轉場經過就會觸發。 |
| refreshCoins 參考不穩定 + AppHeader 依賴它 | CoinProvider 未 memo `refreshCoins`，每次 setState 後 re-render 就換參考，AppHeader 的 `useEffect(..., [refreshCoins])` 因此重複執行，造成一連串重複打 API。 |
| CoinHistoryScreen 獨立打 getUserCoinBalance | 進入金幣紀錄時再多一次餘額請求，與上述行為疊加。 |

**建議後續優化方向**（僅分析，不實作）：

1. 在 **CoinProvider** 用 `useCallback` 包住 `refreshCoins`（依賴可為 `[]`），避免每次 re-render 都換參考，打斷 AppHeader 的連鎖。
2. 視需求調整 **AppHeader**：例如改為「僅 mount 時刷新一次」、或改用 `useFocusEffect` 並謹慎依賴，避免依賴會一直變的 `refreshCoins`。
3. 若希望金幣紀錄畫面的餘額與頂欄一致，可考慮 **CoinHistoryScreen** 改為使用 context 的 `coins` / `refreshCoins()`，避免同一段轉場內多處重複呼叫 `getUserCoinBalance()`。
