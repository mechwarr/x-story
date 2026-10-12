import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import {
  getCoinLedger,
  getAllEntitlements,
  getBookstoreList,
  CoinLedgerItem,
  BookEntitlementItem,
} from '../config/userApiClient';
import { getCoinOrderBookMap, recordCoinOrderBooks } from '../storage/coinOrderBooks';
import { useCoins } from '../store/coinContext';
import { iapService } from '../services/iapService';
import { fetchCurrentPlatformCatalog, buildBackendNameMap } from '../utils/iapCatalog';
import { appStoreSkuToBackendProductId } from '../utils/iosIapSkuMapping';
import type { IapReceipt } from '../config/shopApiClient';
import useResponsive from '../hook/useResponsive';
import NoDataRetryView from '../components/NoDataRetryView';
import { translate } from '../i18n/i18n';
import { formatServerDateTime, toEpochMillis } from '../utils/datetime';

/** 後端 type 對應翻譯 key（api/me/coins/ledger 的 type 欄位） */
const TYPE_LABEL_KEYS: Record<string, string> = {
  IAP: 'coinTypePurchase',
  IAP_BONUS: 'coinTypeBonus',
  purchase: 'coinTypePurchase',
  bonus: 'coinTypeBonus',
  spent: 'coinTypeSpent',
  refund: 'coinTypeRefund',
  expired: 'coinTypeExpired',
  BOOK_PURCHASE: 'coinTypeBookPurchase',
  ADMIN_GRANT: 'coinTypeAdminGrant',
  ACTIVITY_REWARD: 'coinTypeActivityReward',
};

/**
 * ACTIVITY_REWARD 的 source 標記（ACTIVITY:<CODE>）對應翻譯 key。
 * 之後新增活動只要在這裡補一筆，查無對照時退回通用的活動獎勵文案。
 */
const ACTIVITY_LABEL_KEYS: Record<string, string> = {
  PROFILE_COMPLETED: 'coinTypeActivityReward',
};

/**
 * 後台退款流水的 source 標記。CMS 退款時以 rewards/grant 扣幣（type=ADMIN_GRANT），
 * reason 寫死為「[系統退款] ORDER:{receiptId}」，receiptId 為 IAP 收據單號。
 * 後端沒有專屬的退款 type，只能靠這個前綴辨識；CMS 改文案時只需改這裡。
 */
const REFUND_SOURCE_RE = /^\s*\[系統退款\]\s*ORDER:\s*([^\s|]+)/;

/** 書籍基本資料（storyListId → 書名／定價），來源為書店清單，供顯示與價格約束使用 */
export type BookCatalogEntry = { name: string | null; priceCoins: number | null };

type BookNameResolution = {
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

/**
 * 決定每筆 BOOK_PURCHASE 對應的書名。刻意「不」使用購買時間比對——兩張表的寫入時間會漂移，
 * 差幾秒就配錯或配不到。改用三層證據：
 *
 *  1. 本機對照表：購買當下由 api/orders/coin-purchase 的回應記下的 orderId → storyListId，
 *     是已知事實而非推測，優先採用（見 storage/coinOrderBooks）。
 *  2. 價格硬約束：ledger 的扣款金額必須等於該書的 priceCoins，候選通常就此唯一化。
 *  3. 保序配對：ORDER 編號遞增、entitlement 建立順序遞增，同價位組內第 k 筆對第 k 筆。
 *     用的是相對次序（不會漂移），不是絕對時間。
 *
 * 同價位組內兩邊數量不一致時（退款、後台贈書、同書重複購買只留一筆 entitlement），
 * 該組一律不配——寧可顯示「書籍購買」，也不要顯示錯的書名。
 */
function resolveBookNames(
  logs: CoinLedgerItem[],
  entitlements: BookEntitlementItem[],
  orderBookMap: Record<string, number>,
  bookCatalog: Map<number, BookCatalogEntry>
): BookNameResolution {
  const names = new Map<number, string>();
  const backfill: { orderId: number; storyListId: number }[] = [];

  // 書名優先取 entitlement（使用者實際擁有的），書店清單為備援（退款或改版後仍能顯示）。
  // 與購買彈窗一致採用主選單標題 main_menu_title；用 || 連空字串也擋掉，缺值時退回 main_menu_name
  const entitlementNames = new Map<number, string>();
  for (const e of entitlements) {
    const name = e.story?.main_menu_title || e.story?.main_menu_name;
    if (e.storyListId != null && name) entitlementNames.set(Number(e.storyListId), name);
  }
  const nameOf = (storyListId: number): string | null =>
    entitlementNames.get(storyListId) ?? bookCatalog.get(storyListId)?.name ?? null;

  // Layer 1：本機對照表（購買當下記下的事實）
  const usedStoryIds = new Set<number>();
  const pending: { logId: number; orderId: number; price: number }[] = [];

  for (const log of logs) {
    if (log.type !== 'BOOK_PURCHASE') continue;

    // 沒有數字訂單編號的紀錄無法保序、也無法回填，不參與推導（顯示通用文案）
    const orderId = parseNumericOrderId(log.source);
    if (orderId === null) continue;

    const mapped = orderBookMap[String(orderId)];
    if (mapped != null) {
      // 這本書已被明確認領，不可再被其他紀錄推導佔用（即使查不到書名可顯示）
      usedStoryIds.add(Number(mapped));
      const name = nameOf(Number(mapped));
      if (name) names.set(log.id, name);
      continue;
    }

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

/**
 * 依 productId 取得顯示名稱：優先用雙平台（App Store / Google Play）回傳的當地語系 title，
 * 平台尚未載入時退回後端金幣包名稱（同樣來自 API，非硬編碼），最後才退回 productId。
 * 另一平台的紀錄（例如 Android 上看到 iOS 的 item_03）先換回後端 ID 再查金幣包名稱，
 * 避免畫面直接印出 SKU 代碼。
 */
function resolveProductName(productId: string, backendNames: Record<string, string>): string {
  const platformName = iapService.getProductName(productId);
  if (platformName && platformName !== productId) {
    return platformName;
  }
  const id = String(productId ?? '').trim();
  return backendNames[id] ?? backendNames[appStoreSkuToBackendProductId(id)] ?? productId;
}

/** IAP 單號 → 原儲值商品與贈送金幣，供退款流水顯示「退的是哪個金幣包、含多少 BONUS」 */
type PurchaseOrderInfo = { productId?: string; bonusCoins?: number };

/**
 * 建立 IAP 單號對照：收據（api/me/iap-receipts）為主，帳本自己的儲值流水為備援。
 * 退款流水只帶單號，若只靠收據這一條路，收據取不到或不在清單中時就只剩單號可顯示；
 * 帳本的「ORDER:x|PROD:y」(IAP) 與「ORDER:x|PROD:y_BONUS」(IAP_BONUS) 一樣對得出商品與贈送金幣。
 */
function buildPurchaseOrderInfo(
  receipts: IapReceipt[],
  logs: CoinLedgerItem[]
): Map<string, PurchaseOrderInfo> {
  const map = new Map<string, PurchaseOrderInfo>();
  // 先寫入者優先（收據 > 帳本），後來者只補缺的欄位
  const merge = (orderId: string | undefined, info: PurchaseOrderInfo) => {
    const key = String(orderId ?? '').trim();
    if (!key) return;
    const prev = map.get(key) ?? {};
    map.set(key, {
      productId: prev.productId || info.productId || undefined,
      bonusCoins: prev.bonusCoins ?? info.bonusCoins,
    });
  };

  for (const r of receipts) {
    const bonus = Number(r?.bonusCoins);
    merge(r?.receiptId, {
      productId: String(r?.productId ?? '').trim(),
      bonusCoins: Number.isFinite(bonus) ? bonus : undefined,
    });
  }
  for (const log of logs) {
    if (log.type !== 'IAP' && log.type !== 'IAP_BONUS') continue;
    const source = String(log.source ?? '');
    const orderId = source.match(/ORDER:\s*([^\s|]+)/i)?.[1];
    const prod = source.match(/PROD:\s*([^|\s]+)/i)?.[1]?.replace(/_BONUS$/i, '');
    merge(orderId, {
      productId: prod,
      bonusCoins: log.type === 'IAP_BONUS' ? Math.abs(Number(log.amount) || 0) : undefined,
    });
  }
  return map;
}

/**
 * 從 source 字串解析出第一行（產品名稱／BONUS）與第二行（收據編號）。
 * source 格式範例: "ORDER:xxx|PROD:item_003"、"ORDER:xxx|PROD:item_003_BONUS"，
 * 也可能夾在其他文字中（例如 ADMIN_GRANT 的 "[系統退款] ORDER:xxx"），因此以比對方式取出，
 * 不再把整段 source 當成可顯示文字。
 * 若 PROD 值含 '_BONUS'，則取對應的 item_xxx 平台名稱，第一行顯示為「平台名稱 BONUS」。
 */
function parseSourceDisplay(
  source: string,
  backendNames: Record<string, string>
): { line1: string; line2: string } {
  const text = String(source ?? '');
  let line1 = '';

  const orderMatch = text.match(/ORDER:\s*([^\s|]+)/i);
  const line2 = orderMatch ? `ORDER:${orderMatch[1]}` : '';

  const prodMatch = text.match(/PROD:\s*([^|]+)/i);
  if (prodMatch) {
    const prodValue = prodMatch[1].trim();
    if (prodValue.toUpperCase().includes('_BONUS')) {
      const baseId = prodValue.replace(/_BONUS$/i, '');
      line1 = `${resolveProductName(baseId, backendNames)} BONUS`;
    } else if (prodValue.toUpperCase() === 'BONUS') {
      line1 = 'BONUS';
    } else {
      line1 = resolveProductName(prodValue, backendNames);
    }
  }

  return { line1, line2 };
}

/** 後台退款流水 → 收據單號；非退款流水回 null */
function parseRefundReceiptId(log: CoinLedgerItem): string | null {
  if (log.type !== 'ADMIN_GRANT') return null;
  return String(log.source ?? '').match(REFUND_SOURCE_RE)?.[1] ?? null;
}

/**
 * 決定一筆帳務紀錄要顯示的標題、補充說明與備註。
 * 原則：標題一律走 i18n 或商品／書名，絕不把後端的系統字串（ADMIN_GRANT、
 * ACTIVITY:PROFILE_COMPLETED…）直接印到畫面；備註只顯示收據編號，書籍解鎖不顯示。
 */
function describeLedgerRow(
  log: CoinLedgerItem,
  backendNames: Record<string, string>,
  bookName: string | undefined,
  orderInfo: Map<string, PurchaseOrderInfo>
): { title: string; note: string; detail?: string } {
  const { line1, line2 } = parseSourceDisplay(log.source ?? '', backendNames);

  // 書籍解鎖：顯示「書名 - 解鎖」，不顯示 ORDER 編號
  if (log.type === 'BOOK_PURCHASE') {
    return {
      title: bookName ? `${bookName} - ${translate('coinHistoryUnlocked')}` : translate('coinTypeBookPurchase'),
      note: '',
    };
  }

  // 活動獎勵：只顯示獎勵名稱，不顯示 ACTIVITY 代碼
  if (log.type === 'ACTIVITY_REWARD') {
    const code = (log.source ?? '').match(/ACTIVITY:\s*([^\s|]+)/i)?.[1]?.toUpperCase() ?? '';
    return { title: translate(ACTIVITY_LABEL_KEYS[code] ?? 'coinTypeActivityReward'), note: '' };
  }

  // 後台退款：顯示「金幣包名稱 - 退款」與「含 BONUS N 金幣」，讓使用者能對帳（扣回的是儲值＋贈送）。
  // 商品依序取 收據／帳本同單號的儲值流水 → 退款流水自帶的 PROD；都對不到才只顯示「退款」
  const refundReceiptId = parseRefundReceiptId(log);
  if (refundReceiptId) {
    const info = orderInfo.get(refundReceiptId);
    const sourceProd = String(log.source ?? '').match(/PROD:\s*([^|\s]+)/i)?.[1];
    const productId = info?.productId || sourceProd;
    const bonus = Number(info?.bonusCoins) || 0;
    const refundLabel = translate('coinTypeRefund');
    return {
      title: productId ? `${resolveProductName(productId, backendNames)} - ${refundLabel}` : refundLabel,
      detail: bonus > 0 ? translate('coinRefundIncludesBonus', { bonus }) : '',
      note: `ORDER:${refundReceiptId}`,
    };
  }

  const typeKey = TYPE_LABEL_KEYS[log.type];
  return {
    title: line1 || (typeKey ? translate(typeKey) : ''),
    note: line2,
  };
}

// 格式化交易時間：後端 UTC 時間戳 → 裝置時區的 yyyy.MM.dd HH:mm（台北為 UTC+8）
function formatDateTime(iso: string): string {
  return formatServerDateTime(iso);
}

export default function CoinHistoryScreen({ embedded = false }: { embedded?: boolean }) {
  const Wrapper: any = embedded ? View : SafeAreaView;
  const { refreshCoins } = useCoins();
  const { isTablet, maxContentWidth, ms } = useResponsive();

  const [logs, setLogs] = useState<CoinLedgerItem[]>([]);
  // 後端金幣包名稱（productId → name），供商店尚未回傳 title 時的顯示 fallback
  const [backendNames, setBackendNames] = useState<Record<string, string>>({});
  const [entitlements, setEntitlements] = useState<BookEntitlementItem[]>([]);
  // 購買當下記下的 orderId → storyListId（本機、依帳號隔離）
  const [orderBookMap, setOrderBookMap] = useState<Record<string, number>>({});
  // storyListId → 書名／定價（書店清單），供顯示備援與價格約束
  const [bookCatalog, setBookCatalog] = useState<Map<number, BookCatalogEntry>>(new Map());
  // IAP 收據，供後台退款流水對照出原儲值商品與贈送金幣
  const [receipts, setReceipts] = useState<IapReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  // loadFailed：帳務紀錄本身取不到 → 整頁改為「沒有資料」狀態（說明 + 重試）
  const [loadFailed, setLoadFailed] = useState(false);
  // notice：紀錄有取到、只是書名配對資料不完整 → 列表上方掛一則說明，不擋畫面
  const [notice, setNotice] = useState<string | null>(null);

  // ledgerId → 書名。整批一次算完，才能保證每本書只被一筆紀錄認領
  const { names: bookNames, backfill } = useMemo(
    () => resolveBookNames(logs, entitlements, orderBookMap, bookCatalog),
    [logs, entitlements, orderBookMap, bookCatalog]
  );

  // IAP 單號 → 原儲值商品／贈送金幣（收據為主、帳本儲值流水為備援）
  const orderInfo = useMemo(() => buildPurchaseOrderInfo(receipts, logs), [receipts, logs]);

  // Layer 4：把這次推導出的結果固化回本機對照表，舊紀錄算過一次就定案，
  // 不會因為之後又買了新書或後台改價而在畫面上跳動。
  useEffect(() => {
    if (backfill.length > 0) recordCoinOrderBooks(backfill);
  }, [backfill]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    setNotice(null);
    try {
      // 先依後端金幣包載入平台商品列表，讓 resolveProductName 能取得當地語系顯示名稱。
      // 商品清單來自 api/coin-packs，後台新增品項的帳務紀錄也能正確顯示名稱。
      try {
        const catalog = await fetchCurrentPlatformCatalog();
        setBackendNames(buildBackendNameMap(catalog.packs));
        await iapService.initialize();
        await iapService.getProductList(catalog.skus);
      } catch {
        // 平台／後端未就緒時仍可顯示紀錄，名稱退回 productId
      }

      // entitlements 需為最新（剛買的書若吃到 5 分鐘快取就配不到書名），
      // 並抓齊所有頁（getAllEntitlements 以後端 total 翻頁），讓較早的帳務紀錄也對得到書。
      // 書店清單提供每本書的定價，是推導配對時的價格硬約束；本機對照表則是購買當下記下的事實。
      // 書店清單與本機對照表只是「讓書名更準」的輔助，取不到也要能顯示帳務紀錄，故各自吞錯
      // IAP 收據只用來替退款流水補上商品名稱與 BONUS，取不到時改由帳本儲值流水對照，同樣吞錯
      const [logsRes, entitlementsRes, bookstore, savedOrderBooks, receiptsRes] = await Promise.all([
        getCoinLedger(),
        getAllEntitlements(),
        // 取不到（回 null）就當空清單：這裡書店清單只是配對書名的輔助，帳務紀錄照常顯示
        getBookstoreList().then((list) => list ?? []),
        getCoinOrderBookMap().catch(() => ({})),
        iapService.getIapReceipts().catch(() => []),
      ]);

      setReceipts(receiptsRes);

      const catalogByStoryId = new Map<number, BookCatalogEntry>();
      for (const item of bookstore) {
        const storyListId = Number(item?.storyListId);
        if (!Number.isFinite(storyListId)) continue;
        const priceCoins = Number(item?.priceCoins);
        catalogByStoryId.set(storyListId, {
          name: item?.story?.main_menu_name ?? null,
          priceCoins: Number.isFinite(priceCoins) ? priceCoins : null,
        });
      }
      setBookCatalog(catalogByStoryId);
      setOrderBookMap(savedOrderBooks);

      // entitlements 取不到（failed）≠ 沒買過任何書：兩者都回空清單，但前者只是這次查不到。
      // 帳務紀錄本身照常顯示（書名配對是輔助），故不擋畫面，只在上方掛一則說明，
      // 讓「書名變成訂單編號」有原因可循，而不是看起來像資料錯亂。
      if (entitlementsRes.failed) {
        setNotice(translate('coinHistoryBookNamesUnavailable'));
      }

      setLogs(logsRes);
      setEntitlements(entitlementsRes.items);
    } catch (e) {
      // 原始錯誤只留 console；對使用者一律顯示內建翻譯（版面與個人資料錯誤頁一致）
      console.error('[CoinHistoryScreen] 載入金幣紀錄失敗:', e);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useFocusEffect(
    useCallback(() => {
      refreshCoins();
      fetchData();
    }, [refreshCoins, fetchData])
  );

  // 取不到金幣紀錄：不畫標題與列表，整頁改為共用「沒有資料」狀態（內嵌於紀錄分頁時不重複畫頂欄）
  if (!loading && loadFailed) {
    return (
      <Wrapper style={styles.safe}>
        <NoDataRetryView
          message={translate('coinHistoryLoadFailedMessage')}
          onRetry={fetchData}
          showTopBar={!embedded}
        />
      </Wrapper>
    );
  }

  return (
    <Wrapper style={styles.safe}>
      <View style={[styles.header, isTablet && { maxWidth: maxContentWidth, alignSelf: 'center', width: '100%' }]}>
        <Text style={[styles.title, { fontSize: ms(18) }]}>{translate('coinHistory')}</Text>
      </View>

      {notice ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{notice}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color="#f0ad57" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.list, isTablet && { maxWidth: maxContentWidth, alignSelf: 'center', width: '100%' }]}>
          {logs.length === 0 ? (
            <Text style={styles.emptyText}>{translate('coinHistoryEmpty')}</Text>
          ) : (
            logs.map((log) => {
              const { title: rowTitle, note: rowNote, detail: rowDetail } = describeLedgerRow(
                log,
                backendNames,
                bookNames.get(log.id),
                orderInfo
              );
              return (
              <View key={log.id} style={styles.row}>
                <View style={styles.left}>
                  {rowTitle ? (
                    <Text style={[styles.rowTitle, { fontSize: ms(15) }]}>
                      {rowTitle}
                    </Text>
                  ) : null}
                  {rowDetail ? (
                    <Text style={[styles.detail, { fontSize: ms(13) }]}>{rowDetail}</Text>
                  ) : null}
                  {rowNote ? (
                    <Text style={[styles.note, { fontSize: ms(13) }]} numberOfLines={1} ellipsizeMode="middle">
                      {rowNote}
                    </Text>
                  ) : null}
                  <Text style={[styles.date, { fontSize: ms(12) }]}>{formatDateTime(log.createdAt)}</Text>
                </View>

                <View style={styles.right}>
                  <Text
                    style={[
                      styles.amount,
                      { fontSize: ms(18) },
                      log.amount >= 0 ? styles.plus : styles.minus,
                    ]}
                  >
                    {log.amount >= 0 ? `+${log.amount}` : `${log.amount}`}
                  </Text>
                  <Image style={styles.coinMini} source={require('../../assets/coin.png')} />
                </View>
              </View>
            );
            })
          )}
        </ScrollView>
      )}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#2b2f33' },

  header: { alignItems: 'center', paddingTop: 8, paddingBottom: 6 },
  title: { color: '#e7eef6', fontWeight: '700', fontSize: 18, marginBottom: 6 },

  errorWrap: { paddingHorizontal: 16, paddingVertical: 8 },
  errorText: { color: '#e57373', fontSize: 14 },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 24 },
  list: { paddingTop: 6, paddingHorizontal: 16, paddingBottom: 24, gap: 18 },
  emptyText: { color: '#a6afba', fontSize: 14, textAlign: 'center', marginTop: 24 },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  left: { flexShrink: 1, paddingRight: 8 },
  rowTitle: { color: '#e7eef6', fontSize: 15, fontWeight: '700', marginBottom: 2 },
  note: { color: '#ffffff', opacity: 0.85, fontSize: 13, fontWeight: '700' },
  detail: { color: '#e7eef6', fontSize: 13, marginBottom: 2 },
  date: { color: '#a6afba', fontSize: 12, marginTop: 6 },

  right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  amount: { fontWeight: '800', fontSize: 18, color: '#ffffff' },
  plus: { color: '#ffffff' },
  minus: { color: '#ffffff' },
  coinMini: { width: 18, height: 18 },
});
