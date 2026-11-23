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
  getCoinLedgerOrNull,
  getAllEntitlements,
  getBookstoreList,
  CoinLedgerItem,
  BookEntitlementItem,
} from '../config/userApiClient';
import { getCoinOrderBookMap, recordCoinOrderBooks } from '../storage/coinOrderBooks';
import { useCoins } from '../store/coinContext';
import { iapService } from '../services/iapService';
import { fetchCurrentPlatformCatalog, buildBackendNameMap } from '../utils/iapCatalog';
import {
  resolveBookNames,
  attachRefundedBookNames,
  parseRefundedBookMark,
  needsBookLookup,
  type BookCatalogEntry,
} from '../utils/coinLedgerBookNames';
import type { IapReceipt } from '../config/shopApiClient';
import useResponsive from '../hook/useResponsive';
import NoDataRetryView from '../components/NoDataRetryView';
import { translate } from '../i18n/i18n';
import { formatServerDateTime } from '../utils/datetime';

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

/** 帳本流水 source 內出現的商品 ID（去掉 BONUS 尾綴），供向商店補查名稱 */
function ledgerProductIds(logs: CoinLedgerItem[]): string[] {
  return logs
    .map((log) => String(log.source ?? '').match(/PROD:\s*([^|\s]+)/i)?.[1] ?? '')
    .map((id) => id.replace(/_?BONUS$/i, ''))
    .filter(Boolean);
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
      line1 = `${iapService.getProductName(baseId, backendNames)} BONUS`;
    } else if (prodValue.toUpperCase() === 'BONUS') {
      line1 = 'BONUS';
    } else {
      line1 = iapService.getProductName(prodValue, backendNames);
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

  // 後台書籍已退款標註：顯示「書名 - 已退款」，與解鎖列一樣不顯示訂單編號。
  // 原解鎖列刻意不加註「已退款」：這筆標註通常 0 金幣，加在 -N 那列會讓人誤以為扣款已退回
  if (parseRefundedBookMark(log)) {
    return {
      title: bookName ? `${bookName} - ${translate('coinHistoryRefunded')}` : translate('coinTypeBookRefunded'),
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
      title: productId ? `${iapService.getProductName(productId, backendNames)} - ${refundLabel}` : refundLabel,
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

/** 書名備援資料：持有清單（書名＋建立順序）與書店清單（書名＋定價），供本機對照表查名與舊版後端推導 */
type BookLookup = {
  entitlements: BookEntitlementItem[];
  /** 持有清單這次取不到（狀態未知），不同於「沒買過任何書」 */
  entitlementsFailed: boolean;
  catalog: Map<number, BookCatalogEntry>;
};

async function fetchBookLookup(): Promise<BookLookup> {
  // entitlements 需為最新（剛買的書若吃到 5 分鐘快取就配不到書名），
  // 並抓齊所有頁（getAllEntitlements 以後端 total 翻頁），讓較早的帳務紀錄也對得到書。
  // 書店清單提供每本書的定價，是推導配對時的價格硬約束；取不到（回 null）就當空清單
  const [entitlementsRes, bookstore] = await Promise.all([
    getAllEntitlements(),
    getBookstoreList().then((list) => list ?? []),
  ]);

  const catalog = new Map<number, BookCatalogEntry>();
  for (const item of bookstore) {
    const storyListId = Number(item?.storyListId);
    if (!Number.isFinite(storyListId)) continue;
    const priceCoins = Number(item?.priceCoins);
    catalog.set(storyListId, {
      name: item?.story?.main_menu_name ?? null,
      priceCoins: Number.isFinite(priceCoins) ? priceCoins : null,
    });
  }
  return { entitlements: entitlementsRes.items, entitlementsFailed: entitlementsRes.failed, catalog };
}

export default function CoinHistoryScreen({
  embedded = false,
  belowTitle,
}: {
  embedded?: boolean;
  /** 標題「金幣紀錄」下方的附加列（紀錄頁傳入金幣餘額＋加值鈕）；錯誤頁不顯示 */
  belowTitle?: React.ReactNode;
}) {
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
  // 再補上後台已退款標註的書名（標註列與其解鎖列以訂單編號互補）
  const rowBookNames = useMemo(() => attachRefundedBookNames(logs, bookNames), [logs, bookNames]);

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
      // 先依後端金幣包載入平台商品列表，讓 getProductName 能取得商店顯示名稱。
      // 商品清單來自 api/coin-packs，後台新增品項的帳務紀錄也能正確顯示名稱。
      try {
        const catalog = await fetchCurrentPlatformCatalog();
        setBackendNames(buildBackendNameMap(catalog.packs));
        await iapService.initialize();
        await iapService.getProductList(catalog.skus);
      } catch {
        // 平台／後端未就緒時仍可顯示紀錄，名稱退回 productId
      }

      // 本機對照表是購買當下記下的事實，只是「讓書名更準」的輔助，取不到也要能顯示帳務紀錄，故吞錯。
      // IAP 收據只用來替退款流水補上商品名稱與 BONUS，取不到時改由帳本儲值流水對照，同樣吞錯
      const [logsRes, savedOrderBooks, receiptsRes] = await Promise.all([
        getCoinLedgerOrNull(),
        getCoinOrderBookMap().catch(() => ({})),
        iapService.getIapReceipts().catch(() => []),
      ]);

      // 帳本取不到（null）≠ 沒有紀錄：不可落到「尚無金幣紀錄」，改走整頁錯誤狀態（說明＋重試）
      if (!logsRes) {
        throw new Error('金幣帳本取得失敗');
      }

      // 新版後端的購書流水已帶書名（story.main_menu_title）。只有後端沒給書名、要靠本機對照表查名，
      // 或舊版後端要推導配對時，才補抓持有清單與書店清單。
      // 同時向商店補查紀錄用到但不在目錄內的商品（已停用的金幣包、另一平台的 SKU），名稱才不會只剩代碼
      const [, lookup] = await Promise.all([
        iapService
          .ensureProductsCached([...receiptsRes.map((r) => r.productId), ...ledgerProductIds(logsRes)])
          .catch(() => {}),
        needsBookLookup(logsRes, savedOrderBooks) ? fetchBookLookup() : Promise.resolve(null),
      ]);

      setReceipts(receiptsRes);
      setBookCatalog(lookup?.catalog ?? new Map());
      setOrderBookMap(savedOrderBooks);

      // entitlements 取不到（failed）≠ 沒買過任何書：兩者都回空清單，但前者只是這次查不到。
      // 帳務紀錄本身照常顯示（書名配對是輔助），故不擋畫面，只在上方掛一則說明，
      // 讓「書名變成通用文案」有原因可循，而不是看起來像資料錯亂。
      // 只有真的需要查書名時才會抓持有清單，後端書名齊全時不會出現這則說明。
      if (lookup?.entitlementsFailed) {
        setNotice(translate('coinHistoryBookNamesUnavailable'));
      }

      setLogs(logsRes);
      setEntitlements(lookup?.entitlements ?? []);
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

      {belowTitle}

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
                rowBookNames.get(log.id),
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
                    {/* 0 金幣（例如已退款標註）不加正號，避免看起來像有入帳 */}
                    {log.amount > 0 ? `+${log.amount}` : `${log.amount}`}
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

  header: { alignItems: 'center', paddingTop: 4, paddingBottom: 2 },
  title: { color: '#e7eef6', fontWeight: '700', fontSize: 18, marginBottom: 2 },

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
