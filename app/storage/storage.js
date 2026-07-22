import AsyncStorage from '@react-native-async-storage/async-storage';
import tokenStorage from '../auth/Storage';

// storeKey: continueStory or finishStory
//
// 依帳號隔離：閱讀紀錄（continueStory / finishStory）以「帳號 id」命名空間分開保存，
// 實際鍵為 `${storeKey}@${accountId}`。不同帳號互不可見；同帳號重新登入仍讀回自己的紀錄
// （登出不刪除這些鍵，見 deleteAllStorage）。帳號 id 取自 profile（api/users/me）並快取於
// SecureStore；未登入／取不到時退回裝置層級的匿名命名空間（__anon__），自我修復於下次取得 id。

const READING_KEY_PREFIXES = ['continueStory', 'finishStory'];
const ANON_ACCOUNT_ID = '__anon__';

// 目前帳號 id 的記憶體快取：避免每次讀寫都打 SecureStore／profile。登出時由 resetAccountScope() 清除。
let _cachedAccountId = null;

const resolveAccountId = async () => {
  if (_cachedAccountId) return _cachedAccountId;
  // 1) SecureStore 快取（由 userApiClient.getUserProfile 成功時寫入）
  try {
    const stored = await tokenStorage.getUserId();
    if (stored) {
      _cachedAccountId = String(stored);
      return _cachedAccountId;
    }
  } catch (_e) {
    // 忽略，往下回查
  }
  // 2) 回查 profile 一次並補快取（延遲 require 避免載入順序問題）
  try {
    const { getUserProfile } = require('../config/userApiClient');
    const profile = await getUserProfile();
    const id =
      profile?.id != null ? String(profile.id) : profile?.email ? String(profile.email) : null;
    if (id) {
      _cachedAccountId = id;
      return id;
    }
  } catch (_e) {
    // 忽略，退回匿名命名空間
  }
  return ANON_ACCOUNT_ID;
};

// 一次性搬遷：把舊版「全域鍵」（未分帳號）資料歸給目前帳號的命名空間鍵，再移除全域鍵，
// 避免升級後既有使用者的閱讀進度遺失、也避免舊全域資料被其他帳號沿用。每個 baseKey 每次啟動最多跑一次。
const _migratedBaseKeys = new Set();
const migrateLegacyKey = async (baseKey, namespacedKey) => {
  if (_migratedBaseKeys.has(baseKey)) return;
  _migratedBaseKeys.add(baseKey);
  try {
    const legacy = await AsyncStorage.getItem(baseKey); // 舊全域鍵
    if (legacy == null) return;
    const existing = await AsyncStorage.getItem(namespacedKey);
    if (existing == null) {
      await AsyncStorage.setItem(namespacedKey, legacy); // 舊進度歸給目前帳號
    }
    await AsyncStorage.removeItem(baseKey); // 移除全域鍵，避免再被其他帳號沿用
  } catch (_e) {
    // 搬遷失敗不阻斷正常讀寫
  }
};

// 取得目前帳號下、指定 storeKey 的實際命名空間鍵（並執行一次性舊資料搬遷）。
// 僅在解析到「真實帳號 id」時才搬遷舊全域資料；匿名（網路暫時取不到 id）時不搬遷、
// 更不刪除舊全域鍵，避免把既有進度誤搬到 __anon__ 而讓真實帳號永久讀不到（資料遺失）。
const getNamespacedKey = async (storeKey) => {
  const accountId = await resolveAccountId();
  const namespacedKey = `${storeKey}@${accountId}`;
  if (accountId !== ANON_ACCOUNT_ID) {
    await migrateLegacyKey(storeKey, namespacedKey);
  }
  return namespacedKey;
};

// 登出／換帳號時清掉記憶體中的帳號 id 快取，避免下一位使用者沿用上一帳號命名空間。
const resetAccountScope = () => {
  _cachedAccountId = null;
  _migratedBaseKeys.clear();
};

// continueStory ↔ finishStory 為互斥關係：同一本書同一時間只能屬於其中一邊
// （繼續觀看 / 重新回味不得同時顯示）。以「原始鍵」對應另一清單。
const OPPOSITE_STORE = {
  continueStory: 'finishStory',
  finishStory: 'continueStory',
};

const storeStory = async (story, storeKey) => {
  try {
    const baseKey = storeKey; // 原始鍵（未命名空間化）：供互斥時操作另一清單
    storeKey = await getNamespacedKey(storeKey);
    const value = await AsyncStorage.getItem(storeKey);

    // 是否為「本清單新加入」的一本書：用來決定要不要從另一清單移除，
    // 避免每次更新進度都對另一清單多做一次 I/O。
    let isNewEntry = true;

    // 第一次開啟app的時候會得到空值
    if (!value || value === null) {
      console.log('空值');
      // 如果是空值就存一個array進去
      await AsyncStorage.setItem(storeKey, JSON.stringify([story]));
    } else {
      // 找到故事名稱一樣的index
      let _value = JSON.parse(value);
      const idx = _value?.findIndex((v) => v.storyId === story.storyId);
      // 如果沒找到就是還沒有存這個故事，所以要push
      if (idx === -1) {
        _value.push(story);
      } else {
        _value[idx] = story;
        isNewEntry = false; // 已存在＝只是更新進度，非跨清單搬移
      }

      // console.log(_value);
      // console.log(_value.length);
      await AsyncStorage.setItem(storeKey, JSON.stringify(_value));
    }

    // 互斥維護：一本書「新加入」某清單時，從另一清單移除。
    // 例：讀完（進 finishStory）移出 continueStory；讀完後重開產生新進度（進 continueStory）移出 finishStory。
    if (isNewEntry && OPPOSITE_STORE[baseKey]) {
      await deleteStory({ storyId: story.storyId }, OPPOSITE_STORE[baseKey]);
    }
  } catch (error) {
    console.log(error);
  }
};

const getStorys = async (storeKey) => {
  try {
    storeKey = await getNamespacedKey(storeKey);
    const value = await AsyncStorage.getItem(storeKey);
    // console.log("@@@@@@@", JSON.parse(value));
    return value !== null ? JSON.parse(value) : null;
  } catch (error) {
    console.log(error);
  }
};

const deleteStory = async (story, storeKey) => {
  try {
    storeKey = await getNamespacedKey(storeKey);
    const value = await AsyncStorage.getItem(storeKey);
    if (!value) return; // 清單本就是空的：無事可刪
    // 找到故事名稱一樣的index
    let _value = JSON.parse(value);
    if (!Array.isArray(_value)) return;
    const idx = _value.findIndex((v) => v.storyId === story.storyId);

    // 不在清單中（idx === -1）：直接返回。
    // 否則 splice(-1, 1) 會誤刪「最後一筆」——這也是互斥維護時可安全對另一清單呼叫本函式的前提。
    if (idx === -1) return;

    // 故事結束，刪除此故事
    _value.splice(idx, 1);

    await AsyncStorage.setItem(storeKey, JSON.stringify(_value));
  } catch (error) {
    console.log(error);
  }
};

// 登出時清除本機資料，但「保留」各帳號的閱讀紀錄（continueStory@* / finishStory@*，以及尚未
// 搬遷的舊全域鍵），讓同帳號重新登入仍能讀回自己的進度（需求：依帳號永久保留）。
// 同時重置帳號命名空間的記憶體快取，避免下一位登入者沿用上一帳號 id。
const deleteAllStorage = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const isReadingKey = (k) =>
      READING_KEY_PREFIXES.some((p) => k === p || k.startsWith(`${p}@`));
    const toRemove = keys.filter((k) => !isReadingKey(k));
    if (toRemove.length) await AsyncStorage.multiRemove(toRemove);
  } catch (error) {
    console.log('[storage] deleteAllStorage 失敗，退回僅清除非閱讀鍵前的保底：', error);
  } finally {
    resetAccountScope();
  }
};

// 本地購買書籍 ID 清單（API 失敗時仍可隱藏購買按鈕）
const LOCAL_PURCHASED_STORY_IDS_KEY = 'localPurchasedStoryIds';

const getLocalPurchasedStoryIds = async () => {
  try {
    const value = await AsyncStorage.getItem(LOCAL_PURCHASED_STORY_IDS_KEY);
    if (!value || value === null) return [];
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.log(error);
    return [];
  }
};

const addLocalPurchasedStoryId = async (storyId) => {
  try {
    const ids = await getLocalPurchasedStoryIds();
    const id = Number(storyId);
    if (Number.isNaN(id) || ids.includes(id)) return;
    ids.push(id);
    await AsyncStorage.setItem(LOCAL_PURCHASED_STORY_IDS_KEY, JSON.stringify(ids));
  } catch (error) {
    console.log(error);
  }
};

export default {
  storeStory,
  getStorys,
  deleteStory,
  deleteAllStorage,
  resetAccountScope,
  getLocalPurchasedStoryIds,
  addLocalPurchasedStoryId,
};
