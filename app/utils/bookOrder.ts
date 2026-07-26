// app/utils/bookOrder.ts
//
// 書籍顯示排序：一律依後端 story-list 的 `order` 欄位（補零字串 "001"、"002"…）由小到大排列。
//
// 為什麼需要這支工具：
//  - 各書籍頁面原本都沒有排序，顯示順序完全依賴 API 回傳的陣列順序（目前剛好等於 id 遞增），
//    後台調整 order 時 App 不會跟著變。這裡把排序規則集中一處，四個書籍頁面共用。
//  - `order` 是「同語系內、跨全站」的編號（每個語系各自從 001 起算），不是每個分類各自編號；
//    分類切分邏輯不受影響，只排每個分類「內部」的書。
//  - 注意：書籍的 `order` 是**字串**（"001"），與 StoryScreen 對白內容的 `order`（數字）是不同東西，
//    不可共用比較邏輯。這裡一律 parseInt 後以數值比較，避免日後後端改成 "10" / 10 造成字串序錯亂。
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { bookDataBaseUrl } from '../config/apiClient';
import { normalizeStoryLang } from '../i18n/i18n';

// 次要排序（同一 order 撞號時）：繁體 → 簡體 → 英文。
// 「我的書籍」不依語系過濾（同一本書的三個語言版本會同時顯示），撞號必然發生，
// 靠此順序讓同一本書的各語言版本相鄰且順序固定。
const LANG_RANK: Record<string, number> = { 'zh-TW': 0, 'zh-CN': 1, en: 2 };

type OrderKey = {
  order?: string | number | null;
  lang?: string | null;
  id?: string | number | null;
};

// "001" → 1；無 order / 無法解析（舊存檔、合成資料）→ Infinity，一律排到最後。
export const parseBookOrder = (raw?: string | number | null): number => {
  const n = Number.parseInt(String(raw ?? '').trim(), 10);
  return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n;
};

// 排序主邏輯：order → 語系（繁/簡/英）→ id（穩定 tiebreaker，避免同 order 同語系時順序漂移）。
const compareOrderKey = (a: OrderKey, b: OrderKey): number => {
  const oa = parseBookOrder(a?.order);
  const ob = parseBookOrder(b?.order);
  if (oa !== ob) return oa - ob;

  const la = LANG_RANK[normalizeStoryLang(a?.lang)] ?? 99;
  const lb = LANG_RANK[normalizeStoryLang(b?.lang)] ?? 99;
  if (la !== lb) return la - lb;

  return Number(a?.id ?? 0) - Number(b?.id ?? 0);
};

// 給「直接來自 story-list 的書籍物件」使用（首頁 Books、我的書籍）。
export const compareBookByOrder = (a: any, b: any): number =>
  compareOrderKey(
    { order: a?.order, lang: a?.lang, id: a?.id },
    { order: b?.order, lang: b?.lang, id: b?.id }
  );

// 給「本機存檔的閱讀紀錄」使用（繼續觀看 finishStory / 再次回味 continueStory）。
//
// 存檔是當時 storyData 的快照：舊使用者的存檔沒有 order 欄位，且後台之後調整 order 也不會回寫存檔。
// 故排序時以「現況 story-list 查到的 order」為準（orderMap），查不到才退回存檔快照裡的 order。
export const makeSavedStoryComparator =
  (orderMap?: Map<number, string> | null) => (a: any, b: any): number =>
    compareOrderKey(
      {
        order: orderMap?.get(Number(a?.storyId)) ?? a?.storyData?.order,
        lang: a?.storyData?.lang ?? a?.lang,
        id: a?.storyId,
      },
      {
        order: orderMap?.get(Number(b?.storyId)) ?? b?.storyData?.order,
        lang: b?.storyData?.lang ?? b?.lang,
        id: b?.storyId,
      }
    );

// 取得「書籍 id → 現況 order」對照表。
// 線上失敗時退回 HomeScreen 寫入的 fullStoryListCache（至少比存檔快照新），
// 兩者皆無則回傳 null → 呼叫端會退回存檔快照裡的 order，不致整頁排序爆掉。
export const fetchStoryOrderMap = async (): Promise<Map<number, string> | null> => {
  const toMap = (rows: any): Map<number, string> | null => {
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const map = new Map<number, string>();
    rows.forEach((row) => {
      const id = Number(row?.id);
      if (!Number.isNaN(id) && row?.order != null) map.set(id, String(row.order));
    });
    return map.size ? map : null;
  };

  try {
    const res = await axios.get(bookDataBaseUrl + 'api/v1/admin/story-list');
    const map = toMap(res?.data);
    if (map) return map;
  } catch (error: any) {
    console.warn('[bookOrder] 取得 story-list 失敗，改用本機快取:', error?.message);
  }

  try {
    const cached = await AsyncStorage.getItem('fullStoryListCache');
    return toMap(cached ? JSON.parse(cached) : null);
  } catch {
    return null;
  }
};
