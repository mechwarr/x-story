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

export function canAccessChapter({ freeOpen, isBookPurchased }) {
  return freeOpen === '開放' || Boolean(isBookPurchased);
}
