// app/hook/useIAP.ts
/**
 * 內購 Hook - 簡化內購功能的使用
 */

import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { iapService, PRODUCT_IDS, PRODUCT_MAP, type ProductId } from '../services/iapService';
import { getCoinPacks } from '../config/shopApiClient';
import type { Product, Purchase, PurchaseError } from 'react-native-iap';

interface UseIAPReturn {
  products: Product[];
  isLoading: boolean;
  isPurchasing: boolean;
  error: Error | null;
  purchaseProduct: (productId: ProductId) => Promise<void>;
  restorePurchases: () => Promise<void>;
  refreshProducts: () => Promise<void>;
}

export function useIAP(): UseIAPReturn {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // 初始化並載入商品
  const loadProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('[useIAP] ========== 開始載入商品 ==========');

      // 步驟 1: 從後端 API 獲取金幣包列表（僅用於打印 log）
      try {
        console.log('[useIAP] 步驟 1: 從後端 API 獲取金幣包列表（僅用於 log）...');
        const coinPacks = await getCoinPacks();
        console.log('[useIAP] ========== /api/coin-packs Response Data ==========');
        console.log('[useIAP] 獲取到金幣包數量:', coinPacks.length);
        console.log('[useIAP] 金幣包資料:', JSON.stringify(coinPacks, null, 2));
        console.log('[useIAP] ================================================');
      } catch (apiError) {
        console.warn('[useIAP] 獲取後端 API 資料失敗（僅用於 log，不影響 IAP 載入）:', apiError);
      }

      // 步驟 2: 使用 PRODUCT_IDS 來初始化 IAP
      const productIds = Object.values(PRODUCT_IDS);
      console.log('[useIAP] 步驟 2: 使用 PRODUCT_IDS 初始化 IAP');
      console.log('[useIAP] 商品 ID 列表:', productIds);

      // 步驟 3: 初始化 IAP 連線
      console.log('[useIAP] 步驟 3: 初始化 IAP 連線...');
      const initialized = await iapService.initialize();
      if (!initialized) {
        const errorMsg = '無法初始化內購服務。可能原因：1) 在模擬器上運行 2) 設備沒有 Google Play 服務 3) 應用未正確配置';
        console.warn('[useIAP]', errorMsg);
        setError(new Error(errorMsg));
        setProducts([]);
        return;
      }

      // 步驟 4: 使用 PRODUCT_IDS 獲取 IAP 商品列表
      console.log('[useIAP] 步驟 4: 使用 PRODUCT_IDS 獲取 IAP 商品列表...');
      const productList = await iapService.getProductList(productIds);
      console.log('[useIAP] ✓ 成功獲取 IAP 商品數量:', productList.length);
      console.log('[useIAP] IAP 商品列表:', productList.map(p => ({ 
        id: p.id, 
        title: p.title, 
        price: p.displayPrice || p.price 
      })));
      
      setProducts(productList);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('載入商品失敗');
      setError(error);
      console.error('[useIAP] ========== 載入商品失敗 ==========');
      console.error('[useIAP] 錯誤:', error);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 購買商品
  const purchaseProduct = useCallback(async (productId: ProductId) => {
    try {
      setIsPurchasing(true);
      setError(null);

      // 設定購買成功回調
      iapService.onPurchaseSuccess = async (purchase: Purchase) => {
        console.log('購買成功:', purchase);
        
        // 這裡可以調用後端 API 來驗證收據並更新用戶餘額
        // await verifyPurchaseWithBackend(purchase);
        
        // 從當前的 products 狀態中獲取商品名稱（從 Google Play 返回的 Product 物件）
        // 使用 purchase.productId 來匹配商品
        const purchasedProduct = products.find((p: any) => 
          (p as any).productId === purchase.productId || 
          p.id === purchase.productId ||
          (p as any).productId === productId || 
          p.id === productId
        );
        
        // 商品名稱來源：Google Play 返回的 Product.title
        const productTitle = purchasedProduct?.title || purchase.productId || productId;
        
        // 從 PRODUCT_MAP 獲取商品資訊（金幣數量、bonus）
        const productInfo = PRODUCT_MAP[productId];
        
        console.log('[useIAP] 購買成功 - 商品資訊:', {
          productId,
          productTitle,
          source: purchasedProduct ? 'Google Play Product.title' : 'fallback to productId',
          coins: productInfo?.coins || 0,
          bonus: productInfo?.bonus || 0,
        });
        
        if (productInfo) {
          Alert.alert(
            '購買成功',
            `您已成功購買 ${productTitle}，獲得 ${productInfo.coins + (productInfo.bonus || 0)} 金幣！`,
            [{ text: '確定' }]
          );
        } else {
          // 如果商品不在 PRODUCT_MAP 中，使用通用成功訊息
          Alert.alert(
            '購買成功',
            `您已成功購買 ${productTitle}！`,
            [{ text: '確定' }]
          );
        }

        setIsPurchasing(false);
      };

      // 設定購買錯誤回調
      iapService.onPurchaseError = (err: Error | PurchaseError) => {
        console.error('購買錯誤:', err);
        const error = err instanceof Error ? err : new Error(err.message || '購買失敗');
        setError(error);
        setIsPurchasing(false);
        
        // 不顯示取消購買的錯誤
        const errorMessage = err instanceof Error ? err.message : err.message || '';
        if (errorMessage && !errorMessage.includes('cancel')) {
          Alert.alert('購買失敗', errorMessage || '購買過程中發生錯誤，請稍後再試');
        }
      };

      // 執行購買
      await iapService.purchaseProduct(productId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('購買失敗');
      setError(error);
      setIsPurchasing(false);
      Alert.alert('購買失敗', error.message);
    }
  }, [products]);

  // 恢復購買
  const restorePurchases = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const initialized = await iapService.initialize();
      if (!initialized) {
        throw new Error('無法初始化內購服務');
      }

      const purchases = await iapService.getAvailablePurchases();
      
      if (purchases.length === 0) {
        Alert.alert('恢復購買', '沒有找到可恢復的購買記錄');
        return;
      }

      // 處理恢復的購買
      for (const purchase of purchases) {
        // 驗證並處理每個購買
        // await verifyPurchaseWithBackend(purchase);
        await iapService.finishTransaction(purchase, true);
      }

      Alert.alert('恢復購買', `已恢復 ${purchases.length} 筆購買記錄`);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('恢復購買失敗');
      setError(error);
      Alert.alert('恢復購買失敗', error.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 刷新商品列表
  const refreshProducts = useCallback(async () => {
    await loadProducts();
  }, [loadProducts]);

  // 初始化時載入商品
  useEffect(() => {
    loadProducts();

    // 清理函數：在組件卸載時關閉連線
    return () => {
      iapService.disconnect();
    };
  }, [loadProducts]);

  return {
    products,
    isLoading,
    isPurchasing,
    error,
    purchaseProduct,
    restorePurchases,
    refreshProducts,
  };
}

