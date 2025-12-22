// app/screens/ShopScreen.tsx
import React, { useMemo } from 'react';
import {
  SafeAreaView, View, Text, StyleSheet, Image, ScrollView, Pressable, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import routes from '../navigations/routes';
import PackCard, { PackItem } from '../components/Purchase/PackCard';
import { useIAP } from '../hook/useIAP';
import { type ProductId } from '../services/iapService';

const RIGHT_COLORS = ['#F2D4AE', '#F4B86F', '#F3A55D', '#F18F52', '#EF7D47', '#EA6A3E'];

export default function ShopScreen() {
  const navigation = useNavigation();
  const { products, isLoading: isIAPLoading, isPurchasing, purchaseProduct, error } = useIAP();

  // 將 IAP 商品轉換為 PackItem 格式
  // 注意：coins 和 bonus 資訊應從後端 API 獲取，目前暫時設為 0
  const packsWithPrice = useMemo(() => {
    return products.map((product) => {
      // 使用 IAP 的價格（優先使用 displayPrice，否則使用 price）
      const price = product.displayPrice
        ? parseFloat(product.displayPrice.replace(/[^0-9.]/g, ''))
        : (product.price || 0);

      return {
        id: `iap-${product.id}`,
        title: product.title, // 使用 IAP 商品的標題
        coins: 0, // TODO: 從後端 API 獲取（CoinPack 接口需要擴展）
        bonus: 0, // TODO: 從後端 API 獲取（CoinPack 接口需要擴展）
        priceUsd: price, // 使用 IAP 的價格
        productId: product.id as ProductId,
        isAvailable: true, // IAP 商品已載入，標記為可用
      } as PackItem & { productId?: ProductId; isAvailable?: boolean };
    });
  }, [products]);

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
              ? '請在真實設備上測試 Google Play 內購功能'
              : error.message.includes('Google Play 服務')
              ? '請確保設備已安裝並更新 Google Play 服務'
              : error.message.includes('無法從伺服器獲取')
              ? '請檢查網絡連接和 API 服務器狀態'
              : '請查看控制台日誌獲取詳細錯誤資訊'}
          </Text>
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
            2. 後端返回的商品中沒有 Google Play 平台商品
          </Text>
          <Text style={styles.loadingHint}>
            3. Google Play 無法獲取商品詳情（請檢查 Google Play Console 配置）
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
});
