// app/hook/useIAP.ts
/**
 * 內購 Hook - 簡化內購功能的使用
 */

import { useState, useEffect, useCallback } from 'react';
import { Platform, Alert } from 'react-native';
import { iapService, PRODUCT_IDS, PRODUCT_MAP, type ProductId } from '../services/iapService';
import type { Product, Purchase } from 'react-native-iap';

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

      console.log('[useIAP] 開始載入商品...');

      // 初始化 IAP 連線
      console.log('[useIAP] 初始化 IAP 連線...');
      const initialized = await iapService.initialize();
      if (!initialized) {
        const errorMsg = '無法初始化內購服務。可能原因：1) 在模擬器上運行 2) 設備沒有 Google Play 服務 3) 應用未正確配置';
        console.warn('[useIAP]', errorMsg);
        // 不拋出錯誤，讓應用可以繼續運行（顯示後端 API 的商品）
        setError(new Error(errorMsg));
        setProducts([]); // 設置為空陣列，讓 UI 可以顯示後端 API 的商品
        return;
      }

      console.log('[useIAP] IAP 初始化成功，獲取商品列表...');
      // 獲取商品列表
      const productList = await iapService.getProductList();
      console.log('[useIAP] 獲取到商品數量:', productList.length);
      setProducts(productList);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('載入商品失敗');
      setError(error);
      console.error('[useIAP] 載入商品失敗:', error);
      // 即使失敗也設置為空陣列，讓 UI 可以顯示後端 API 的商品
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
        
        const productInfo = PRODUCT_MAP[productId];
        if (productInfo) {
          Alert.alert(
            '購買成功',
            `您已成功購買 ${productInfo.title}，獲得 ${productInfo.coins + (productInfo.bonus || 0)} 金幣！`,
            [{ text: '確定' }]
          );
        }

        setIsPurchasing(false);
      };

      // 設定購買錯誤回調
      iapService.onPurchaseError = (err: Error) => {
        console.error('購買錯誤:', err);
        setError(err);
        setIsPurchasing(false);
        
        // 不顯示取消購買的錯誤
        if (err.message && !err.message.includes('cancel')) {
          Alert.alert('購買失敗', err.message || '購買過程中發生錯誤，請稍後再試');
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
  }, []);

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

