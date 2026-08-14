// app/screens/ShopScreen.tsx
import React, { useMemo, useEffect, useRef } from 'react';
import {
  SafeAreaView, View, Text, StyleSheet, Image, ScrollView, Pressable, ActivityIndicator, Platform,
} from 'react-native';
import { showAlert } from "../components/CustomAlert";
import { useNavigation } from '@react-navigation/native';
import routes from '../navigations/routes';
import PackCard, {
  PackItem,
  PRICE_BOX_WIDTH,
  PRICE_BOX_PADDING,
  PRICE_LETTER_SPACING,
} from '../components/Purchase/PackCard';
import { useIAP } from '../hook/useIAP';
import useResponsive from '../hook/useResponsive';
import ScreenTopBar from '../components/ScreenTopBar';
import { type ProductId } from '../services/iapService';
import { useCoins } from '../store/coinContext';
import {
  currentPlatformCode,
  findPackForStoreProductId,
  storeSkuMatchesBackendProductId,
} from '../utils/iapCatalog';
import { extractProductName } from '../utils/productName';
import { translate } from '../i18n/i18n';

const RIGHT_COLORS = ['#F2D4AE', '#F4B86F', '#F3A55D', '#F18F52', '#EF7D47', '#EA6A3E'];

// 這些幣別的最小單位即為整數（無小數），商店回傳的價格字串若帶 .00 應去除
const zeroDecimalCurrencies = [
  'TWD', 'JPY', 'KRW', 'VND', 'CLP', 'PYG',
  'BIF', 'DJF', 'GNF', 'ISK', 'KMF', 'RWF',
  'UGX', 'VUV', 'XAF', 'XOF', 'XPF',
];

// 針對零小數幣別，去掉價格字串尾端的 .00（例：NT$150.00 -> NT$150）
function formatDisplayPrice(
  formattedPrice: string | undefined,
  currencyCode: string | undefined
): string | undefined {
  if (!formattedPrice) return formattedPrice;
  if (currencyCode && zeroDecimalCurrencies.includes(currencyCode.toUpperCase())) {
    // 僅去除「整數 .00 / ,00」尾綴（含歐式逗號小數）；若小數非全為 0（如 .50）則保留。
    // 後綴需為非數字到字串結尾，避免誤刪千分位（如 "1,000" 不受影響）。
    return formattedPrice.replace(/[.,]00(?=\D*$)/, '');
  }
  return formattedPrice;
}

const PRICE_MAX_FONT = 24;
const PRICE_MIN_FONT = 12;

// 粗估字串寬度（相對字級的倍率）：粗體數字約 0.6em、標點窄、大寫字母寬。
// 只用字數會失準——"NT$1,690" 與 "¥1980" 同樣 8/5 字，實際寬度差很多。
function estimateWidthRatio(text: string): number {
  let ratio = 0;
  for (const ch of text) {
    if (ch >= '0' && ch <= '9') ratio += 0.60;
    // 千分位／小數點與各式空白（部分語系價格用 nbsp 分隔，如 "1 234 €"）
    else if (/[.,'\s\u00a0\u202f]/.test(ch)) ratio += 0.30;
    else if (ch >= 'A' && ch <= 'Z') ratio += 0.70;
    else ratio += 0.62;                 // 幣別符號（$ ¥ ₩ € R$ …）
  }
  return ratio;
}

// 依同批價格中「估算最寬」的那筆決定共用字級：
// 全部卡片用同一字級，避免大額（字串較長）被縮小、看起來像鼓勵買小額；
// 同時保證最寬的那筆也塞得進固定寬度的價格區塊，不會被「…」截掉。
function sharedPriceFontSize(prices: string[]): number {
  const available = PRICE_BOX_WIDTH - PRICE_BOX_PADDING * 2;
  let size = PRICE_MAX_FONT;
  for (const price of prices) {
    const ratio = estimateWidthRatio(price);
    if (ratio <= 0) continue;
    // 扣掉字距佔用的寬度後，換算這筆最多能用多大的字
    const fit = Math.floor((available - price.length * PRICE_LETTER_SPACING) / ratio);
    size = Math.min(size, fit);
  }
  return Math.max(PRICE_MIN_FONT, size);
}

export default function ShopScreen() {
  const navigation = useNavigation();
  // 階段 1（後端金幣包）與階段 2（商店商品）都由 useIAP 一次取得，
  // 畫面不再自己呼叫 api/coin-packs，避免同一份清單被抓兩次而出現不一致。
  const {
    products,
    coinPacks,
    coinPacksError,
    catalogDiagnostics,
    isLoading: isShopLoading,
    isPurchasing,
    purchaseProduct,
    error,
    refreshProducts,
  } = useIAP();
  const { coins } = useCoins();
  const hasAlertedBackendError = useRef(false);
  const hasAlertedIAPError = useRef(false);

  // 根據平台獲取對應的平台名稱和平台代碼
  const platformName = Platform.OS === 'ios' ? 'App Store' : 'Google Play';
  const platformCode = currentPlatformCode;
  // 診斷資訊只在 Android 顯示於畫面（iOS 維持乾淨版面，log 仍照印）
  const coinPackDebugText = Platform.OS === 'ios' ? '' : catalogDiagnostics;

  // 後端金幣包取得失敗時跳出 Alert（僅 Android，且僅在錯誤剛發生時提醒一次）
  useEffect(() => {
    if (coinPacksError) {
      console.error('[ShopScreen] 階段 1（後端）錯誤:', coinPacksError);
      if (Platform.OS !== 'ios' && !hasAlertedBackendError.current) {
        hasAlertedBackendError.current = true;
        showAlert('後端金幣包取得失敗', `階段 1（後端）失敗：${coinPacksError}`);
      }
    } else {
      hasAlertedBackendError.current = false;
    }
  }, [coinPacksError]);

  // IAP 錯誤時跳出 Alert（僅在錯誤剛發生時提醒一次）
  useEffect(() => {
    if (error) {
      console.error('[ShopScreen] 階段 2（平台）錯誤:', error.message);
      if (!hasAlertedIAPError.current) {
        hasAlertedIAPError.current = true;
        showAlert(translate('loadProductsFailed'), error.message);
      }
    } else {
      hasAlertedIAPError.current = false;
    }
  }, [error]);

  // 合併：以「後端金幣包」為主體逐筆展開（已過濾 isActive、依 sortOrder 排序），
  // 再把商店回傳的名稱／價格併進來。任何一邊缺資料就整筆不顯示——
  // 寧可少一張卡，也不要出現金幣 0、沒有 BONUS、按下去也買不成的殘缺商品。
  const merged = useMemo(() => {
    const productIdKey = (p: typeof products[0]) => (p as any).productId ?? p.id;
    console.log('[ShopScreen] 合併計算: 平台=', platformCode, '| 後端金幣包數=', coinPacks.length, '| 商店商品數=', products.length);
    if (coinPacks.length > 0) {
      console.log('[ShopScreen] 後端金幣包 productId 列表:', coinPacks.map(p => p.productId));
    }
    if (products.length > 0) {
      console.log('[ShopScreen] 商店商品 id 列表:', products.map(p => productIdKey(p)));
    }

    const items: (PackItem & { productId?: ProductId; isAvailable?: boolean })[] = [];
    const skippedNoStoreProduct: string[] = []; // 後端有、但商店沒回傳（ID 不一致／未上架／未啟用）
    const skippedInvalidAmount: string[] = [];  // 後端金幣數異常（<= 0），視為未設定完成

    for (const pack of coinPacks) {
      const backendId = String(pack.productId ?? '').trim();

      // 商店尚未回傳這筆 → 拿不到當地語系名稱與真實價格，也無法 requestPurchase，直接不顯示
      const product = products.find((p) =>
        storeSkuMatchesBackendProductId(productIdKey(p), backendId)
      );
      if (!product) {
        skippedNoStoreProduct.push(backendId);
        console.warn(
          `[ShopScreen] 略過不顯示：後端 productId="${backendId}" 未出現在 ${platformName} 回傳清單`,
          `（請確認 ${platformName} 後台商品已建立／已啟用，且 ID 與後端 ${platformCode} 金幣包一致）`,
        );
        continue;
      }

      // 金幣數是這張卡存在的意義；後端沒給有效值就是資料未設定完成，不顯示
      const coins = Number(pack.amount);
      if (!Number.isFinite(coins) || coins <= 0) {
        skippedInvalidAmount.push(backendId);
        console.warn(`[ShopScreen] 略過不顯示：後端 productId="${backendId}" 的 amount 無效（${pack.amount}）`);
        continue;
      }

      const pid = productIdKey(product);
      // 價格與幣別一律取自商店（displayPrice 優先）；零小數幣別（如 TWD/JPY）去掉尾端 .00
      const price = product.displayPrice
        ? parseFloat(product.displayPrice.replace(/[^0-9.]/g, ''))
        : (product.price || 0);
      const currencyCode = (product as any).currency as string | undefined;

      const bonusRaw = Number(pack.bonusAmount);
      const bonus = Number.isFinite(bonusRaw) && bonusRaw > 0 ? bonusRaw : 0;

      items.push({
        id: `${pid}`,
        title: product.title, // 平台顯示名稱（多國語系）
        name: extractProductName(product.title) || product.title, // 僅用平台產品名稱，不用後端回傳
        coins,                 // 後端
        bonus,                 // 後端
        priceUsd: price,       // 商店（僅供數值用途）
        displayPrice: formatDisplayPrice(product.displayPrice ?? undefined, currencyCode), // 商店
        currencyCode,          // 商店
        productId: pid as ProductId, // 商店 SKU，購買時要用這個
        isAvailable: true,
      } as PackItem & { productId?: ProductId; isAvailable?: boolean });

      console.log(
        `[ShopScreen] 商品 ${items.length}: id=${pid} 後端 productId=${backendId} coins=${coins} bonus=${bonus} price=${price}`,
      );
    }

    // 商店回了、但後端沒有對應金幣包的品項（理論上不該發生，因為 SKU 就是後端給的）
    const orphanStoreProducts = products
      .map((p) => String(productIdKey(p)))
      .filter((pid) => !findPackForStoreProductId(coinPacks, pid));
    if (orphanStoreProducts.length > 0) {
      console.warn('[ShopScreen] 商店回傳但後端無對應金幣包（不顯示）:', orphanStoreProducts);
    }

    console.log(
      `[ShopScreen] 合併結果：可顯示 ${items.length} 筆`,
      `｜商店未回傳 ${skippedNoStoreProduct.length} 筆`,
      `｜金幣數無效 ${skippedInvalidAmount.length} 筆`,
      `｜商店多出 ${orphanStoreProducts.length} 筆`,
    );

    return { items, skippedNoStoreProduct, skippedInvalidAmount, orphanStoreProducts };
  }, [products, coinPacks, platformCode, platformName]);

  const packsWithPrice = merged.items;

  // 同批各卡共用價格字級：以格式化後的價格字串估算寬度換算
  const priceFontSize = useMemo(
    () => sharedPriceFontSize(packsWithPrice.map((p) => p.displayPrice || String(p.priceUsd))),
    [packsWithPrice],
  );

  // 無商品時顯示原因（iOS／Android 同一套文案結構）：依 階段 1 後端 → 階段 2 商店 → 階段 3 合併 逐層說明
  const emptyReason = useMemo(() => {
    if (packsWithPrice.length > 0) return null;
    const parts: string[] = [];

    // 階段 1：後端金幣包
    if (coinPacksError) {
      parts.push(`階段 1（後端）：取得金幣包失敗 — ${coinPacksError}`);
    } else if (coinPacks.length === 0) {
      parts.push(`階段 1（後端）：本平台（${platformCode}）金幣包數量為 0`);
      if (coinPackDebugText) {
        parts.push(`階段 1 診斷：\n${coinPackDebugText}`);
      }
    } else {
      parts.push(`階段 1（後端）：已取得 ${coinPacks.length} 筆金幣包`);
    }

    // 階段 2：商店回傳
    if (coinPacks.length > 0) {
      parts.push(
        products.length === 0
          ? `階段 2（${platformName}）：回傳商品數為 0，請檢查商品 ID 是否與後端一致、商品是否已啟用`
          : `階段 2（${platformName}）：回傳 ${products.length} 筆商品`
      );
    }

    // 階段 3：合併（後端為主體，缺任一邊即整筆不顯示）
    if (coinPacks.length > 0 && products.length > 0) {
      const stage3: string[] = ['階段 3（合併）：可顯示 0 筆'];
      if (merged.skippedNoStoreProduct.length > 0) {
        stage3.push(`　- ${platformName} 未回傳：${merged.skippedNoStoreProduct.join(', ')}`);
      }
      if (merged.skippedInvalidAmount.length > 0) {
        stage3.push(`　- 後端金幣數無效：${merged.skippedInvalidAmount.join(', ')}`);
      }
      if (merged.orphanStoreProducts.length > 0) {
        stage3.push(`　- 商店有但後端無：${merged.orphanStoreProducts.join(', ')}`);
      }
      parts.push(stage3.join('\n'));
    }

    return parts.join('\n');
  }, [
    packsWithPrice.length,
    products.length,
    coinPacks.length,
    merged,
    platformCode,
    platformName,
    coinPacksError,
    coinPackDebugText,
  ]);

  // 無商品時寫入一筆流程 log，方便對照
  useEffect(() => {
    if (!isShopLoading && !error && packsWithPrice.length === 0 && emptyReason) {
      console.log('[ShopScreen] 暫無可用商品 — 原因：', emptyReason.replace(/\n/g, ' | '));
    }
  }, [isShopLoading, error, packsWithPrice.length, emptyReason]);

  const handlePressPack = async (p: PackItem & { productId?: ProductId; isAvailable?: boolean }) => {
    if (!p.productId) {
      console.warn('[ShopScreen] 找不到對應的商品 ID:', p.id);
      showAlert(translate('operationFailedTitle'), translate('productIdNotFoundMessage'));
      return;
    }

    if (!p.isAvailable) {
      console.warn('[ShopScreen] 商品尚未載入或不可用:', p.productId);
      showAlert(translate('cannotPurchaseTitle'), translate('productNotLoadedMessage'));
      return;
    }

    try {
      await purchaseProduct(p.productId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      console.error('[ShopScreen] 購買失敗:', msg);
      showAlert(translate('purchaseFailedTitle'), msg);
    }
  };

  const { isTablet, maxContentWidth, horizontalPadding } = useResponsive();

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenTopBar
        onEyePress={() => navigation.navigate(routes.MAIN as never)}
        onProfilePress={() => navigation.navigate(routes.PROFILE as never)}
      />

      <View style={[styles.contentWrap, isTablet && { maxWidth: maxContentWidth, alignSelf: 'center', width: '100%', paddingHorizontal: horizontalPadding }]}>
      <View style={[styles.headerRow, { paddingTop: 12, paddingBottom: 32 }]}>
        <Text style={styles.title}>{translate('shopTitle')}</Text>
        <View style={styles.balanceBox}>
          <Image style={styles.coin} source={require('../../assets/coin.png')} />
          <Text style={styles.balanceText}>{coins}</Text>
        </View>
      </View>

      {isShopLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f0ad57" />
          <Text style={styles.loadingText}>{translate('loadingProducts')}</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>{translate('loadProductsFailed')}</Text>
          <Text style={styles.errorMessage}>{error.message}</Text>
          <Text style={styles.errorHint}>
            {error.message.includes('模擬器')
              ? Platform.OS === 'ios'
                ? translate('iapHintSimulatorIOS')
                : translate('iapHintSimulatorAndroid')
              : error.message.includes('Google Play 服務')
              ? translate('iapHintGooglePlayService')
              : error.message.includes('App Store') || error.message.includes('App Store Connect')
              ? Platform.OS === 'ios'
                ? translate('iapHintAppStore')
                : translate('iapHintNetwork')
              : error.message.includes('無法從伺服器獲取')
              ? translate('iapHintNetwork')
              : translate('iapHintGeneric')}
          </Text>
          <Pressable
            onPress={refreshProducts}
            style={styles.retryButton}
          >
            <Text style={styles.retryButtonText}>{translate('reload')}</Text>
          </Pressable>
          <Text style={styles.errorDebug}>
            詳細錯誤請查看控制台日誌（搜尋 [useIAP] 或 [iapService]）
          </Text>
        </View>
      ) : packsWithPrice.length === 0 ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{translate('noProductsAvailable')}</Text>
          <Text style={styles.emptyReasonTitle}>目前沒有資料的階段：</Text>
          <Text style={styles.emptyReasonText}>{emptyReason ?? '—'}</Text>
          <Pressable
            onPress={refreshProducts}
            style={styles.retryButton}
          >
            <Text style={styles.retryButtonText}>{translate('reload')}</Text>
          </Pressable>
          <Text style={styles.errorDebug}>
            控制台關鍵字：[ShopScreen]、[useIAP]、[iapService]
          </Text>
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
              priceFontSize={priceFontSize}
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
