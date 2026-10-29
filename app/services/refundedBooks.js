import { toEpochMillis as parseServerMillis } from '../utils/datetime';

/**
 * 已退款書籍判定：完全比照 CMS 書單頁（xStore-CMS lib/coinLedgerBookMatch.js 的
 * resolveRefundedBookIds），讓 App 書櫃隱藏的書與 CMS 書單頁顯示「已退款」的書一致。
 *
 * CMS 書單「移除」不刪擁有權，只以 0 金幣「添加獎勵」寫入一筆說明為 `[已退款] {書名} ORDER:n` 的流水。
 * 帳本的書籍購買只有 `ORDER:n`（訂單流水號）、entitlements 只有 storyListId，兩邊沒有共用 key，
 * 所以先以「時間鄰近＋保序」對齊兩張表，找出每筆購買是哪本書，再看該 ORDER 有沒有已退款說明。
 * 對齊門檻、計分、說明格式都與 CMS 相同；任何一邊改動，另一邊要一起改，否則兩邊判定會不一致。
 *
 * 與金幣紀錄頁的書名推導（CoinHistoryScreen.resolveBookNames，本機 orderId 對照＋價格分組）刻意不同：
 * 那份對照表只存在購買的那台裝置上，用它會讓同一帳號在不同裝置、以及與 CMS 的結果不一致。
 */

/** 流水與已購書籍建立時間的最大容許差距，超過即視為不同次購買（同 CMS MATCH_WINDOW_MS） */
const MATCH_WINDOW_MS = 10 * 1000;

/** 對齊分數：配上一筆的基本分遠大於價格佐證，價格佐證又遠大於時間差（秒），確保比較優先順序 */
const SCORE_MATCH = 100000;
const SCORE_PRICE_MATCH = 10000;

/** 書籍購買流水類型 */
const BOOK_PURCHASE_TYPE = 'BOOK_PURCHASE';

/** CMS 書單「移除」寫入的已退款說明開頭 */
const REFUNDED_BOOK_PREFIX = '[已退款]';

function toPositiveInt(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

// 後端時間戳一律 UTC：無時區字樣的字串也當 UTC（CMS 在 UTC 主機上以 new Date 解析，結果相同）
function toEpochMillis(value) {
  if (value == null || value === '') return null;
  return parseServerMillis(typeof value === 'number' ? value : String(value));
}

function pickField(obj, keys) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const key of keys) {
    if (obj[key] != null && obj[key] !== '') return obj[key];
  }
  return undefined;
}

function isBookPurchaseType(type) {
  return String(type || '').trim().toUpperCase() === BOOK_PURCHASE_TYPE;
}

/** 從流水說明取出「數字型」訂單編號（書籍訂單為 ORDER:28；IAP 的 ORDER:GPA.xxx 回 null） */
function parseNumericOrderId(source) {
  const m = String(source == null ? '' : source).match(/ORDER:\s*(\d+)\b/i);
  if (!m) return null;
  return toPositiveInt(m[1]);
}

/** 流水列的原始說明（優先 remark，其次 source），與 CMS 一致 */
function getRawRemark(row) {
  const remark = pickField(row, ['remark', 'Remark', 'note', 'Note']);
  if (remark != null && String(remark).trim() !== '') return String(remark).trim();
  const source = pickField(row, ['source', 'Source']);
  return source == null ? '' : String(source).trim();
}

function isRefundedBookRemark(remark) {
  return String(remark == null ? '' : remark).trim().startsWith(REFUNDED_BOOK_PREFIX);
}

/**
 * 書店清單 → 定價目錄（storyListId → { priceCoins }），只當配對時的價格佐證。
 * @param {Array|null} bookstoreList getBookstoreList 回傳（或首頁存的快照）
 * @returns {Map<string, { priceCoins: number|null }>}
 */
export function buildBookCatalog(bookstoreList) {
  const catalog = new Map();
  for (const item of Array.isArray(bookstoreList) ? bookstoreList : []) {
    if (!item || typeof item !== 'object') continue;
    const storyListId =
      toPositiveInt(pickField(item, ['storyListId', 'story_list_id', 'storyListID', 'StoryListId'])) ??
      toPositiveInt(pickField(item.story || item.Story, ['id', 'Id', 'ID']));
    if (storyListId === null) continue;
    const price = Number(pickField(item, ['priceCoins', 'price_coins', 'price']));
    catalog.set(String(storyListId), { priceCoins: Number.isFinite(price) ? price : null });
  }
  return catalog;
}

/** 正規化已購書籍：App `{ storyListId, createdAt }` 與後台 `{ book: { id }, purchasedAt }` 皆可 */
function normalizeEntitlements(entitlements) {
  const out = [];
  for (const e of Array.isArray(entitlements) ? entitlements : []) {
    if (!e || typeof e !== 'object') continue;
    const book = e.book || e.Book || e.story || e.Story || null;
    const storyListId =
      toPositiveInt(pickField(e, ['storyListId', 'story_list_id', 'bookId', 'book_id'])) ??
      toPositiveInt(pickField(book, ['id', 'Id', 'ID', 'storyListId']));
    if (storyListId === null) continue;
    const at = toEpochMillis(pickField(e, ['purchasedAt', 'purchased_at', 'createdAt', 'created_at']));
    out.push({ storyListId, at });
  }
  return out;
}

/** 一筆流水與一本已購書籍的配對分數；不可能是同一次購買時回傳 0 */
function pairScore(target, candidate) {
  if (target.at === null || candidate.at === null) return 0;
  const gapMs = Math.abs(target.at - candidate.at);
  if (gapMs > MATCH_WINDOW_MS) return 0;
  const priceBonus = candidate.price !== null && candidate.price === target.price ? SCORE_PRICE_MATCH : 0;
  return SCORE_MATCH + priceBonus - Math.round(gapMs / 1000);
}

/**
 * 保序對齊：兩邊各自依時間排序後，找出不交錯、總分最高的一對一配對（類似 LCS 的動態規劃）。
 * 單純找最近時間在連續購買時會因寫入漂移配錯，故要求 ORDER 遞增 ↔ 建立時間遞增。
 * @returns {Array<[number, number]>} [流水索引, 已購書籍索引]
 */
function alignInOrder(targets, candidates) {
  const n = targets.length;
  const m = candidates.length;
  const width = m + 1;
  // dp[i * width + j]：前 i 筆流水對前 j 本書的最高總分
  const dp = new Int32Array((n + 1) * width);
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      let best = Math.max(dp[(i - 1) * width + j], dp[i * width + j - 1]);
      const score = pairScore(targets[i - 1], candidates[j - 1]);
      if (score > 0) best = Math.max(best, dp[(i - 1) * width + j - 1] + score);
      dp[i * width + j] = best;
    }
  }

  const pairs = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const score = pairScore(targets[i - 1], candidates[j - 1]);
    if (score > 0 && dp[i * width + j] === dp[(i - 1) * width + j - 1] + score) {
      pairs.push([i - 1, j - 1]);
      i -= 1;
      j -= 1;
    } else if (dp[i * width + j] === dp[(i - 1) * width + j]) {
      i -= 1;
    } else {
      j -= 1;
    }
  }
  return pairs.reverse();
}

/**
 * 已退款書籍 ID：書籍購買流水所屬 ORDER 有 `[已退款] … ORDER:n` 說明者。
 * 配不到購買紀錄的書（後台贈書、時間差過大）不會被判為已退款——寧可照常顯示，也不誤藏。
 * @param {{ ledgerItems: Array, entitlements: Array, bookCatalog?: Map }} params
 *   ledgerItems：全部金幣流水；entitlements：全部已購書籍（保序對齊需要完整次序，不可只給一頁）
 * @returns {Set<number>}
 */
export function resolveRefundedBookIds(params = {}) {
  const ledgerItems = Array.isArray(params.ledgerItems) ? params.ledgerItems : [];
  const bookCatalog = params.bookCatalog instanceof Map ? params.bookCatalog : new Map();

  // 已退款的訂單：任何流水（通常是 0 金幣的 ADMIN_GRANT）說明為 `[已退款] … ORDER:n`
  const refundedOrderIds = new Set();
  for (const row of ledgerItems) {
    const remark = getRawRemark(row);
    if (!isRefundedBookRemark(remark)) continue;
    const orderId = parseNumericOrderId(remark);
    if (orderId !== null) refundedOrderIds.add(orderId);
  }
  const ids = new Set();
  if (refundedOrderIds.size === 0) return ids;

  // 待配對的流水：只取有數字訂單編號的書籍購買，依 ORDER 遞增
  const targets = [];
  for (const row of ledgerItems) {
    if (!row || typeof row !== 'object') continue;
    if (!isBookPurchaseType(pickField(row, ['type', 'Type']))) continue;
    if (pickField(row, ['id', 'Id', 'ID']) == null) continue;
    const orderId = parseNumericOrderId(getRawRemark(row));
    if (orderId === null) continue;
    targets.push({
      orderId,
      refunded: refundedOrderIds.has(orderId),
      price: Math.abs(Number(pickField(row, ['amount', 'Amount'])) || 0),
      at: toEpochMillis(pickField(row, ['createdAt', 'created_at', 'CreatedAt'])),
    });
  }
  targets.sort((a, b) => a.orderId - b.orderId);

  // 候選：已購書籍依建立時間遞增，並帶上書店定價（定價未知者仍可靠時間配上）
  const candidates = normalizeEntitlements(params.entitlements)
    .map((e) => ({ ...e, price: bookCatalog.get(String(e.storyListId))?.priceCoins ?? null }))
    .sort((a, b) => (a.at ?? 0) - (b.at ?? 0));

  for (const [ti, ci] of alignInOrder(targets, candidates)) {
    if (targets[ti].refunded) ids.add(candidates[ci].storyListId);
  }
  return ids;
}
