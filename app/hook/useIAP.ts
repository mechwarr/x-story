// app/hook/useIAP.ts
/**
 * 內購 Hook - 簡化內購功能的使用
 */

import { useState, useEffect, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import { iapService, type ProductId } from '../services/iapService';
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

      // 步驟 1: 使用硬編碼的商品 ID 列表（item_001 到 item_006）
      // 這些是 Google Play Console 中配置的商品 ID
      const productIds = [
        'item_001',
        'item_002',
        'item_003',
        'item_004',
        'item_005',
        'item_006',
      ];
      
      console.log('[useIAP] 步驟 1: 使用硬編碼的商品 ID 列表');
      console.log('[useIAP] 當前平台:', Platform.OS);
      console.log('[useIAP] 商品 ID 列表:', productIds);
      console.log('[useIAP] 商品 ID 數量:', productIds.length);
      
      // 驗證商品 ID 都是有效的字串
      const invalidIds = productIds.filter(id => !id || typeof id !== 'string' || id.trim().length === 0);
      if (invalidIds.length > 0) {
        console.error('[useIAP] ❌ 發現無效的商品 ID:', invalidIds);
        setError(new Error('商品 ID 配置錯誤，包含無效值'));
        setProducts([]);
        return;
      }

      // 步驟 2: 初始化 IAP 連線
      console.log('[useIAP] 步驟 2: 初始化 IAP 連線...');
      const initialized = await iapService.initialize();
      if (!initialized) {
        const errorMsg = '無法初始化內購服務。可能原因：1) 在模擬器上運行 2) 設備沒有 Google Play 服務 3) 應用未正確配置';
        console.warn('[useIAP]', errorMsg);
        setError(new Error(errorMsg));
        setProducts([]);
        return;
      }

      // 步驟 3: 使用硬編碼的商品 ID 列表獲取 IAP 商品詳情
      console.log('[useIAP] 步驟 3: 使用商品 ID 列表獲取 IAP 商品詳情...');
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
      iapService.onPurchaseSuccess = async (
        purchase: Purchase,
        verificationResult?: {
          productName: string;
          coinsAdded: number;
          message?: string;
        }
      ) => {
        console.log('[useIAP] ========== 購買成功 ==========');
        console.log('[useIAP] 購買物件:', purchase);
        console.log('[useIAP] 驗證結果:', verificationResult);
        
        // 驗證結果應該已經包含商品名稱和金幣額度（從後端 API 返回）
        if (verificationResult) {
          const { productName, coinsAdded, message } = verificationResult;
          
          console.log('[useIAP] 商品名稱:', productName);
          console.log('[useIAP] 獲取金幣:', coinsAdded);
          console.log('[useIAP] 訊息:', message);
          
          // 顯示購買成功訊息（包含商品名稱和金幣額度）
          Alert.alert(
            '購買成功',
            `您已成功購買 ${productName}！\n\n獲得 ${coinsAdded} 金幣`,
            [{ text: '確定' }]
          );
        } else {
          // 如果沒有驗證結果，使用備選方案
          const purchasedProduct = products.find((p: any) => 
            (p as any).productId === purchase.productId || 
            p.id === purchase.productId ||
            (p as any).productId === productId || 
            p.id === productId
          );
          
          const productTitle = purchasedProduct?.title || purchase.productId || productId;
          
          console.warn('[useIAP] ⚠️ 沒有驗證結果，使用備選方案');
          Alert.alert(
            '購買成功',
            `您已成功購買 ${productTitle}！`,
            [{ text: '確定' }]
          );
        }

        setIsPurchasing(false);
        console.log('[useIAP] =================================');
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

