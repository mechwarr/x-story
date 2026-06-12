// app/screens/PurchaseHistoryScreen.tsx
import React, { useState } from 'react';
import {
  SafeAreaView, View, Text, StyleSheet, ScrollView, Image, Pressable, Platform, ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import routes from '../navigations/routes';
import { iapService, PRODUCT_IDS } from '../services/iapService';
import type { IapReceipt } from '../config/shopApiClient';
import useResponsive from '../hook/useResponsive';

type Purchase = {
  id: string;          // 收據編號
  amountNTD: number;   // 交易額度（NTD）- 暫時顯示為 0，需要從後端獲取價格
  productName: string; // 交易商品名稱
  purchasedAt: string; // 交易時間（yyyy.MM.dd HH:mm）
  totalCoins: number;  // 總金幣數
  baseCoins: number;   // 基礎金幣
  bonusCoins: number;  // 贈送金幣
  status: string;      // 狀態
};

// 格式化日期時間：從 ISO 8601 轉換為 yyyy.MM.dd HH:mm
function formatDateTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}.${month}.${day} ${hours}:${minutes}`;
  } catch (error) {
    return isoString;
  }
}

// 將 IAP 收據轉換為 UI 顯示格式（僅用平台顯示名稱）
function convertReceiptToPurchase(receipt: IapReceipt): Purchase {
  const productName = iapService.getProductName(receipt.productId);

  return {
    id: receipt.receiptId,
    amountNTD: 0, // TODO: 需要從後端獲取實際價格，或根據 productId 查詢
    productName,
    purchasedAt: formatDateTime(receipt.createdAt),
    totalCoins: receipt.totalCoins,
    baseCoins: receipt.baseCoins,
    bonusCoins: receipt.bonusCoins,
    status: receipt.status,
  };
}

export default function PurchaseHistoryScreen({ embedded = false }: { embedded?: boolean }) {
  const Wrapper: any = embedded ? View : SafeAreaView;
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { isTablet, maxContentWidth, ms } = useResponsive();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 載入收據列表（先載入 IAP 產品列表以取得平台顯示名稱）
  const loadReceipts = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 先載入平台產品列表，讓 getProductName 能回傳平台顯示名稱
      try {
        await iapService.initialize();
        await iapService.getProductList(Object.values(PRODUCT_IDS));
      } catch (e) {
        // IAP 未就緒時仍可顯示收據，名稱會顯示 productId
      }

      const receipts = await iapService.getIapReceipts();

      receipts.sort((a, b) => {
        const dateA = new Date(a.createdAt);
        const dateB = new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });

      const convertedPurchases = receipts.map(convertReceiptToPurchase);
      setPurchases(convertedPurchases);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '載入購買記錄失敗';
      console.error('[PurchaseHistoryScreen] 載入收據失敗:', err);
      setError(errorMessage);
      setPurchases([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 當畫面獲得焦點時重新載入
  useFocusEffect(
    React.useCallback(() => {
      loadReceipts();
    }, [])
  );

  return (
    <Wrapper style={styles.safe}>
      {/* 右上角 Profile（取代 AppHeader；embedded 時不顯示） */}
      {!embedded && (
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => navigation.navigate(routes.PROFILE as never)} hitSlop={8}>
            <Image style={[styles.profileIcon, { width: ms(32), height: ms(32), borderRadius: ms(16) }]} source={require('../../assets/profile.png')} />
          </Pressable>
        </View>
      )}

      <View style={styles.header}>
        <Text style={[styles.title, { fontSize: ms(18) }]}>購買記錄</Text>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#F7BA7E" />
          <Text style={styles.loadingText}>載入中...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>載入失敗</Text>
          <Text style={styles.errorDetail}>{error}</Text>
          <Pressable onPress={loadReceipts} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>重試</Text>
          </Pressable>
        </View>
      ) : purchases.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>暫無購買記錄</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.list, isTablet && { maxWidth: maxContentWidth, alignSelf: 'center', width: '100%' }]}>
          {purchases.map((p) => (
            <View key={p.id} style={styles.card}>
              <Row label="訂單編號" value={p.id} mono />
              {p.amountNTD > 0 && (
                <Row label="交易額度 (NTD)" value={`$${p.amountNTD}`} strong />
              )}
              <Row label="交易商品名稱" value={p.productName} />
              <Row label="交易時間" value={p.purchasedAt} />
            </View>
          ))}
        </ScrollView>
      )}
    </Wrapper>
  );
}

function Row({ label, value, strong, mono }: { label: string; value: string; strong?: boolean; mono?: boolean }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text
        style={[rowStyles.value, strong && rowStyles.strong, mono && rowStyles.mono]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#2b2f33' },

  // 右上角 Profile 容器
  topBar: {
    width: '100%',
    paddingHorizontal: 10,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
  },
  profileIcon: { width: 32, height: 32, borderRadius: 16 },

  header: { alignItems: 'center', paddingTop: 8, paddingBottom: 6 },
  title: { color: '#e7eef6', fontWeight: '700', fontSize: 18 },
  list: { paddingHorizontal: 16, paddingVertical: 8, gap: 12 },
  card: {
    backgroundColor: '#34383d',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#9aa3ad',
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorDetail: {
    color: '#9aa3ad',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 32,
  },
  retryButton: {
    backgroundColor: '#F7BA7E',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#2b2f33',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    color: '#9aa3ad',
    fontSize: 14,
  },
});

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  label: { color: '#9aa3ad', width: 110, fontSize: 13 },
  value: { color: '#ffffff', flex: 1, fontSize: 15 },
  strong: { fontWeight: '800' },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }) as any },
});
