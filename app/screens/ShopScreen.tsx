// app/screens/ShopScreen.tsx
import React, { useMemo, useEffect, useState } from 'react';
import {
  SafeAreaView, View, Text, StyleSheet, Image, ScrollView, Pressable, ActivityIndicator, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import routes from '../navigations/routes';
import PackCard, { PackItem } from '../components/Purchase/PackCard';
import { useIAP } from '../hook/useIAP';
import { PRODUCT_IDS, type ProductId } from '../services/iapService';
import { getCoinPacks, type CoinPack } from '../config/shopApiClient';

const RIGHT_COLORS = ['#F2D4AE', '#F4B86F', '#F3A55D', '#F18F52', '#EF7D47', '#EA6A3E'];

export default function ShopScreen() {
  const navigation = useNavigation();
  const { products, isLoading: isIAPLoading, isPurchasing, purchaseProduct } = useIAP();
  const [coinPacks, setCoinPacks] = useState<CoinPack[]>([]);
  const [isLoadingPacks, setIsLoadingPacks] = useState(true);

  // 從後端 API 獲取金幣包列表
  useEffect(() => {
    const fetchCoinPacks = async () => {
      try {
        setIsLoadingPacks(true);
        const packs = await getCoinPacks();
        setCoinPacks(packs);
      } catch (error) {
        console.error('獲取金幣包列表失敗:', error);
      } finally {
        setIsLoadingPacks(false);
      }
    };

    fetchCoinPacks();
  }, []);

  // 將後端 API 的金幣包轉換為 PackItem 格式
  const packsWithPrice = useMemo(() => {
    const currentPlatform = Platform.OS === 'ios' ? 'APPLE' : 'GOOGLE';
    
    // 過濾出當前平台的金幣包
    const filteredPacks = coinPacks.filter(pack => pack.platform === currentPlatform);
    
    return filteredPacks.map((pack, index) => {
      // 嘗試從 IAP 商品中找到對應的商品（如果有的話）
      // 這裡可以根據實際需求調整匹配邏輯
      const productId = Object.values(PRODUCT_IDS)[index] as ProductId | undefined;
      const product = productId ? products.find((p: any) => p.productId === productId) : undefined;
      
      // 解析金幣數量（從 name 中提取，例如 "100 Coins" -> 100）
      const coinsMatch = pack.name.match(/(\d+)\s*Coins?/i);
      const coins = coinsMatch ? parseInt(coinsMatch[1], 10) : 0;
      
      // 如果有從商店獲取的價格，使用商店價格；否則使用 API 返回的價格
      const price = product && (product as any).localizedPrice 
        ? parseFloat((product as any).localizedPrice.replace(/[^0-9.]/g, ''))
        : pack.price;

      return {
        id: `pack-${pack.id}`,
        title: pack.name,
        coins: coins,
        bonus: 0, // 可以根據實際需求調整
        priceUsd: price,
        productId,
        isAvailable: !!product || true, // 如果沒有 IAP 商品，仍然顯示
      } as PackItem & { productId?: ProductId; isAvailable?: boolean };
    });
  }, [coinPacks, products]);

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
          <Text style={styles.balanceText}>50</Text>
        </View>
      </View>

      {isLoadingPacks || isIAPLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f0ad57" />
          <Text style={styles.loadingText}>載入商品中...</Text>
        </View>
      ) : packsWithPrice.length === 0 ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>暫無可用商品</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
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
});
