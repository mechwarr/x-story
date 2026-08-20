// app/storage/coinOrderBooks.ts
/**
 * 金幣帳本的「訂單編號 → 書籍 ID」本機對照表。
 *
 * 為什麼需要它：金幣帳本（api/me/coins/ledger）只給 ORDER 編號，已購書籍（api/me/entitlements）
 * 只給 storyListId，兩邊沒有共用 key，所以帳本無法直接得知某筆扣款買的是哪本書。
 * 但「用金幣購買」的 API 回應（api/orders/coin-purchase）同時帶 orderId 與 storyListId——
 * 也就是說對照關係在購買當下是已知事實，只是沒有人留下來。這支模組就是把它留下來。
 *
 * 存取原則：
 * - 依帳號命名空間（沿用 storage 的 getNamespacedKey），不同帳號互不可見。
 * - 登出不清除（見 storage 的 PRESERVED_KEY_PREFIXES）：對照關係只有購買當下拿得到，
 *   清掉之後就再也還原不了，只能退回推測。
 * - 所有操作失敗都不拋出，帳本頁沒有對照表時會自行退回推測配對。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import storage from './storage';

/** 對照表的基礎鍵（實際鍵為 `coinOrderBooks@<accountId>`） */
export const COIN_ORDER_BOOKS_KEY = 'coinOrderBooks';

/** orderId（字串化）→ storyListId */
export type CoinOrderBookMap = Record<string, number>;

export type CoinOrderBookEntry = {
  orderId: number;
  storyListId: number;
};

function toPositiveInt(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

async function getStoreKey(): Promise<string> {
  return storage.getNamespacedKey(COIN_ORDER_BOOKS_KEY);
}

/** 讀取目前帳號的訂單↔書籍對照表；讀取失敗或格式不符時回傳空表 */
export async function getCoinOrderBookMap(): Promise<CoinOrderBookMap> {
  try {
    const raw = await AsyncStorage.getItem(await getStoreKey());
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    const result: CoinOrderBookMap = {};
    for (const [orderId, storyListId] of Object.entries(parsed as Record<string, unknown>)) {
      const order = toPositiveInt(orderId);
      const story = toPositiveInt(storyListId);
      if (order !== null && story !== null) result[String(order)] = story;
    }
    return result;
  } catch (error) {
    console.log('[coinOrderBooks] 讀取對照表失敗:', error);
    return {};
  }
}

/**
 * 批次寫入對照（已存在的 orderId 不覆蓋：先寫入的來自購買當下，可信度高於事後回填）。
 */
export async function recordCoinOrderBooks(entries: CoinOrderBookEntry[]): Promise<void> {
  const valid = entries
    .map((e) => ({ orderId: toPositiveInt(e?.orderId), storyListId: toPositiveInt(e?.storyListId) }))
    .filter((e): e is CoinOrderBookEntry => e.orderId !== null && e.storyListId !== null);
  if (valid.length === 0) return;

  try {
    const storeKey = await getStoreKey();
    const current = await getCoinOrderBookMap();

    let changed = false;
    for (const { orderId, storyListId } of valid) {
      const key = String(orderId);
      if (current[key] === storyListId) continue;
      if (current[key] !== undefined) continue; // 已有對照就不覆蓋
      current[key] = storyListId;
      changed = true;
    }
    if (!changed) return;

    await AsyncStorage.setItem(storeKey, JSON.stringify(current));
  } catch (error) {
    console.log('[coinOrderBooks] 寫入對照表失敗:', error);
  }
}

/**
 * 購買成功後記下一筆對照。呼叫端不需 try/catch——寫入失敗只會讓帳本退回推測配對。
 */
export async function recordCoinOrderBook(
  orderId: unknown,
  storyListId: unknown
): Promise<void> {
  const order = toPositiveInt(orderId);
  const story = toPositiveInt(storyListId);
  if (order === null || story === null) return;
  await recordCoinOrderBooks([{ orderId: order, storyListId: story }]);
}
