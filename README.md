
### Api

本 App 串接兩個後端：

| 後端 | Base URL | 負責內容 | App 設定 |
| :--- | :--- | :--- | :--- |
| 會員／金流後端 | `http://20.198.216.126:3001/` | 帳號登入、個人資料與權限、書店上架與持有、金幣與內購、閱讀統計 | `portURL`（`app/config/apiClient.ts`），封裝於 `authApiClient.ts`、`userApiClient.ts`、`shopApiClient.ts` |
| 內容後端 | `https://xstoryline.com/` | 故事、章節、場次、角色、故事內容、版面樣式參數、最新消息、關於 | `prodBaseUrl`（`app/config/apiClient.ts`），`apiclient` |

# 會員／金流後端 API

> 來源：Swagger 文件 <http://20.198.216.126:3001/api/docs>（規格 JSON：`/api/docs-json`），API 版本 1.9.15，2026-11-24 同步，共 45 支。
> 後端有異動時以 Swagger 為準，並同步更新本節。

圖例：

- **驗證**：`公開` 不需 token；`🔒` 需帶 `Authorization: Bearer <accessToken>`；`🔒 Admin` 另需 roleLevel ≥ 9（後台用）
- **roleLevel**：1 一般會員、5 小編、9 Admin；≤ 0 視為停權（App 端判定見 `app/config/roles.ts`）
- **參數**：`*` 為必填；`page`／`limit` 為分頁參數
- **App 呼叫**：App 端的封裝函式；`—` 表示僅供後台或伺服器使用，App 未呼叫

## 認證 Auth

App 封裝：`app/config/authApiClient.ts`

| 方法 | 端點 | 驗證 | 用途 | 主要參數 | App 呼叫 |
| :--: | :--- | :--: | :--- | :--- | :--- |
| POST | `/api/auth/register` | 公開 | Email 註冊帳號，成功後寄出驗證信（驗證前無法登入）；Email 已註冊回 401 | `email*`、`password*`、`name`、`birthDate`、`gender`（0 未指定／1 男／2 女） | `registerWithXStory()` |
| POST | `/api/auth/login` | 公開 | Email＋密碼登入，回傳 accessToken／refreshToken；帳密錯誤或尚未驗證信箱回 401 | `email*`、`password*` | `loginWithXStory()` |
| POST | `/api/auth/google-login` | 公開 | Google 登入：以 Google id_token 換取本站 token | `idToken` | `googleLoginWithXStory()` |
| POST | `/api/auth/facebook-login` | 公開 | Facebook 登入（web／Android／iOS 共用）；iOS Limited Login 傳 id_token（JWT） | `token*` | `facebookLoginWithXStory()` |
| POST | `/api/auth/apple-login` | 公開 | Apple 登入：以 Apple 身分令牌換取本站 token | `idToken*` | `appleLoginWithXStory()` |
| POST | `/api/auth/wechat-login` | 公開 | WeChat 登入：以授權 code 換取本站 token | `code*` | `wechatLoginWithXStory()` |
| POST | `/api/auth/refresh` | 公開 | 智慧刷新 access token：剩餘效期不足才換新，否則回傳現有 token；可附舊 accessToken 讓後端加入黑名單 | `refreshToken*`、`accessToken` | `refreshXStoryToken()`（API 收到 401 時自動觸發，見 `app/config/api.ts`） |
| POST | `/api/auth/logout` | 公開 | 登出，將 refresh token（可連同 access token）加入黑名單 | `refreshToken*`、`accessToken` | `logoutWithXStory()` |
| POST | `/api/auth/verify-email` | 公開 | 以驗證信中的 token 完成信箱驗證；連結過期或無效回 401 | `token*` | `VerifyMail()` |
| POST | `/api/auth/resend-verification` | 公開 | 重新寄送信箱驗證信；查無 Email 或已驗證回 401 | `email*` | `resentRegisterMail()` |
| POST | `/api/auth/forgot-password` | 公開 | 寄送重設密碼信；查無 Email 回 401 | `email*` | `forgotXStoryPassword()` |
| POST | `/api/auth/reset-password` | 公開 | 以重設信中的 token 設定新密碼；token 無效或過期回 401 | `token*`、`newPassword*` | `resetXStoryPassword()` |

> ⚠️ Swagger 的 `RegisterDto` 也列出 `roleLevel` 欄位。App 註冊只送 `email`、`password`；後端是否拒絕註冊時自行指定 roleLevel，需向後端確認。

## 會員 Users

App 封裝：`app/config/userApiClient.ts`

| 方法 | 端點 | 驗證 | 用途 | 主要參數 | App 呼叫 |
| :--: | :--- | :--: | :--- | :--- | :--- |
| GET | `/api/users/me` | 🔒 | 取得自己的個人資料（含 roleLevel）；App 也用它重查權限與停權 | — | `getUserProfile()`、`getEffectiveRoleLevel()`、`checkAccountSuspended()`（`suspensionGuard.ts`） |
| PATCH | `/api/users/me` | 🔒 | 更新自己的個人資料；一般會員不可改 roleLevel（403） | `name`、`birthDate`、`gender` | `updateUserProfile()` |
| DELETE | `/api/users/me` | 🔒 | 刪除帳號：硬刪除帳號與其交易紀錄、金幣流水、IAP 收據，不可復原；Admin 可帶 `targetId` 刪除指定帳號 | query `targetId`（限 Admin） | `deleteUserAccount()` |
| GET | `/api/users/all` | 🔒 Admin | 分頁列出所有會員（序號、帳號、生日、性別、註冊方式、權限、建立／更新時間） | `page`、`limit`（預設 10） | — |
| PATCH | `/api/users/{targetId}` | 🔒 Admin | 修改指定會員的個人資料與 roleLevel；會員不存在回 404 | path `targetId*`；`name`、`birthDate`、`gender`、`roleLevel` | — |

## 書店與持有 BookStore

App 封裝：`app/config/userApiClient.ts`

| 方法 | 端點 | 驗證 | 用途 | 主要參數 | App 呼叫 |
| :--: | :--- | :--: | :--- | :--- | :--- |
| GET | `/api/bookstorelist` | 公開 | 書本商店清單（上架中的書籍與金幣售價）；空陣列表示沒有商品 | — | `getBookstoreList()` |
| GET | `/api/me/entitlements` | 🔒 | 我已購買（持有）的書籍；App 以此為持有的權威來源，據以判斷退款或撤銷 | `page`、`limit`（預設 20） | `getEntitlements()`、`getAllEntitlements()` |
| GET | `/api/admin/bookstores` | 🔒 Admin | 全部書本商店設定（含已下架），依建立時間新到舊 | `page`、`limit`（預設 20，上限 100） | `getAdminBookstores()`（已封裝，目前沒有畫面呼叫） |
| POST | `/api/admin/bookstores` | 🔒 Admin | 為書籍建立商店上架設定；每本書限一筆，重複建立回 409 | `bookId*`（StoryLists.id）、`priceCoins*`、`currency`（僅 COIN）、`isActive`、`soldCount` | — |
| PATCH | `/api/admin/bookstores/{id}` | 🔒 Admin | 部分更新商店設定（售價、上下架） | path `id*`（book_store_items.id）；`priceCoins`、`currency`、`isActive` | — |
| DELETE | `/api/admin/bookstores/{id}` | 🔒 Admin | 刪除商店設定，等同將書從商店移除；書籍主表保留 | path `id*`（book_store_items.id） | — |
| GET | `/api/admin/entitlements` | 🔒 Admin | 查詢指定會員持有的書籍 | `userId*`、`page`、`limit`（上限 100） | — |
| DELETE | `/api/admin/users/{userId}/entitlements/{bookId}` | 🔒 Admin | 撤銷會員對某本書的擁有權（硬刪除，寫入審計日誌），用於收回贈書或修正誤操作 | path `userId*`、`bookId*`（story_list_id） | —（App 經 `/api/me/entitlements` 偵測撤銷） |

## 購書與閱讀 Orders／Books

App 封裝：`app/config/userApiClient.ts`

| 方法 | 端點 | 驗證 | 用途 | 主要參數 | App 呼叫 |
| :--: | :--- | :--: | :--- | :--- | :--- |
| POST | `/api/orders/coin-purchase` | 🔒 | 以金幣購買書籍（扣金幣並開通持有） | `storyListId*`（StoryLists.id）、`idempotencyKey*`（防止重送造成重複扣款） | `purchaseStoryWithCoins()` |
| POST | `/api/books/{id}/read` | 🔒 | 記錄一次閱讀：寫入 read_logs，並更新該書的總閱讀次數與不重複讀者數 | path `id*`（StoryLists.id） | `recordBookRead()` |
| GET | `/api/admin/books/analytics` | 🔒 Admin | 各書的閱讀總次數與不重複閱讀人數 | `page`、`limit`（預設 20） | — |

## 活動 Activities

| 方法 | 端點 | 驗證 | 用途 | 主要參數 | App 呼叫 |
| :--: | :--- | :--: | :--- | :--- | :--- |
| POST | `/api/activities/claim-reward` | 🔒 | 領取活動獎勵，每個活動限領一次（重複領取回 400）；目前只有 `PROFILE_COMPLETED`（完善個人資料送金幣） | `activityName*` | `claimActivityReward()`（`userApiClient.ts`） |

## 金幣方案 IAP - Coin Packs

App 封裝：`app/config/shopApiClient.ts`

| 方法 | 端點 | 驗證 | 用途 | 主要參數 | App 呼叫 |
| :--: | :--- | :--: | :--- | :--- | :--- |
| GET | `/api/coin-packs` | 公開 | 上架中的金幣方案（依排序）；App 依 `product_id` 向 App Store／Google Play 查商品名稱與售價 | query `platform`（GOOGLE／APPLE） | `getCoinPacks()`（經 `app/utils/iapCatalog.ts`） |
| POST | `/api/coin-packs` | 🔒 Admin | 建立金幣方案；同平台內 `product_id` 不可重複 | `platform*`、`product_id*`、`name*`、`amount*`（至少 10）、`bonusAmount`、`price*`、`currency`（TWD／USD／JPY）、`is_active` | — |
| PATCH | `/api/coin-packs/{id}` | 🔒 Admin | 更新金幣方案；已有交易的方案只能改 `name`、`is_active`、`sort_order`，`product_id` 一律不可改 | path `id*`；`name`、`is_active`、`sort_order`、`price`、`currency`、`amount`、`bonus_amount`、`platform` | — |
| GET | `/api/admin/coin-packs` | 🔒 Admin | 完整金幣方案清單（含停用），依建立時間新到舊 | `page`、`limit`（預設 20） | — |
| PATCH | `/api/admin/coin-packs/{id}` | 🔒 Admin | 部分更新金幣方案，規則與 `PATCH /api/coin-packs/{id}` 相同 | 同上 | — |

## 內購與金幣帳務 IAP／Coins

| 方法 | 端點 | 驗證 | 用途 | 主要參數 | App 呼叫 |
| :--: | :--- | :--: | :--- | :--- | :--- |
| POST | `/api/iap/verify` | 🔒 | 驗證 Google／Apple 收據並入金：依 `productId` 查 coin_packs 的金幣數（含贈送）寫入帳本 | `platform*`（GOOGLE／APPLE）、`receipt*`（Google 傳 purchaseToken，Apple 傳 base64 收據）、`productId*` | `verifyIAPReceipt()`（`shopApiClient.ts`，由 `iapService.ts` 呼叫） |
| GET | `/api/me/iap-receipts` | 🔒 | 我的 IAP 儲值紀錄（含收據狀態，例如 SUCCESS、REFUNDED） | — | `iapService.ts` |
| GET | `/api/me/coins/balance` | 🔒 | 我的金幣餘額 | — | `getUserCoinBalance()`（`userApiClient.ts`） |
| GET | `/api/me/coins/ledger` | 🔒 | 我的金幣流水（每筆含異動金額、異動後餘額、type、source、時間） | — | `getCoinLedger()`、`getCoinLedgerOrNull()`（`userApiClient.ts`） |
| POST | `/api/iap/webhook/google` | 商店伺服器 | 接收 Google Play 伺服器通知（退款、取消等狀態變更） | — | — |
| POST | `/api/iap/webhook/apple` | 商店伺服器 | 接收 App Store Server Notifications | — | — |
| GET | `/api/admin/iap-receipts` | 🔒 Admin | 查詢指定會員的 IAP 交易紀錄 | `userId*`、`page`、`limit`（上限 100） | — |
| GET | `/api/admin/coins/ledger` | 🔒 Admin | 查詢指定會員的金幣流水 | `userId*`、`page`、`limit`（上限 100） | — |
| PATCH | `/api/admin/iap-receipts/{id}/status` | 🔒 Admin | 將 IAP 收據從 SUCCESS 標記為 REFUNDED（只允許這個轉換，避免重複退款） | path `id*`（iap_receipts.id）；`status*`（REFUNDED） | — |
| PATCH | `/api/admin/coin-ledger/{id}/remark` | 🔒 Admin | 編輯金幣流水的審計備註（最多 255 字，傳空字串可清除） | path `id*`；`remark*` | — |
| POST | `/api/admin/rewards/grant` | 🔒 Admin | 調整會員金幣：正數增加、負數扣除，允許餘額為負，寫入流水（type=ADMIN_GRANT）。用於禮物卡兌換、補償、違規扣款等 | `targetUserId*`、`amount*`、`reason*`（寫入流水 source 供審計） | — |

## 不在 Swagger 的舊端點

`app/config/shopApiClient.ts` 仍留有舊版商店 API 的封裝。Swagger 沒有這些端點（GET 實測回 404），App 也沒有地方呼叫，屬待清除的舊程式碼：

| 方法 | 端點 | 封裝函式 |
| :--: | :--- | :--- |
| GET | `/api/v1/shop/products` | `getProducts()` |
| GET | `/api/v1/shop/balance` | `getUserBalance()` |
| POST | `/api/v1/shop/purchase` | `purchaseProduct()` |
| POST | `/api/v1/shop/verify-purchase` | `verifyPurchase()` |
| GET | `/api/v1/shop/purchase-history` | `getPurchaseHistory()` |

# 內容後端 API（xstoryline.com）

> Base URL `https://xstoryline.com/`，路徑前綴 `api/v1/admin/`。App 只讀取（All 取全部、FindOne 取單筆）。
> 參數類（`menu`、`menu-foolproof`、`setup-*`）一次回傳多個語系的多筆資料，App 以 `pickConfigByLang` 依目前語系挑選，不可直接取第一筆。

| 端點 | 用途 | App 使用處 |
| :--- | :--- | :--- |
| `menu` | 主選單（首頁）版面樣式：背景色、最新消息與故事類別的字級／顏色／粗細 | HomeScreen、ChapterScreen |
| `menu-foolproof` | 主選單點書後的確認視窗樣式 | HomeScreen、MyBooksScreen |
| `setup-story-list` | 故事頁版面樣式：故事名稱、作者、簡介的字級／顏色／粗細 | ChapterScreen、StoryScreen |
| `setup-chapter` | 章節選單樣式：章節簡介與外框 | ChapterScreen |
| `setup-chapter-foolproof` | 章節確認視窗樣式 | ChapterScreen |
| `setup-story-role` | 角色介紹與對話框樣式（主角、男女配角對話框底色） | StoryScreen |
| `setup-story-role-foolproof` | 角色介紹視窗樣式 | StoryScreen |
| `news` | 最新消息內容 | HomeScreen |
| `story-type` | 故事類別 | HomeScreen |
| `story-list` | 故事（書籍）清單：名稱、首圖、作者、類別、售價、是否公開 | HomeScreen、MyBooksScreen、`app/utils/bookOrder.ts` |
| `role/{storyid}` | 指定故事的角色：名稱、性別、簡介、大頭貼 | StoryScreen |
| `chapter/{storyid}` | 分章節故事的章節清單：名稱、簡介、圖片、免費試閱範圍 | Book.js、ChapterScreen、StoryScreen、`startReadingService.js`、`chapterOrder.ts` |
| `nochapter/{storyid}` | 不分章節故事的免費試閱設定 | Book.js、HomeScreen、MyBooksScreen、StoryScreen |
| `screenings/{storyid}/{chapterid}` | 章節內的場次：背景底圖、換場效果、試閱、主角 | StoryScreen、`startReadingService.js`、`chapterOrder.ts` |
| `content/{storyid}/{chapterid}/{screeningid}` | 場次內的故事內容：對話、圖、聲音、影片、選項與連結點 | StoryScreen、`startReadingService.js` |
| `about` | 「關於」頁內容 | VersionScreen（`app/hook/useApi.js`） |
| `member`、`purchasehistory`、`subscriptionrecord` | 舊版會員、購買、訂閱紀錄，已由會員／金流後端取代 | 未使用 |

各端點欄位如下。

## 會員（舊版，App 未使用）

#### 會員清單(/admin/member)

```

All:
https://xstoryline.com/api/v1/admin/member

FindOne:
https://xstoryline.com/api/v1/admin/member/{id}

```

|   項目   | 資料類型 |        欄位        |
| :------: | :------: | :----------------: |
|    id    |  number  | 會員序號(memberID) |
| account  |  string  |        帳號        |
| password |  string  |     出生年月日     |
| birthday |  string  |     出生年月日     |
|   sex    |  string  |        性別        |
| register |  string  |      註冊方式      |
|   role   |  string  |      權限級別      |

#### 購買紀錄(/admin/purchasehistory)

```
All:
https://xstoryline.com/api/v1/admin/purchasehistory

FindOne:
https://xstoryline.com/api/v1/admin/purchasehistory/{memberId}

```

|     項目     | 資料類型 |   欄位   |
| :----------: | :------: | :------: |
|   memberId   |  number  | 會員編號 |
|  order_num   |  number  | 訂單編號 |
|  order_time  |  string  | 訂購時間 |
| product_name |  string  | 商品名稱 |

#### 訂閱紀錄(/admin/subscriptionrecord)

```

All:
https://xstoryline.com/api/v1/admin/subscriptionrecord
FindOne:
https://xstoryline.com/api/v1/admin/subscriptionrecord/{memberId}

```

|      項目      | 資料類型 |     欄位     |
| :------------: | :------: | :----------: |
|    memberId    |  number  |   會員編號   |
|    sub_num     |  number  |   訂閱編號   |
| sub_start_time |  string  | 訂閱開始時間 |
|  sub_end_time  |  string  | 訂閱結束時間 |
|    sub_plan    |  string  |   訂閱方案   |

## 參數管理

#### 主選單(/admin/menu)

```
All:
https://xstoryline.com/api/v1/admin/menu
FindOne:
https://xstoryline.com/api/v1/admin/menu/{id}


```

|       項目        | 資料類型 |     欄位     |
| :---------------: | :------: | :----------: |
|       lang        |  string  |     語系     |
|    view_color     |  string  |   背景底色   |
|  news_font_size   |  number  | 最新消息大小 |
|    news_color     |  string  | 故事類別顏色 |
|    news_weight    |  string  | 故事類別粗細 |
|  story_type_size  |  number  | 故事類別大小 |
| story_type_color  |  string  | 故事類別顏色 |
| story_type_weight |  string  | 故事類別粗細 |

#### 主選單-防呆視窗(/admin/menu-foolproof)

```
All:
https://xstoryline.com/api/v1/admin/menu-foolproof
FindOne:
https://xstoryline.com/api/v1/admin/menu-foolproof/{id}

```

|                  項目                   | 資料類型 |       欄位       |
| :-------------------------------------: | :------: | :--------------: |
|                  lang                   |  string  |       語系       |
|     menu_foolproof_story_name_size      |  number  | 防呆視窗標題大小 |
|    menu_foolproof_story_name_weight     |  string  | 防呆視窗標題粗細 |
|     menu_foolproof_story_name_color     |  string  | 防呆視窗標題顏色 |
|  menu_foolproof_stroy_information_size  |  number  |   故事簡介大小   |
| menu_foolproof_stroy_information_weight |  string  |   故事簡介粗細   |
| menu_foolproof_stroy_information_color  |  string  |   故事簡介顏色   |
|     menu_foolproof_stroy_item1_size     |  number  |  選項 1(左)大小  |
|    menu_foolproof_stroy_item1_weight    |  string  |  選項 1(左)粗細  |
|    menu_foolproof_stroy_item1_color     |  string  |  選項 1(左)顏色  |
|     menu_foolproof_stroy_item2_size     |  number  |  選項 2(右)大小  |
|    menu_foolproof_stroy_item2_weight    |  string  |  選項 2(右)粗細  |
|    menu_foolproof_stroy_item2_color     |  string  |  選項 2(右)顏色  |

#### 故事列表(/admin/setup-story)

```

All:
https://xstoryline.com/api/v1/admin/setup-story-list
FindOne:
https://xstoryline.com/api/v1/admin/setup-story-list/{id}

```

|        項目         | 資料類型 |         欄位         |
| :-----------------: | :------: | :------------------: |
|        lang         |  string  |         語系         |
|        order        |  number  |         順序         |
| main_menu_font_size |  string  | 主選單的故事名稱大小 |
|  main_menu_weight   |  string  | 主選單的故事名稱粗細 |
|   main_menu_color   |  string  | 主選單的故事名稱顏色 |
|   stroy_name_size   |  string  |  故事內故事名称大小  |
|  stroy_name_weight  |  string  |  故事內故事名称粗細  |
|  stroy_name_color   |  string  |  故事內故事名称顏色  |
|     author_size     |  string  |  故事內作者名稱大小  |
|    author_weight    |  string  |  故事內作者名稱粗細  |
|    author_color     |  string  |  故事內作者名稱顏色  |
|  story_infor_size   |  string  |  故事內故事簡介大小  |
| story_infor_weight  |  string  |  故事內故事簡介粗細  |
|  story_infor_color  |  string  |  故事內故事簡介顏色  |

#### (分)章節

```

All:
https://xstoryline.com/api/v1/admin/setup-chapter
FindOne:
https://xstoryline.com/api/v1/admin/setup-chapter/{id}

```

|         項目         | 資料類型 |         欄位         |
| :------------------: | :------: | :------------------: |
|         lang         |  string  |         語系         |
|  chapter_infor_size  |  number  |     章節簡介大小     |
| chapter_infor_weight |  string  |     章節簡介粗細     |
| chapter_infor_color  |  string  |     章節簡介顏色     |
| chapter_outer_color  |  string  | 章節簡介外框的的顏色 |
| chapter_outer_weight |  string  | 章節簡介外框的的粗細 |

#### (分)章節-防呆視窗

```
All:
https://xstoryline.com/api/v1/admin/setup-chapter-foolproof
FindOne:
https://xstoryline.com/api/v1/admin/setup-chapter-foolproof/{id}

```

|                    項目                    | 資料類型 |      欄位      |
| :----------------------------------------: | :------: | :------------: |
|                    lang                    |  string  |      語系      |
|     chapter_foolproof_story_name_size      |  number  |  章節名稱大小  |
|    chapter_foolproof_story_name_weight     |  string  |  章節名稱粗細  |
|     chapter_foolproof_story_name_color     |  string  |  章節名稱顏色  |
|  chapter_foolproof_stroy_information_size  |  number  |  章節簡介大小  |
| chapter_foolproof_stroy_information_weight |  string  |  章節簡介粗細  |
| chapter_foolproof_stroy_information_color  |  string  |  章節簡介顏色  |
|     chapter_foolproof_stroy_item1_size     |  number  | 選項 1(左)大小 |
|    chapter_foolproof_stroy_item1_weight    |  string  | 選項 1(左)粗細 |
|    chapter_foolproof_stroy_item1_color     |  string  | 選項 1(左)顏色 |
|     chapter_foolproof_stroy_item2_size     |  string  | 選項 2(右)大小 |
|    chapter_foolproof_stroy_item2_weight    |  string  | 選項 2(右)粗細 |
|    chapter_foolproof_stroy_item2_color     |  string  | 選項 2(右)顏色 |

#### 故事角色

```
All:
https://xstoryline.com/api/v1/admin/setup-story-role
FindOne:
https://xstoryline.com/api/v1/admin/setup-story-role/{id}

```



|         項目          | 資料類型 |       欄位       |
| :-------------------: | :------: | :--------------: |
|         lang          |  string  |       語系       |
|    role_name_size     |  number  |   人物名稱大小   |
|   role_name_weight    |  string  |   人物名稱粗細   |
|    role_name_color    |  string  |   人物名稱顏色   |
|    role_infor_size    |  number  |   人物簡介大小   |
|   role_infor_weight   |  string  |   人物簡介粗細   |
|   role_infor_color    |  string  |   人物簡介顏色   |
| main_Role_Name_Color  |  string  |  主角對話框底色  |
| boy_Supporting_Color  |  string  | 男配角對話框底色 |
| girl_Supporting_Color |  string  | 女配角對話框底色 |



#### 故事角色 -防呆視窗

```
All:
https://xstoryline.com/api/v1/admin/setup-story-role-foolproof
FindOne:
https://xstoryline.com/api/v1/admin/setup-story-role-foolproof/{id}

```



|         項目          | 資料類型 |       欄位       |
| :-------------------: | :------: | :--------------: |
|         setup_story_role_foolproof_name_size          |  number  |   角色名稱文字大小   |
|    setup_story_role_foolproof_name_weight     |  string  |   角色名稱文字粗細   |
|    setup_story_role_foolproof_name_color     |  string  |   角色名稱文字顏色   |
|    setup_story_role_foolproof_information_size     |  number  |   角色介紹文字大小   |
|    setup_story_role_foolproof_information_weight     |  string  |   角色介紹文字粗細   |
|    setup_story_role_foolproof_information_color     |  string  |   角色介紹文字顏色   |
|    setup_story_role_foolproof_size     |  number  |   視窗按鈕文字大小   |
|    setup_story_role_foolproof_weight     |  string  |   視窗按鈕文字粗細   |
|    setup_story_role_foolproof_color     |  string  |   視窗按鈕文字顏色   |


## 一般內容管理

#### 最新消息管理

```

All:
https://xstoryline.com/api/v1/admin/news

FindOne:
https://xstoryline.com/api/v1/admin/news/{id}

```

|     項目     | 資料類型 |     欄位     |
| :----------: | :------: | :----------: |
|     lang     |  string  |     語系     |
| news_content |   text   | 最新消息內容 |

#### 故事類別

```

All:
https://xstoryline.com/api/v1/admin/story-type
FindOne:
https://xstoryline.com/api/v1/admin/story-type/{id}

```

|    項目    | 資料類型 |   欄位   |
| :--------: | :------: | :------: |
|    lang    |  string  |   語系   |
| story_type |  number  | 故事類別 |

#### 故事列表

```

All:
https://xstoryline.com/api/v1/admin/story-list
FindOne:
https://xstoryline.com/api/v1/admin/story-list/{id}

```

|         項目          | 資料類型 |              欄位              |
| :-------------------: | :------: | :----------------------------: |
|         lang          |  string  |              語系              |
|         order         |  string  |              順序              |
|    main_menu_name     |  string  |        主選單的故事名稱        |
|  main_menu_name_size  |  string  |      主選單的故事名稱大小      |
| main_menu_name_weight |  string  |      主選單的故事名稱粗細      |
| main_menu_name_color  |  string  |      主選單的故事名稱顏色      |
|    main_menu_image    |  string  |        主選單的故事首圖        |
|    main_menu_title    |  string  |        主選單的故事標題        |
|   main_menu_content   |   text   | 故事簡介(主選單防呆視窗的內容) |
|  main_menu_btn_left   |  string  |      主選單防呆視窗選項左      |
|  main_menu_btn_right  |  string  |      主選單防呆視窗選項右      |
|      open_or_off      |  string  |            是否公開            |
|      stroy_name       |  string  |            故事名稱            |
|        author         |  string  |            作者名稱            |
|      story_type       |  string  |            故事類別            |
|         price         |  string  |            單本定價            |
|         open          |  string  |            是否公開            |
|      view_times       |  string  |            觀看次數            |
|       buy_times       |  string  |            購買次數            |

#### 故事角色管理

```

All:
https://xstoryline.com/api/v1/admin/role
FindOne:
https://xstoryline.com/api/v1/admin/role/{storyid}

```

|          項目          | 資料類型 |    欄位    |
| :--------------------: | :------: | :--------: |
|          lang          |  string  |    語系    |
|        storyid         |  string  |  故事編號  |
|       role_name        |  string  |  人物名稱  |
|        role_sex        |  string  |  人物性別  |
|       role_infor       |  string  |  人物簡介  |
|        role_pic        |  string  | 人物大頭貼 |
|  role_foolproof_title  |  string  |    標題    |
| role_foolproof_content |   text   |    按鈕    |

#### (分)章節管理

```

All:
https://xstoryline.com/api/v1/admin/chapter

FindOne:
https://xstoryline.com/api/v1/admin/chapter/{storyid}

```

|        項目         | 資料類型 |       欄位       |
| :-----------------: | :------: | :--------------: |
|        lang         |  string  |       語系       |
|       storyid       |  number  |     故事 id      |
|        order        |  string  |       順序       |
|    chapter_name     |  string  |     章節名稱     |
|  chapter_name_size  |  string  | 章節名稱(大/小)  |
| chapter_name_weight |  string  | 章節名稱(粗/細)  |
| chapter_name_color  |  string  |  章節名稱(顏色)  |
|    chapter_infor    |  string  |     章節簡介     |
|     chapter_img     |  string  |     章節圖片     |
|    window_title     |  string  |   防呆視窗標題   |
|   window_btn_left   |  string  |  防呆視窗選項左  |
|  window_btn_right   |  string  |  防呆視窗選項右  |
|      free_open      |  string  | 是否開放免費試閱 |
|   read_range_end    |  string  | 試閱場次範圍(尾) |

#### (不分)章節管理

```

All:
https://xstoryline.com/api/v1/admin/nochapter

FindOne:
https://xstoryline.com/api/v1/admin/nochapter/{storyid}

```

|      項目      | 資料類型 |       欄位       |
| :------------: | :------: | :--------------: |
|      lang      |  string  |       語系       |
|    storyid     |  number  |     故事編號     |
|   read_free    |  string  | 是否開放免費試閱 |
| read_range_end |  string  | 試閱場次範圍(尾) |

#### 場次管理

```

All:
https://xstoryline.com/api/v1/admin/screenings
FindOne:
https://xstoryline.com/api/v1/admin/screenings/{storyid}/{chapterid}

```

|      項目       | 資料類型 |       欄位       |
| :-------------: | :------: | :--------------: |
|      lang       |  string  |       語系       |
|      order      |  number  |       順序       |
|     storyid     |  string  |     故事編號     |
|    chapterid    |  string  |     章節編號     |
| screenings_name |  string  |     場次名稱     |
|     bg_view     |  string  |     背景底圖     |
|  field_effect   |  string  |     換場效果     |
|    field_sec    |  string  |     換場秒數     |
|    free_read    |  string  | 是否開放免費試閱 |
|    main_role    |  string  |       主角       |

#### 故事內容

```

All:
https://xstoryline.com/api/v1/admin/content

FindOne:
https://xstoryline.com/api/v1/admin/content/{storyid}/{chapterid}/{screeningid}

```

|         項目         | 資料類型 |     欄位      |
| :------------------: | :------: | :-----------: |
|         lang         |  string  |     語系      |
|       storyid        |  number  |    故事 id    |
|      chapterid       |  number  |    章節 id    |
|        order         |  string  |     順序      |
|         role         |  string  |     角色      |
|       roleName       |  string  |   角色名稱    |
|     textContent      |  string  |   文的內容    |
|   textContentSize    |  number  |   文的大小    |
|  textContentWeight   |  string  |   文的粗細    |
|   textContentColor   |  string  |   文的顏色    |
| textContentBaseColor |  string  |   文的底色    |
|        graphy        |  string  |      图       |
|        voice         |  string  |     聲音      |
|        video         |  string  |     影片      |
|     videoFormat      |  string  | 影片顯示方式  |
|    choice1Content    |   text   |  選項 1 內容  |
|     choice1Size      |  number  |  選項 1 大小  |
|    choice1Weight     |  string  |  選項 1 粗細  |
|     choice1Color     |  string  |  選項 1 顏色  |
|   choice1BaseColor   |  string  |  選項 1 底色  |
|     choice1Next      |  string  | 選項 1 連結點 |
|    choice2Content    |  string  |  選項 2 內容  |
|     choice2Size      |  number  |  選項 2 大小  |
|    choice2Weight     |  string  |  選項 2 粗細  |
|     choice2Color     |  string  |  選項 2 顏色  |
|   choice2BaseColor   |  string  |  選項 2 底色  |
|     choice2Next      |  string  | 選項 2 連結點 |
|    choice3Content    |  string  |   選項 內容   |
|     choice3Size      |  number  |  選項 3 大小  |
|    choice3Weight     |  string  |  選項 3 粗細  |
|     choice3Color     |  string  |  選項 3 顏色  |
|   choice3BaseColor   |  string  |  選項 3 底色  |
|     choice3Next      |  string  | 選項 3 連結點 |

## 關於

#### 關於管理

```

https://xstoryline.com/api/v1/admin/about

```

|     項目      | 資料類型 |     欄位     |
| :-----------: | :------: | :----------: |
|     lang      |  string  |     語系     |
| about_content |   text   | 關於管理內容 |

## Author

Michael Huang
