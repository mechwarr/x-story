import storage from '../storage/storage';
import { getEntitlements, invalidateEntitlementsCache } from '../config/userApiClient';

const ENTITLEMENTS_PAGE_SIZE = 100;

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
  const storyIds = [];
  let page = 1;
  let total = 0;

  await invalidateEntitlementsCache();

  while (true) {
    const res = await getEntitlements(page, ENTITLEMENTS_PAGE_SIZE, { bypassCache: true });
    const items = Array.isArray(res?.items) ? res.items : [];
    for (const item of items) {
      if (item?.storyListId !== undefined) {
        storyIds.push(item.storyListId);
      }
    }

    total = Number(res?.total ?? total ?? 0);
    if (items.length === 0) break;
    if (total > 0 && storyIds.length >= total) break;
    if (items.length < ENTITLEMENTS_PAGE_SIZE) break;
    page += 1;
  }

  return uniqueIds(storyIds);
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
  try {
    return await fetchAllEntitlementStoryIds();
  } catch (error) {
    console.warn('[bookAccessService] 取得權威持有清單失敗，退回本地快取:', error);
    return uniqueIds(await storage.getLocalPurchasedStoryIds());
  }
}
