// app/screens/PurchaseHistoryScreen.tsx
import React, { useState } from 'react';
import {
  SafeAreaView, View, Text, StyleSheet, ScrollView, Platform, ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import routes from '../navigations/routes';
import { iapService } from '../services/iapService';
import { fetchCurrentPlatformCatalog, buildBackendNameMap } from '../utils/iapCatalog';
import type { IapReceipt } from '../config/shopApiClient';
import useResponsive from '../hook/useResponsive';
import ScreenTopBar from '../components/ScreenTopBar';
import NoDataRetryView from '../components/NoDataRetryView';
import { translate } from '../i18n/i18n';
import { formatServerDateTime, toEpochMillis } from '../utils/datetime';

type Purchase = {
  id: string;          // 收據編號
  priceText: string;   // 交易金額（平台顯示價格，含幣別符號、已去地區前綴，例如 "$170"）
  productName: string; // 交易商品名稱
  purchasedAt: string; // 交易時間（yyyy.MM.dd HH:mm）
  totalCoins: number;  // 總金幣數
  baseCoins: number;   // 基礎金幣
  bonusCoins: number;  // 贈送金幣
  status: string;      // 狀態
};

// 格式化日期時間：後端 UTC 時間戳 → 裝置時區的 yyyy.MM.dd HH:mm（台北為 UTC+8）
function formatDateTime(isoString: string): string {
  return formatServerDateTime(isoString);
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

// 將 IAP 收據轉換為 UI 顯示格式（優先平台當地語系名稱，退回後端名稱）
function convertReceiptToPurchase(receipt: IapReceipt, backendNames: Record<string, string>): Purchase {
  const productName = resolveProductName(receipt.productId, backendNames);
  // 交易金額：依 productId 從雙平台取得真實貨幣價格（含幣別符號）
  const priceText = iapService.getProductDisplayPrice(receipt.productId);

  return {
    id: receipt.receiptId,
    priceText,
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
  const { isTablet, maxContentWidth, ms } = useResponsive();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  // 載入收據列表（先載入 IAP 產品列表以取得平台顯示名稱）
  const loadReceipts = async () => {
    try {
      setIsLoading(true);
      setLoadFailed(false);

      // 先依後端金幣包載入平台產品列表，讓 getProductName／getProductDisplayPrice 有資料可查。
      // 商品清單來自 api/coin-packs，後台新增品項的收據也能正確顯示名稱與價格。
      let backendNames: Record<string, string> = {};
      try {
        const catalog = await fetchCurrentPlatformCatalog();
        backendNames = buildBackendNameMap(catalog.packs);
        await iapService.initialize();
        await iapService.getProductList(catalog.skus);
      } catch (e) {
        // IAP／後端未就緒時仍可顯示收據，名稱會退回 productId
      }

      const receipts = await iapService.getIapReceipts();

      // 由新到舊。解析失敗者（null）視為最舊，避免 NaN 讓排序結果不穩定
      receipts.sort((a, b) => (toEpochMillis(b.createdAt) ?? 0) - (toEpochMillis(a.createdAt) ?? 0));

      const convertedPurchases = receipts.map((r) => convertReceiptToPurchase(r, backendNames));
      setPurchases(convertedPurchases);
    } catch (err) {
      // 原始錯誤只留 console；對使用者一律顯示內建翻譯（版面與個人資料錯誤頁一致）
      console.error('[PurchaseHistoryScreen] 載入收據失敗:', err);
      setLoadFailed(true);
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

  // 取不到交易紀錄：不畫標題與列表，整頁改為共用「沒有資料」狀態（內嵌於紀錄分頁時不重複畫頂欄）
  if (!isLoading && loadFailed) {
    return (
      <Wrapper style={styles.safe}>
        <NoDataRetryView
          message={translate('purchaseHistoryLoadFailedMessage')}
          onRetry={loadReceipts}
          onEyePress={() => navigation.navigate(routes.MAIN as never)}
          showTopBar={!embedded}
        />
      </Wrapper>
    );
  }

  return (
    <Wrapper style={styles.safe}>
      {/* 右上角 Profile（取代 AppHeader；embedded 時不顯示） */}
      {!embedded && (
        <ScreenTopBar onProfilePress={() => navigation.navigate(routes.PROFILE as never)} />
      )}

      <View style={styles.header}>
        <Text style={[styles.title, { fontSize: ms(18) }]}>{translate('purchaseHistoryTitle')}</Text>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#F7BA7E" />
          <Text style={styles.loadingText}>{translate('profileLoading')}</Text>
        </View>
      ) : purchases.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>{translate('purchaseHistoryEmpty')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.list, isTablet && { maxWidth: maxContentWidth, alignSelf: 'center', width: '100%' }]}>
          {purchases.map((p) => (
            <View key={p.id} style={styles.card}>
              <Row label={translate('orderId')} value={p.id} mono fit />
              {p.priceText ? (
                <Row label={translate('transactionAmount')} value={p.priceText} strong />
              ) : null}
              <Row label={translate('transactionProductName')} value={p.productName} />
              <Row label={translate('transactionTime')} value={p.purchasedAt} />
            </View>
          ))}
        </ScrollView>
      )}
    </Wrapper>
  );
}

function Row({ label, value, strong, mono, fit }: { label: string; value: string; strong?: boolean; mono?: boolean; fit?: boolean }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text
        style={[rowStyles.value, strong && rowStyles.strong, mono && rowStyles.mono]}
        // fit：單行不換行，過長時自動縮小字體以完整顯示（不使用省略號截斷）
        numberOfLines={fit ? 1 : 2}
        adjustsFontSizeToFit={fit}
        minimumFontScale={fit ? 0.3 : undefined}
        ellipsizeMode={fit ? 'clip' : undefined}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#2b2f33' },

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
