// app/screens/ShopScreen.tsx
import React, { useMemo, useEffect, useState, useRef } from 'react';
import {
  SafeAreaView, View, Text, StyleSheet, Image, ScrollView, Pressable, ActivityIndicator, Platform, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import routes from '../navigations/routes';
import PackCard, { PackItem } from '../components/Purchase/PackCard';
import { useIAP } from '../hook/useIAP';
import useResponsive from '../hook/useResponsive';
import { type ProductId } from '../services/iapService';
import { useCoins } from '../store/coinContext';
import { getCoinPacks, type CoinPack } from '../config/shopApiClient';

const RIGHT_COLORS = ['#F2D4AE', '#F4B86F', '#F3A55D', '#F18F52', '#EF7D47', '#EA6A3E'];

// 從 title 中提取純名稱（去掉括號和描述）
function extractProductName(title: string): string {
  if (!title) return '';
  // 去掉所有括號及其內容（包括中文括號和英文括號）
  // 例如 "尊爵贊助包 (Premium Support Pack)" -> "尊爵贊助包"
  // 例如 "尊爵贊助包（Premium Support Pack）" -> "尊爵贊助包"
  let name = title
    .replace(/\([^)]*\)/g, '')  // 去掉英文括號及其內容
    .replace(/（[^）]*）/g, '')  // 去掉中文括號及其內容
    .replace(/[()（）]/g, '')   // 去掉所有殘留的括號字符
    .trim();
  // 去掉可能的其他描述文字（如果還有其他格式）
  // 例如 "尊爵贊助包 - Description" -> "尊爵贊助包"
  name = name.split(' - ')[0].split(' – ')[0].split(' — ')[0].trim();
  return name;
}

export default function ShopScreen() {
  const navigation = useNavigation();
  const { products, isLoading: isIAPLoading, isPurchasing, purchaseProduct, error, refreshProducts } = useIAP();
  const { coins } = useCoins();
  const [coinPacks, setCoinPacks] = useState<CoinPack[]>([]);
  const [isLoadingCoinPacks, setIsLoadingCoinPacks] = useState(true);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const hasAlertedBackendError = useRef(false);
  const hasAlertedIAPError = useRef(false);

  // 根據平台獲取對應的平台名稱和平台代碼
  const platformName = Platform.OS === 'ios' ? 'App Store' : 'Google Play';
  const platformCode: 'GOOGLE' | 'APPLE' = Platform.OS === 'ios' ? 'APPLE' : 'GOOGLE';

  const loadCoinPacks = React.useCallback(async () => {
    try {
      setIsLoadingCoinPacks(true);
      setBackendError(null);
      console.log('[ShopScreen] 階段 1：開始從後端取得金幣包...');
      const packs = await getCoinPacks();
      console.log('[ShopScreen] 階段 1 ✓ 後端回傳金幣包數量:', packs.length);
      const filteredPacks = packs.filter(pack => pack.platform === platformCode);
      console.log('[ShopScreen] 階段 1 ✓ 過濾後本平台（', platformCode, '）金幣包數量:', filteredPacks.length);
      setCoinPacks(filteredPacks);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[ShopScreen] 階段 1 ✗ 取得後端金幣包失敗:', msg);
      setBackendError(msg);
      setCoinPacks([]);
      if (!hasAlertedBackendError.current) {
        hasAlertedBackendError.current = true;
        Alert.alert('後端金幣包取得失敗', `階段 1（後端）失敗：${msg}`);
      }
    } finally {
      setIsLoadingCoinPacks(false);
    }
  }, [platformCode]);

  useEffect(() => {
    loadCoinPacks();
  }, [loadCoinPacks, refreshKey]);

  // IAP 錯誤時跳出 Alert（僅在錯誤剛發生時提醒一次）
  useEffect(() => {
    if (error) {
      console.error('[ShopScreen] 階段 2（平台）錯誤:', error.message);
      if (!hasAlertedIAPError.current) {
        hasAlertedIAPError.current = true;
        Alert.alert('載入商品失敗', error.message);
      }
    } else {
      hasAlertedIAPError.current = false;
    }
  }, [error]);

  // 後端成功後重置後端錯誤 Alert 標記，以便下次失敗可再彈
  useEffect(() => {
    if (!backendError) hasAlertedBackendError.current = false;
  }, [backendError]);

  // 將 IAP 商品轉換為 PackItem 格式，並合併 API 資料
  const packsWithPrice = useMemo(() => {
    const productIdKey = (p: typeof products[0]) => (p as any).productId ?? p.id;
    console.log('[ShopScreen] packsWithPrice 計算: 平台=', platformCode, '| IAP 商品數=', products.length, '| 後端金幣包數=', coinPacks.length);
    if (coinPacks.length > 0) {
      console.log('[ShopScreen] 後端金幣包 productId 列表:', coinPacks.map(p => p.productId));
    }
    if (products.length > 0) {
      console.log('[ShopScreen] IAP 商品 id 列表:', products.map(p => productIdKey(p)));
    }

    return products.map((product, index) => {
      const pid = productIdKey(product);
      // 使用 IAP 的價格（優先使用 displayPrice，否則使用 price）
      const price = product.displayPrice
        ? parseFloat(product.displayPrice.replace(/[^0-9.]/g, ''))
        : (product.price || 0);

      // 從 API 資料中查找對應的金幣包資料（比對後端 productId 與平台商品 id）
      const coinPackData = coinPacks.find(pack => pack.productId === pid);
      const hasMatch = !!coinPackData;
      if (!hasMatch && coinPacks.length > 0) {
        console.warn('[ShopScreen] 未匹配到後端金幣包 productId=', pid, '（請確認後端 APPLE 金幣包的 productId 與 App Store Connect 一致）');
      }

      const pack = {
        id: `${pid}`,
        title: product.title, // 平台顯示名稱（多國語系）
        name: extractProductName(product.title) || product.title, // 僅用平台產品名稱，不用後端回傳
        coins: coinPackData?.amount ?? 0, // 從 API 獲取 amount，若無則 0（PackCard 有 fallback）
        bonus: coinPackData?.bonusAmount ?? 0, // 從 API 獲取 bonusAmount，若無則 0
        priceUsd: price, // 使用 IAP 的價格
        productId: pid as ProductId,
        isAvailable: true, // IAP 商品已載入，標記為可用
      } as PackItem & { productId?: ProductId; isAvailable?: boolean };

      console.log(`[ShopScreen] 商品 ${index + 1}: id=${pack.id} coins=${pack.coins} bonus=${pack.bonus} priceUsd=${pack.priceUsd} 後端匹配=${hasMatch}`);
      return pack;
    });
  }, [products, coinPacks, platformCode]);

  // 無商品時顯示的具體原因（哪一階段沒有資料）
  const emptyReason = useMemo(() => {
    if (products.length > 0) return null;
    const parts: string[] = [];
    if (backendError) {
      parts.push(`階段 1（後端）：取得金幣包失敗 — ${backendError}`);
    } else if (coinPacks.length === 0) {
      parts.push(`階段 1（後端）：本平台（${platformCode}）金幣包數量為 0`);
    } else {
      parts.push(`階段 1（後端）：已取得 ${coinPacks.length} 筆金幣包`);
    }
    parts.push(`階段 2（${platformName}）：回傳商品數為 0，請檢查商品 ID 是否與後台一致`);
    return parts.join('\n');
  }, [products.length, coinPacks.length, platformCode, platformName, backendError]);

  // 無商品時寫入一筆流程 log，方便對照
  useEffect(() => {
    if (!isIAPLoading && !error && packsWithPrice.length === 0 && emptyReason) {
      console.log('[ShopScreen] 暫無可用商品 — 原因：', emptyReason.replace(/\n/g, ' | '));
    }
  }, [isIAPLoading, error, packsWithPrice.length, emptyReason]);

  const handlePressPack = async (p: PackItem & { productId?: ProductId; isAvailable?: boolean }) => {
    if (!p.productId) {
      console.warn('[ShopScreen] 找不到對應的商品 ID:', p.id);
      Alert.alert('操作失敗', '找不到對應的商品 ID');
      return;
    }

    if (!p.isAvailable) {
      console.warn('[ShopScreen] 商品尚未載入或不可用:', p.productId);
      Alert.alert('無法購買', '商品尚未載入或不可用');
      return;
    }

    try {
      await purchaseProduct(p.productId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      console.error('[ShopScreen] 購買失敗:', msg);
      Alert.alert('購買失敗', msg);
    }
  };

  const { isTablet, maxContentWidth, horizontalPadding, scale } = useResponsive();
  const iconSize = Math.round(32 * scale);
  const TITLE_TOP_PADDING = 56;

  return (
    <SafeAreaView style={styles.safe}>
      <Pressable
        onPress={() => navigation.navigate(routes.MAIN as never)}
        hitSlop={8}
        style={[styles.leftIcon, { top: 8, left: horizontalPadding }]}
      >
        <Image
          source={require('../../assets/blueeye.png')}
          style={[styles.leftIconImage, { width: iconSize, height: iconSize }]}
          resizeMode="contain"
        />
      </Pressable>

      <Pressable
        onPress={() => navigation.navigate(routes.PROFILE as never)}
        hitSlop={8}
        style={[styles.profileBtn, { top: 8, right: horizontalPadding }]}
      >
        <Image style={[styles.profileIcon, { width: iconSize, height: iconSize, borderRadius: iconSize / 2 }]} source={require('../../assets/profile.png')} />
      </Pressable>

      <View style={[styles.contentWrap, isTablet && { maxWidth: maxContentWidth, alignSelf: 'center', width: '100%', paddingHorizontal: horizontalPadding }]}>
      <View style={[styles.headerRow, { paddingTop: TITLE_TOP_PADDING, paddingBottom: 18 }]}>
        <Text style={styles.title}>商城</Text>
        <View style={styles.balanceBox}>
          <Image style={styles.coin} source={require('../../assets/coin.png')} />
          <Text style={styles.balanceText}>{coins}</Text>
        </View>
      </View>

      {isIAPLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f0ad57" />
          <Text style={styles.loadingText}>載入商品中...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>載入商品失敗</Text>
          <Text style={styles.errorMessage}>{error.message}</Text>
          <Text style={styles.errorHint}>
            {error.message.includes('模擬器') 
              ? Platform.OS === 'ios' 
                ? '請在真實設備上測試 App Store 內購功能'
                : '請在真實設備上測試 Google Play 內購功能'
              : error.message.includes('Google Play 服務')
              ? '請確保設備已安裝並更新 Google Play 服務'
              : error.message.includes('App Store') || error.message.includes('App Store Connect')
              ? Platform.OS === 'ios'
                ? '請確保已登入 App Store 帳號並檢查 App Store Connect 配置'
                : '請檢查網絡連接和 API 服務器狀態'
              : error.message.includes('無法從伺服器獲取')
              ? '請檢查網絡連接和 API 服務器狀態'
              : '請查看控制台日誌獲取詳細錯誤資訊'}
          </Text>
          <Pressable
            onPress={refreshProducts}
            style={styles.retryButton}
          >
            <Text style={styles.retryButtonText}>重新載入</Text>
          </Pressable>
          <Text style={styles.errorDebug}>
            詳細錯誤請查看控制台日誌（搜尋 [useIAP] 或 [iapService]）
          </Text>
        </View>
      ) : packsWithPrice.length === 0 ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>暫無可用商品</Text>
          <Text style={styles.emptyReasonTitle}>目前沒有資料的階段：</Text>
          <Text style={styles.emptyReasonText}>{emptyReason ?? '—'}</Text>
          <Pressable
            onPress={() => {
              setRefreshKey(k => k + 1);
              refreshProducts();
            }}
            style={styles.retryButton}
          >
            <Text style={styles.retryButtonText}>重新載入</Text>
          </Pressable>
          <Text style={styles.errorDebug}>
            控制台關鍵字：[ShopScreen]、[useIAP]、[iapService]
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {isIAPLoading && (
            <View style={styles.iapLoadingHint}>
              <Text style={styles.iapLoadingText}>正在載入商店價格資訊...</Text>
            </View>
          )}
          {packsWithPrice.map((p, i) => (
            <PackCard
              key={p.id}
              data={p}
              onPress={() => handlePressPack(p)}
              rightColor={RIGHT_COLORS[i % RIGHT_COLORS.length]}
              disabled={isPurchasing || !p.isAvailable}
            />
          ))}
        </ScrollView>
      )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#2b2f33' },

  leftIcon: {
    position: 'absolute',
    zIndex: 10,
  },
  leftIconImage: {},

  profileBtn: {
    position: 'absolute',
    zIndex: 10,
    padding: 6,
  },
  profileIcon: {},

  contentWrap: {
    flex: 1,
  },

  // --- 標題區（上下留空；確保在 icons 下方）---
  headerRow: {
    alignItems: 'center',
    gap: 6,
  },
  title: { color: '#e7eef6', fontWeight: '700', fontSize: 18 },
  balanceBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  coin: { width: 18, height: 18 },
  balanceText: {color: "#f0ad57", fontWeight: '700' },

  list: { paddingHorizontal: 12, paddingBottom: 24, gap: 16 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#e7eef6',
    fontSize: 16,
  },
  loadingHint: {
    color: '#a0a0a0',
    fontSize: 14,
    marginTop: 8,
  },
  emptyReasonTitle: {
    color: '#f0ad57',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  emptyReasonText: {
    color: '#e7eef6',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
    paddingHorizontal: 16,
  },
  iapLoadingHint: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(240, 173, 87, 0.1)',
    borderRadius: 8,
    alignItems: 'center',
  },
  iapLoadingText: {
    color: '#f0ad57',
    fontSize: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  errorTitle: {
    color: '#ff6b6b',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  errorMessage: {
    color: '#e7eef6',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  errorHint: {
    color: '#a0a0a0',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  errorDebug: {
    color: '#888',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#f0ad57',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
