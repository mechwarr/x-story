// app/screens/ShopScreen.tsx
import React, { useMemo, useEffect, useState } from 'react';
import {
  SafeAreaView, View, Text, StyleSheet, Image, ScrollView, Pressable, ActivityIndicator, Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import routes from '../navigations/routes';
import PackCard, { PackItem } from '../components/Purchase/PackCard';
import { useIAP } from '../hook/useIAP';
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
  const { coins, refreshCoins } = useCoins();
  const [coinPacks, setCoinPacks] = useState<CoinPack[]>([]);
  const [isLoadingCoinPacks, setIsLoadingCoinPacks] = useState(true);
  
  // 根據平台獲取對應的平台名稱和平台代碼
  const platformName = Platform.OS === 'ios' ? 'App Store' : 'Google Play';
  const platformCode: 'GOOGLE' | 'APPLE' = Platform.OS === 'ios' ? 'APPLE' : 'GOOGLE';

  // 當畫面獲得焦點時，刷新金幣餘額
  useFocusEffect(
    React.useCallback(() => {
      refreshCoins();
    }, [refreshCoins])
  );

  // 從 API 獲取金幣包資料
  useEffect(() => {
    const loadCoinPacks = async () => {
      try {
        setIsLoadingCoinPacks(true);
        console.log('[ShopScreen] 開始從 API 獲取金幣包資料...');
        const packs = await getCoinPacks();
        console.log('[ShopScreen] ✓ 成功獲取金幣包資料，數量:', packs.length);
        // 根據當前平台過濾資料
        const filteredPacks = packs.filter(pack => pack.platform === platformCode);
        console.log('[ShopScreen] 過濾後的金幣包數量（平台:', platformCode, '）:', filteredPacks.length);
        setCoinPacks(filteredPacks);
      } catch (error) {
        console.error('[ShopScreen] 獲取金幣包資料失敗:', error);
        setCoinPacks([]);
      } finally {
        setIsLoadingCoinPacks(false);
      }
    };

    loadCoinPacks();
  }, [platformCode]);

  // 將 IAP 商品轉換為 PackItem 格式，並合併 API 資料
  const packsWithPrice = useMemo(() => {
    return products.map((product) => {
      // 使用 IAP 的價格（優先使用 displayPrice，否則使用 price）
      const price = product.displayPrice
        ? parseFloat(product.displayPrice.replace(/[^0-9.]/g, ''))
        : (product.price || 0);

      // 從 API 資料中查找對應的金幣包資料
      const coinPackData = coinPacks.find(pack => pack.productId === product.id);
      
      return {
        id: `iap-${product.id}`,
        title: product.title, // 平台顯示名稱（多國語系）
        name: extractProductName(product.title) || product.title, // 僅用平台產品名稱，不用後端回傳
        coins: coinPackData?.amount || 0, // 從 API 獲取 amount，如果沒有則為 0（PackCard 會使用 fallback）
        bonus: coinPackData?.bonusAmount || 0, // 從 API 獲取 bonusAmount，如果沒有則為 0（PackCard 會使用 fallback）
        priceUsd: price, // 使用 IAP 的價格
        productId: product.id as ProductId,
        isAvailable: true, // IAP 商品已載入，標記為可用
      } as PackItem & { productId?: ProductId; isAvailable?: boolean };
    });
  }, [products, coinPacks]);

  const handlePressPack = async (p: PackItem & { productId?: ProductId; isAvailable?: boolean }) => {
    if (!p.productId) {
      console.warn('找不到對應的商品 ID:', p.id);
      return;
    }

    if (!p.isAvailable) {
      console.warn('商品尚未載入或不可用:', p.productId);
      return;
    }

    try {
      await purchaseProduct(p.productId);
    } catch (error) {
      console.error('購買失敗:', error);
    }
  };

  // icon 視覺高度（icon 32 + 上下餘量）：讓標題落在 icons 底下
  const TITLE_TOP_PADDING = 56; // 你也可微調成 52~64

  return (
    <SafeAreaView style={styles.safe}>
      {/* 左上角 blueeye（純展示，不占版面高度） */}
      <Image
        source={require('../../assets/blueeye.png')}
        style={[styles.leftIcon, { top: 8 }]}
        resizeMode="contain"
      />

      {/* 右上角 Profile（點擊跳個人頁） */}
      <Pressable
        onPress={() => navigation.navigate(routes.PROFILE as never)}
        hitSlop={8}
        style={[styles.profileBtn, { top: 8 }]}
      >
        <Image style={styles.profileIcon} source={require('../../assets/profile.png')} />
      </Pressable>

      {/* 標題 + 餘額（上下留空；且位於 icons 之下） */}
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
          <Text style={styles.loadingHint}>
            可能原因：
          </Text>
          <Text style={styles.loadingHint}>
            1. 後端 API 未返回商品列表
          </Text>
          <Text style={styles.loadingHint}>
            2. 後端返回的商品中沒有 {platformName} 平台商品
          </Text>
          <Text style={styles.loadingHint}>
            3. {platformName} 無法獲取商品詳情（請檢查 {Platform.OS === 'ios' ? 'App Store Connect' : 'Google Play Console'} 配置）
          </Text>
          <Text style={styles.errorDebug}>
            詳細診斷請查看控制台日誌（搜尋 [useIAP] 或 [iapService]）
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#2b2f33' },

  // --- 左上角 blueeye（絕對定位，不佔版面高度）---
  leftIcon: {
    position: 'absolute',
    left: 12,
    width: 32,
    height: 32,
    zIndex: 10,
  },

  // --- 右上角 Profile（絕對定位）---
  profileBtn: {
    position: 'absolute',
    right: 12,
    zIndex: 10,
    padding: 6, // 擴大可點範圍
  },
  profileIcon: { width: 32, height: 32, borderRadius: 16 },

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
