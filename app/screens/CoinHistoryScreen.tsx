import React, { useState, useEffect, useCallback } from 'react';
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

import { getCoinLedger, getEntitlements, CoinLedgerItem, BookEntitlementItem } from '../config/userApiClient';
import { useCoins } from '../store/coinContext';
import { iapService } from '../services/iapService';
import { fetchCurrentPlatformCatalog, buildBackendNameMap } from '../utils/iapCatalog';
import useResponsive from '../hook/useResponsive';
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
};

/** 以購買時間比對 ledger 與 entitlement（允許誤差 2 秒內視為同一筆） */
function findBookNameByCreatedAt(
  ledgerCreatedAt: string,
  entitlements: BookEntitlementItem[]
): string | null {
  const t = toEpochMillis(ledgerCreatedAt);
  if (t === null) return null;
  for (const e of entitlements) {
    const et = toEpochMillis(e.createdAt);
    if (et !== null && Math.abs(t - et) <= 2000) {
      return e.story?.main_menu_name ?? null;
    }
  }
  return null;
}

/**
 * 依 productId 取得顯示名稱：優先用雙平台（App Store / Google Play）回傳的當地語系 title，
 * 平台尚未載入時退回後端金幣包名稱（同樣來自 API，非硬編碼），最後才退回 productId。
 */
function resolveProductName(productId: string, backendNames: Record<string, string>): string {
  const platformName = iapService.getProductName(productId);
  if (platformName && platformName !== productId) {
    return platformName;
  }
  return backendNames[String(productId ?? '').trim()] ?? productId;
}

/**
 * 從 source 字串解析出第一行（產品名稱／BONUS）與第二行（ORDER 字串）。
 * source 格式範例: "ORDER:xxx|PROD:item_003" 或 "ORDER:xxx|PROD:BONUS" 或 "ORDER:xxx|PROD:item_003_BONUS"
 * 若 PROD 值含 '_BONUS'，則取對應的 item_xxx 平台名稱，第一行顯示為「平台名稱 BONUS」。
 */
function parseSourceDisplay(
  source: string,
  backendNames: Record<string, string>
): { line1: string; line2: string } {
  let line1 = '';
  let line2 = '';
  const parts = source.split('|').map((p) => p.trim());
  for (const p of parts) {
    if (p.toUpperCase().startsWith('ORDER:')) {
      line2 = p; // 第二行：整段 ORDER: 字串
    } else if (p.toUpperCase().startsWith('PROD:')) {
      const prodValue = p.slice(5).trim(); // 'PROD:' 後面
      if (prodValue.toUpperCase().includes('_BONUS')) {
        const baseId = prodValue.replace(/_BONUS$/i, '');
        line1 = `${resolveProductName(baseId, backendNames)} BONUS`;
      } else if (prodValue.toUpperCase() === 'BONUS') {
        line1 = 'BONUS';
      } else {
        line1 = resolveProductName(prodValue, backendNames);
      }
    }
  }
  return { line1, line2 };
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
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

      const [logsRes, entitlementsRes] = await Promise.all([
        getCoinLedger(),
        getEntitlements(1, 100),
      ]);
      setLogs(logsRes);
      setEntitlements(entitlementsRes.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : translate('loadFailed'));
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

  return (
    <Wrapper style={styles.safe}>
      <View style={[styles.header, isTablet && { maxWidth: maxContentWidth, alignSelf: 'center', width: '100%' }]}>
        <Text style={[styles.title, { fontSize: ms(18) }]}>{translate('coinHistory')}</Text>
      </View>

      {error ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{error}</Text>
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
              const { line1, line2 } = log.source ? parseSourceDisplay(log.source, backendNames) : { line1: '', line2: '' };
              const bookName =
                log.type === 'BOOK_PURCHASE' ? findBookNameByCreatedAt(log.createdAt, entitlements) : null;
              const bookTitle = bookName ? `${bookName} - ${translate('unlock')}` : null;
              const typeKey = TYPE_LABEL_KEYS[log.type];
              const rowTitle =
                bookTitle || line1 || (typeKey ? translate(typeKey) : log.type);
              const rowNote = line2 || log.source;
              return (
              <View key={log.id} style={styles.row}>
                <View style={styles.left}>
                  <Text style={[styles.rowTitle, { fontSize: ms(15) }]}>
                    {rowTitle}
                  </Text>
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

  topBar: {
    width: '100%',
    paddingHorizontal: 10,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
  },
  eyeIcon: { width: 40, height: 40 },

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
  date: { color: '#a6afba', fontSize: 12, marginTop: 6 },

  right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  amount: { fontWeight: '800', fontSize: 18, color: '#ffffff' },
  plus: { color: '#ffffff' },
  minus: { color: '#ffffff' },
  coinMini: { width: 18, height: 18 },
});
