import storage from '../storage/storage';
import { getAllEntitlements, invalidateEntitlementsCache } from '../config/userApiClient';

const normalizeStoryId = (value) => Number(value);

const uniqueIds = (ids) =>
  Array.from(
    new Set(
      ids
        .map(normalizeStoryId)
        .filter((id) => Number.isFinite(id))
    )
  );

async function fetchAllEntitlementStoryIds() {
  await invalidateEntitlementsCache();

  // 翻頁交給 getAllEntitlements（以後端 total 判斷是否還有下一頁，不受後端每頁上限影響）。
  const { items, failed, total, pages } = await getAllEntitlements();
  // 取不到（網路異常／逾時／非 2xx／格式不正確／清單不完整）：必須拋出，讓呼叫端的 catch 走
  // 「未知」分支（退回本地快取／fail-open）；否則「取不到」會被當成「一本都沒買」，
  // 付費書全部被判未持有而遭閘門誤擋。
  if (failed) {
    throw new Error('entitlements 取得失敗（狀態未知）');
  }
  const ids = uniqueIds(
    items.filter((item) => item?.storyListId !== undefined).map((item) => item.storyListId)
  );
  console.log('[bookAccessService] 權威持有清單 →', { count: ids.length, total, pages });
  return ids;
}

export async function syncPurchasedStoryIds() {
  const localIds = uniqueIds(await storage.getLocalPurchasedStoryIds());
  try {
    const remoteIds = await fetchAllEntitlementStoryIds();
    const mergedIds = uniqueIds([...localIds, ...remoteIds]);

    for (const id of mergedIds) {
      await storage.addLocalPurchasedStoryId(id);
    }

    return mergedIds;
  } catch (error) {
    console.warn('[bookAccessService] 同步已購買書籍失敗，改用本地快取:', error);
    return localIds;
  }
}

/**
 * 章節／場次閱讀閘門：可讀 = 預覽者（role>=5）｜試閱開放｜已購買。
 * canPreview 用於小編／管理員：不需購買、不受試閱設定限制即可讀完整內容
 *（含下架、上架、未開放的書；需求 5/6/未開放流程）。
 */
export function canAccessChapter({ freeOpen, isBookPurchased, canPreview = false }) {
  return Boolean(canPreview) || freeOpen === '開放' || Boolean(isBookPurchased);
}

/**
 * 以「伺服器 entitlements」為權威來源取得目前實際持有的 storyId 集合（供閱讀閘門用）。
 * 與 syncPurchasedStoryIds 不同：後者是 本地∪遠端 的聯集並回寫本地（樂觀快取、用於離線隱藏購買鈕），
 * 「只增不減」故無法反映「被移除書單／撤銷授權」。閘門判斷改用本函式：
 *  - 線上取得成功 → 回傳伺服器目前的持有集合（可反映撤銷，需求 10）。
 *  - 線上失敗（離線／錯誤）→ 退回本地快取，避免誤擋合法持有者。
 */
export async function getAuthoritativeOwnedStoryIds() {
  return (await resolveOwnedStoryIds()).ids;
}

/**
 * 同 getAuthoritativeOwnedStoryIds，但額外回報「這份清單是否為權威結果」：
 *  - { ids, authoritative: true }  → 伺服器回覆成功，ids 即目前實際持有（可反映撤銷授權）。
 *  - { ids, authoritative: false } → 取不到（離線／逾時／錯誤），ids 只是本地樂觀快取，
 *    「不在 ids 內」不代表未持有。閱讀閘門遇此情形應 fail-open（不誤擋），
 *    與「在架清單取不到就不誤擋」的既有原則一致。
 */
export async function resolveOwnedStoryIds() {
  try {
    return { ids: await fetchAllEntitlementStoryIds(), authoritative: true };
  } catch (error) {
    console.warn('[bookAccessService] 取得權威持有清單失敗，退回本地快取（狀態未知）:', error);
    return { ids: uniqueIds(await storage.getLocalPurchasedStoryIds()), authoritative: false };
  }
}

/**
 * 確認「單一本書」的持有狀態（閱讀閘門用）。權威結果為「未持有」時再查一次才採信：
 * 「未持有」會把付費用戶擋在門外（跳授權失效、閱讀中上鎖），代價遠高於多一次請求，
 * 故排除後端剛寫入／短暫不一致造成的單次誤判。
 * 回傳 { owned, ids, authoritative }，ids／authoritative 語意同 resolveOwnedStoryIds。
 */
export async function resolveBookOwnership(storyId) {
  const id = normalizeStoryId(storyId);
  let result = await resolveOwnedStoryIds();
  if (result.authoritative && !result.ids.includes(id)) {
    console.warn('[bookAccessService] 權威清單未含此書，再確認一次：', id);
    result = await resolveOwnedStoryIds();
  }
  return { ...result, owned: result.ids.includes(id) };
}
