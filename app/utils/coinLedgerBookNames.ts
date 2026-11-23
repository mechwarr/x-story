// app/utils/coinLedgerBookNames.ts
//
// 金幣紀錄頁的書名決定：每筆購書流水（BOOK_PURCHASE）與後台已退款標註要顯示哪本書。
// 純函式、不碰 React／網路，畫面端（screens/CoinHistoryScreen）只負責取資料與呈現。

import type { BookEntitlementItem, CoinLedgerItem } from '../config/userApiClient';
import { toEpochMillis } from './datetime';

/**
 * 後台書單「移除」的已退款標註。CMS 以 rewards/grant 寫入一筆 0 金幣流水（type=ADMIN_GRANT），
 * 說明為「[已退款] {書名} ORDER:{orderId}」，orderId 是該書 BOOK_PURCHASE 的訂單流水號（不是 IAP 收據）。
 * 書籍保留、金幣不退，這筆只是「該書已退款」的標註；書名取結尾的 ORDER 之前，書名內含 ORDER 字樣也不誤判。
 */
const REFUNDED_BOOK_SOURCE_RE = /^\s*\[已退款\]\s*(.*?)\s*ORDER:\s*(\d+)\s*$/;

/** CMS 查無書名時寫入的佔位字樣「書籍 {id}」，屬系統字串，不可當書名顯示 */
const REFUNDED_BOOK_PLACEHOLDER_RE = /^書籍\s*\d+$/;

/** 書籍基本資料（storyListId → 書名／定價），來源為書店清單，供顯示與價格約束使用 */
export type BookCatalogEntry = { name: string | null; priceCoins: number | null };

export type BookNameResolution = {
  /** ledgerId → 書名 */
  names: Map<number, string>;
  /** 本次推導出、可固化回本機對照表的結果（Layer 4 回填） */
  backfill: { orderId: number; storyListId: number }[];
};

/** 從 source 取出「數字型」訂單編號（書籍訂單為 ORDER:28 這種流水號；IAP 的 GPA.xxx 不適用） */
function parseNumericOrderId(source: string | undefined): number | null {
  const m = String(source ?? '').match(/ORDER:\s*(\d+)\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** 購書流水的訂單編號：新版後端的 orderId 欄位優先，沒有（或不是正整數）再從 source 的 ORDER:n 解析 */
export function bookOrderIdOf(log: CoinLedgerItem): number | null {
  const n = Number(log.orderId);
  if (log.orderId != null && Number.isInteger(n) && n > 0) return n;
  return parseNumericOrderId(log.source);
}

/** 後端以訂單關聯出的書名（story.main_menu_title）；不是購書流水、或值為 null／空字串時回 null */
export function backendBookName(log: CoinLedgerItem): string | null {
  if (log.type !== 'BOOK_PURCHASE') return null;
  const title = log.story?.main_menu_title;
  return typeof title === 'string' && title.trim() ? title.trim() : null;
}

/**
 * 帳本是否來自新版後端：任一筆購書流水帶有 story 或 orderId 欄位（值為 null 也算）。
 * 舊版後端兩個欄位都不存在，只能靠推導配對書名。
 */
export function hasBackendBookInfo(logs: CoinLedgerItem[]): boolean {
  return logs.some((log) => log.type === 'BOOK_PURCHASE' && ('story' in log || 'orderId' in log));
}

/**
 * 是否需要持有清單與書店清單才能決定書名。新版後端書名齊全時可省掉這兩支請求：
 *  - 舊版後端：有購書流水就需要（推導要用持有順序與定價）。
 *  - 新版後端：只有「後端沒給書名、但本機對照表記得是哪本書」的列需要查書名。
 */
export function needsBookLookup(logs: CoinLedgerItem[], orderBookMap: Record<string, number>): boolean {
  const legacyBackend = !hasBackendBookInfo(logs);
  return logs.some((log) => {
    if (log.type !== 'BOOK_PURCHASE' || backendBookName(log)) return false;
    if (legacyBackend) return true;
    const orderId = bookOrderIdOf(log);
    return orderId !== null && orderBookMap[String(orderId)] != null;
  });
}

/**
 * 決定每筆 BOOK_PURCHASE 對應的書名（ledgerId → 書名），依序採用：
 *
 *  0. 後端書名：新版後端的 story.main_menu_title，由伺服器以訂單關聯出書籍，最可信。
 *  1. 本機對照表：購買當下由 api/orders/coin-purchase 的回應記下的 orderId → storyListId，
 *     是已知事實而非推測（見 storage/coinOrderBooks）。
 *  2. 價格硬約束：ledger 的扣款金額必須等於該書的 priceCoins，候選通常就此唯一化。
 *  3. 保序配對：ORDER 編號遞增、entitlement 建立順序遞增，同價位組內第 k 筆對第 k 筆。
 *     用的是相對次序（不會漂移），不是絕對時間；刻意不比對購買時間——兩張表的寫入時間會漂移。
 *
 * 2、3 只在舊版後端（帳本完全沒有 story／orderId 欄位）時執行。新版後端的 story 只有書名、
 * 沒有書籍 ID，後端已認領的書無法從候選中排除；若讓 story 為 null 的列（缺訂單或書籍）繼續推導，
 * 例如同價位另一本書被退款撤銷後，數量剛好對上，就會配到別筆的書名。
 *
 * 同價位組內兩邊數量不一致時（退款、後台贈書、同書重複購買只留一筆 entitlement），
 * 該組一律不配——寧可顯示「書籍購買」，也不要顯示錯的書名。
 */
export function resolveBookNames(
  logs: CoinLedgerItem[],
  entitlements: BookEntitlementItem[],
  orderBookMap: Record<string, number>,
  bookCatalog: Map<number, BookCatalogEntry>
): BookNameResolution {
  const names = new Map<number, string>();
  const backfill: { orderId: number; storyListId: number }[] = [];
  const legacyBackend = !hasBackendBookInfo(logs);

  // 書名優先取 entitlement（使用者實際擁有的），書店清單為備援（退款或改版後仍能顯示）。
  // 與購買彈窗一致採用主選單標題 main_menu_title；用 || 連空字串也擋掉，缺值時退回 main_menu_name
  const entitlementNames = new Map<number, string>();
  for (const e of entitlements) {
    const name = e.story?.main_menu_title || e.story?.main_menu_name;
    if (e.storyListId != null && name) entitlementNames.set(Number(e.storyListId), name);
  }
  const nameOf = (storyListId: number): string | null =>
    entitlementNames.get(storyListId) ?? bookCatalog.get(storyListId)?.name ?? null;

  const usedStoryIds = new Set<number>();
  const pending: { logId: number; orderId: number; price: number }[] = [];

  for (const log of logs) {
    if (log.type !== 'BOOK_PURCHASE') continue;

    // Layer 0：後端以訂單關聯出的書名
    const fromBackend = backendBookName(log);
    if (fromBackend) {
      names.set(log.id, fromBackend);
      continue;
    }

    // 沒有數字訂單編號的紀錄無法保序、也無法回填，不參與推導（顯示通用文案）
    const orderId = bookOrderIdOf(log);
    if (orderId === null) continue;

    // Layer 1：本機對照表（購買當下記下的事實）
    const mapped = orderBookMap[String(orderId)];
    if (mapped != null) {
      // 這本書已被明確認領，不可再被其他紀錄推導佔用（即使查不到書名可顯示）
      usedStoryIds.add(Number(mapped));
      const name = nameOf(Number(mapped));
      if (name) names.set(log.id, name);
      continue;
    }

    // 新版後端：後端給不出書名的列不推導（理由見函式說明）
    if (!legacyBackend) continue;

    pending.push({ logId: log.id, orderId, price: Math.abs(Number(log.amount) || 0) });
  }
  if (pending.length === 0) return { names, backfill };

  // 剩餘候選：尚未被對照表占用的已購書籍，依建立順序排列（只取次序，不取時間值）
  const candidates = entitlements
    .filter((e) => e.storyListId != null && !usedStoryIds.has(Number(e.storyListId)))
    .map((e) => ({
      storyListId: Number(e.storyListId),
      at: toEpochMillis(e.createdAt) ?? 0,
      price: bookCatalog.get(Number(e.storyListId))?.priceCoins ?? null,
    }))
    .sort((a, b) => a.at - b.at);
  if (candidates.length === 0) return { names, backfill };

  // Layer 2 + 3：先以價格分組，組內再依序（ORDER 遞增 ↔ 建立順序遞增）一對一配
  const targetsByPrice = new Map<number, typeof pending>();
  for (const t of [...pending].sort((a, b) => a.orderId - b.orderId)) {
    const group = targetsByPrice.get(t.price);
    if (group) group.push(t);
    else targetsByPrice.set(t.price, [t]);
  }

  const candidatesByPrice = new Map<number, typeof candidates>();
  for (const c of candidates) {
    if (c.price == null) continue; // 定價未知（已下架等）者不參與推導
    const group = candidatesByPrice.get(c.price);
    if (group) group.push(c);
    else candidatesByPrice.set(c.price, [c]);
  }

  for (const [price, targets] of targetsByPrice) {
    const group = candidatesByPrice.get(price);
    // 數量不一致＝有退款／贈書／重複購買造成的缺口，無法確定誰是誰，整組放棄
    if (!group || group.length !== targets.length) continue;

    targets.forEach((target, i) => {
      const candidate = group[i];
      const name = nameOf(candidate.storyListId);
      if (!name) return;
      names.set(target.logId, name);
      backfill.push({ orderId: target.orderId, storyListId: candidate.storyListId });
    });
  }

  return { names, backfill };
}

/** 後台書籍已退款標註 → 書籍訂單編號與 CMS 寫入的書名（查無或佔位字樣時為 null）；非此類流水回 null */
export function parseRefundedBookMark(
  log: CoinLedgerItem
): { orderId: number; name: string | null } | null {
  if (log.type !== 'ADMIN_GRANT') return null;
  const m = String(log.source ?? '').match(REFUNDED_BOOK_SOURCE_RE);
  if (!m) return null;
  const orderId = Number(m[2]);
  if (!Number.isFinite(orderId) || orderId <= 0) return null;
  const name = m[1].trim();
  return { orderId, name: name && !REFUNDED_BOOK_PLACEHOLDER_RE.test(name) ? name : null };
}

/**
 * 在 resolveBookNames 的結果上補齊已退款標註與其解鎖紀錄的書名（ledgerId → 書名），
 * 兩列以書籍訂單編號互相對應：
 *  - 標註列：優先取同一訂單解鎖列的書名（後端書名或 App 推導）——訂單編號是結構化對照，且兩列會同名
 *    （CMS 寫入的是自由文字，取的欄位也可能與 App 顯示的主選單標題不同），解鎖列沒有書名才用 CMS 書名。
 *  - 解鎖列：沒有書名時，借用指向同一訂單的標註書名，不再只顯示「故事解鎖」。
 */
export function attachRefundedBookNames(
  logs: CoinLedgerItem[],
  bookNames: Map<number, string>
): Map<number, string> {
  const marks: { ledgerId: number; orderId: number }[] = [];
  const markedNames = new Map<number, string>(); // 訂單編號 → CMS 寫入的書名
  for (const log of logs) {
    const mark = parseRefundedBookMark(log);
    if (!mark) continue;
    marks.push({ ledgerId: log.id, orderId: mark.orderId });
    if (mark.name && !markedNames.has(mark.orderId)) markedNames.set(mark.orderId, mark.name);
  }
  if (marks.length === 0) return bookNames;

  const names = new Map(bookNames);
  const purchasedNames = new Map<number, string>(); // 訂單編號 → 解鎖列的書名
  for (const log of logs) {
    if (log.type !== 'BOOK_PURCHASE') continue;
    const orderId = bookOrderIdOf(log);
    if (orderId === null) continue;
    const name = bookNames.get(log.id);
    if (name) purchasedNames.set(orderId, name);
    else if (markedNames.has(orderId)) names.set(log.id, markedNames.get(orderId)!);
  }
  for (const { ledgerId, orderId } of marks) {
    const name = purchasedNames.get(orderId) ?? markedNames.get(orderId);
    if (name) names.set(ledgerId, name);
  }
  return names;
}
