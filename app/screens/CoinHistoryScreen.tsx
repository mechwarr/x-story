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

import { getCoinLedger, CoinLedgerItem } from '../config/userApiClient';
import { useCoins } from '../store/coinContext';
import { PRODUCT_NAMES } from '../services/iapService';

/** 後端 type 對應顯示文字（api/me/coins/ledger 的 type 欄位） */
const TYPE_LABELS: Record<string, string> = {
  IAP: '購買獲得',
  IAP_BONUS: '獎勵獲得',
  purchase: '購買獲得',
  bonus: '獎勵獲得',
  spent: '消費',
  refund: '退款',
  expired: '過期',
};

/**
 * 從 source 字串解析出第一行（產品名稱／BONUS）與第二行（ORDER 字串）。
 * source 格式範例: "ORDER:xxx|PROD:item_003" 或 "ORDER:xxx|PROD:BONUS" 或 "ORDER:xxx|PROD:item_003_BONUS"
 * 若 PROD 值含 '_BONUS'，則取對應的 item_xxx 平台名稱，第一行顯示為「平台名稱 BONUS」。
 */
function parseSourceDisplay(source: string): { line1: string; line2: string } {
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
        const platformName = PRODUCT_NAMES[baseId] ?? baseId;
        line1 = `${platformName} BONUS`;
      } else if (prodValue.toUpperCase() === 'BONUS') {
        line1 = 'BONUS';
      } else {
        line1 = PRODUCT_NAMES[prodValue] ?? prodValue;
      }
    }
  }
  return { line1, line2 };
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}.${m}.${day}`;
  } catch {
    return iso;
  }
}

export default function CoinHistoryScreen({ embedded = false }: { embedded?: boolean }) {
  const Wrapper: any = embedded ? View : SafeAreaView;
  const { coins: balance, refreshCoins } = useCoins();

  const [logs, setLogs] = useState<CoinLedgerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const logsRes = await getCoinLedger();
      setLogs(logsRes);
    } catch (e) {
      setError(e instanceof Error ? e.message : '載入失敗');
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
      <View style={styles.header}>
        <Text style={styles.title}>金幣紀錄</Text>
        {loading && !logs.length ? (
          <View style={styles.balanceRow}>
            <ActivityIndicator size="small" color="#f0ad57" />
          </View>
        ) : (
          <View style={styles.balanceRow}>
            <Image style={styles.coin} source={require('../../assets/coin.png')} />
            <Text style={styles.balanceText}>{balance}</Text>
          </View>
        )}
      </View>

      {error ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && (balance > 0 || logs.length > 0) ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color="#f0ad57" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {logs.length === 0 ? (
            <Text style={styles.emptyText}>尚無金幣紀錄</Text>
          ) : (
            logs.map((log) => {
              const { line1, line2 } = log.source ? parseSourceDisplay(log.source) : { line1: '', line2: '' };
              const rowTitle = line1 || (TYPE_LABELS[log.type] ?? log.type);
              const rowNote = line2 || log.source;
              return (
              <View key={log.id} style={styles.row}>
                <View style={styles.left}>
                  <Text style={styles.rowTitle}>
                    {rowTitle}
                  </Text>
                  {rowNote ? (
                    <Text style={styles.note} numberOfLines={1} ellipsizeMode="middle">
                      {rowNote}
                    </Text>
                  ) : null}
                  <Text style={styles.date}>{formatDate(log.createdAt)}</Text>
                </View>

                <View style={styles.right}>
                  <Text
                    style={[
                      styles.amount,
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
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  coin: { width: 18, height: 18 },
  balanceText: { color: '#f0ad57', fontWeight: '700' },

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
  amount: { fontWeight: '800', fontSize: 18 },
  plus: { color: '#B6F07B' },
  minus: { color: '#e9e9e9' },
  coinMini: { width: 18, height: 18 },
});
