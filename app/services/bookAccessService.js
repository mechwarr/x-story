import AsyncStorage from '@react-native-async-storage/async-storage';
import storage from '../storage/storage';
import {
  getAllEntitlements,
  invalidateEntitlementsCache,
  getBookstoreList,
  getCoinLedgerOrNull,
} from '../config/userApiClient';
import { buildBookCatalog, resolveRefundedBookIds } from './refundedBooks';

const normalizeStoryId = (value) => Number(value);

const uniqueIds = (ids) =>
  Array.from(
    new Set(
      ids
        .map(normalizeStoryId)
        .filter((id) => Number.isFinite(id))
    )
  );

/**
 * 權威清單回來後更新本機快取（持有清單取不到時的退路）：
 *  - 移除已收回的書（被移除書單／撤銷授權）。快取若只增不減，收回的書會在下一次查不到時
 *    退回快取而又變成可讀。連續兩次權威清單都缺少才移除，與 resolveBookOwnership「未持有須再
 *    確認一次」同一原則：剛購買、後端短暫還沒寫入時只會記一次缺少，下一次查到就清掉。
 *  - 補入伺服器清單上的書（別台裝置購買、後台贈書），離線時同樣認得。
 * localBefore 是送出請求「之前」的快取：請求期間才寫入的（例如這時剛買的書）不參與比對。
 */
async function updateLocalPurchasedIds(localBefore, remoteIds) {
  const remote = new Set(remoteIds);
  const missingNow = localBefore.filter((id) => !remote.has(id));
  const missingBefore = new Set(uniqueIds(await storage.getLocalPurchasedMissingIds()));
  const revoked = new Set(missingNow.filter((id) => missingBefore.has(id)));
  if (revoked.size) {
    console.warn('[bookAccessService] 連續兩次不在權威清單內，自本機快取移除：', [...revoked]);
  }
  await storage.setLocalPurchasedMissingIds(missingNow.filter((id) => !revoked.has(id)));

  const current = uniqueIds(await storage.getLocalPurchasedStoryIds());
  await storage.setLocalPurchasedStoryIds(
    uniqueIds([...current.filter((id) => !revoked.has(id)), ...remoteIds])
  );
}

/** 權威持有清單：{ ids, items }，items 為後端原始已購項目（含購買時間，供已退款比對） */
async function fetchAuthoritativeEntitlements() {
  const localBefore = uniqueIds(await storage.getLocalPurchasedStoryIds());
  await invalidateEntitlementsCache();

  // 翻頁交給 getAllEntitlements（以後端 total 判斷是否還有下一頁，不受後端每頁上限影響）。
  const { items, failed, total, pages, errorMessage } = await getAllEntitlements();
  // 取不到（網路異常／逾時／非 2xx／格式不正確／清單不完整）：必須拋出，讓呼叫端的 catch 走
  // 「未知」分支（退回本地快取／fail-open）；否則「取不到」會被當成「一本都沒買」，
  // 付費書全部被判未持有而遭閘門誤擋。
  if (failed) {
    throw new Error(errorMessage || 'entitlements 取得失敗（狀態未知）');
  }
  const ids = uniqueIds(
    items.filter((item) => item?.storyListId !== undefined).map((item) => item.storyListId)
  );
  console.log('[bookAccessService] 權威持有清單 →', { count: ids.length, total, pages });
  await updateLocalPurchasedIds(localBefore, ids);
  return { ids, items };
}

/** 以伺服器清單更新本機快取後回傳快取（取不到時原樣回傳快取） */
export async function syncPurchasedStoryIds() {
  try {
    await fetchAuthoritativeEntitlements();
  } catch (error) {
    console.warn('[bookAccessService] 同步已購買書籍失敗，改用本地快取:', error);
  }
  return uniqueIds(await storage.getLocalPurchasedStoryIds());
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
 * 本機快取只是取不到時的退路（含剛買、伺服器清單可能還沒反映的書），閘門判斷一律用本函式：
 *  - 線上取得成功 → 回傳伺服器目前的持有集合（可反映撤銷，需求 10）。
 *  - 線上失敗（離線／錯誤）→ 退回本地快取，避免誤擋合法持有者。
 */
export async function getAuthoritativeOwnedStoryIds() {
  return (await resolveOwnedStoryIds()).ids;
}

/**
 * 同 getAuthoritativeOwnedStoryIds，但額外回報「這份清單是否為權威結果」：
 *  - { ids, items, authoritative: true }  → 伺服器回覆成功，ids 即目前實際持有（可反映撤銷授權），
 *    items 為後端原始已購項目（含購買時間）。
 *  - { ids, items: null, authoritative: false, errorMessage } → 取不到（離線／逾時／錯誤），
 *    ids 只是本地樂觀快取，「不在 ids 內」不代表未持有，errorMessage 為失敗內容。
 *    閱讀閘門遇此情形應 fail-open（不誤擋），與「在架清單取不到就不誤擋」的既有原則一致；
 *    例外：Book.canContinueOwned 的付費書改為擋下並提示 errorMessage。
 */
export async function resolveOwnedStoryIds() {
  try {
    return { ...(await fetchAuthoritativeEntitlements()), authoritative: true };
  } catch (error) {
    console.warn('[bookAccessService] 取得權威持有清單失敗，退回本地快取（狀態未知）:', error);
    return {
      ids: uniqueIds(await storage.getLocalPurchasedStoryIds()),
      items: null,
      authoritative: false,
      errorMessage: error?.message,
    };
  }
}

/**
 * 已退款判定用的定價目錄（只當配對時的價格佐證）：先用首頁存的書店快照，沒有才即時查。
 */
async function loadBookCatalog() {
  try {
    const raw = await AsyncStorage.getItem('bookstoreList');
    const cached = raw ? JSON.parse(raw) : null;
    if (Array.isArray(cached) && cached.length > 0) return buildBookCatalog(cached);
  } catch (_e) {
    // 快照壞掉就改即時查
  }
  return buildBookCatalog((await getBookstoreList()) ?? []);
}

/**
 * 這本書是否被 CMS 書單「移除」標註為已退款（判定同 CMS 書單頁，見 services/refundedBooks）。
 * CMS 移除不會收回 entitlements，只寫一筆 `[已退款] … ORDER:n` 流水，故持有清單仍含此書，
 * 閱讀閘門須另外比對帳本才擋得住。
 * 回傳 true／false；帳本或已購項目取不到時回 null（無法判定）。
 */
async function isRefundedBook(storyId, entitlementItems) {
  if (!Array.isArray(entitlementItems)) return null;
  const ledger = await getCoinLedgerOrNull();
  if (!Array.isArray(ledger)) return null;
  const refundedIds = resolveRefundedBookIds({
    ledgerItems: ledger,
    entitlements: entitlementItems,
    bookCatalog: await loadBookCatalog(),
  });
  return refundedIds.has(storyId);
}

/** 自本機已購快取移除單本書：避免之後持有清單取不到時退回快取，又把已退款的書當成持有 */
async function dropLocalPurchasedId(storyId) {
  const current = uniqueIds(await storage.getLocalPurchasedStoryIds());
  if (current.includes(storyId)) {
    await storage.setLocalPurchasedStoryIds(current.filter((id) => id !== storyId));
  }
}

/**
 * 確認「單一本書」的持有狀態（閱讀閘門用）。權威結果為「未持有」時再查一次才採信：
 * 「未持有」會把付費用戶擋在門外（跳授權失效、閱讀中上鎖），代價遠高於多一次請求，
 * 故排除後端剛寫入／短暫不一致造成的單次誤判。
 * 權威清單含此書時，再比對帳本是否已被 CMS 標註為已退款：已退款一律視為未持有
 *（所有呼叫端——繼續觀看、再次回味、章節列表、故事頁——因此都會把付費內容鎖住）。
 * 帳本取不到（無法判定退款）時照常視為持有，不誤擋。
 * 回傳 { owned, refunded, ids, authoritative }，ids／authoritative 語意同 resolveOwnedStoryIds；
 * 已退款時 ids 也不含此書，只看 ids 的呼叫端（ChapterScreen）同樣會上鎖。
 */
export async function resolveBookOwnership(storyId) {
  const id = normalizeStoryId(storyId);
  let result = await resolveOwnedStoryIds();
  if (result.authoritative && !result.ids.includes(id)) {
    console.warn('[bookAccessService] 權威清單未含此書，再確認一次：', id);
    const confirm = await resolveOwnedStoryIds();
    // 再確認取不到（狀態未知）時沿用第一次的權威結果：「查不到」不能推翻已確認的「未持有」，
    // 否則會退回本機快取，讓已收回的書又能讀。
    if (confirm.authoritative) result = confirm;
    else console.warn('[bookAccessService] 再確認取不到，沿用權威結果（未持有）：', id);
  }

  let refunded = false;
  if (result.authoritative && result.ids.includes(id)) {
    const refundState = await isRefundedBook(id, result.items);
    if (refundState === true) {
      refunded = true;
      console.warn('[bookAccessService] 此書已被標註為已退款，視為未持有：', id);
      await dropLocalPurchasedId(id);
    } else if (refundState === null) {
      console.warn('[bookAccessService] 帳本取不到，無法判定是否已退款，照常視為持有：', id);
    }
  }

  const ids = refunded ? result.ids.filter((x) => x !== id) : result.ids;
  return { ...result, ids, refunded, owned: ids.includes(id) };
}
