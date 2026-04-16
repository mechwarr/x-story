// app/hook/useIAP.ts
/**
 * 內購 Hook - 簡化內購功能的使用
 */

import { useState, useEffect, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import { iapService, PRODUCT_IDS, type ProductId } from '../services/iapService';
import { getCoinPacks } from '../config/shopApiClient';
import { useCoins } from '../store/coinContext';
import type { Product, Purchase, PurchaseError } from 'react-native-iap';
import { logKeyValue, logSection, logStringList } from '../utils/iapDebugLogger';
import { buildAppStoreSkuListFromBackendProductIds } from '../utils/iosIapSkuMapping';

function normalizePlatformValue(value: unknown): 'GOOGLE' | 'APPLE' | 'UNKNOWN' {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'GOOGLE') return 'GOOGLE';
  if (normalized === 'APPLE') return 'APPLE';
  return 'UNKNOWN';
}

interface UseIAPReturn {
  products: Product[];
  isLoading: boolean;
  isPurchasing: boolean;
  error: Error | null;
  requestedProductIds: string[];
  productIdSource:
    | 'api-apple-packs'
    | 'local-product-ids-fallback'
    | 'local-product-ids-android'
    | 'unknown';
  purchaseProduct: (productId: ProductId) => Promise<void>;
  restorePurchases: () => Promise<void>;
  refreshProducts: () => Promise<void>;
  /** iOS：最近一次階段 2（fetchProducts）請求／回傳摘要，供商城 UI 顯示；Android 固定為空字串 */
  iapCatalogSummary: string;
}

export function useIAP(): UseIAPReturn {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [requestedProductIds, setRequestedProductIds] = useState<string[]>([]);
  const [productIdSource, setProductIdSource] = useState<
    'api-apple-packs' | 'local-product-ids-fallback' | 'local-product-ids-android' | 'unknown'
  >('unknown');
  const [iapCatalogSummary, setIapCatalogSummary] = useState('');
  const { refreshCoins } = useCoins();

  // 初始化並載入商品
  const loadProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      if (Platform.OS === 'ios') {
        setIapCatalogSummary('');
      }

      console.log('[useIAP] ========== 開始載入商品 ==========');

      // 步驟 1: 決定要向「平台」請求的商品 ID 列表
      // 傳給平台的資料：fetchProducts({ skus: productIds, type: 'in-app' })（消耗型）→ 商店回傳價格與元資料
      let productIds: string[];
      let productIdSource:
        | 'api-apple-packs'
        | 'local-product-ids-fallback'
        | 'local-product-ids-android';
      if (Platform.OS === 'ios') {
        // iOS：由後端 coin-packs（APPLE）組 SKU；item_001～item_006 對應 App Store 的 item_01～item_06
        let productIdsFromApi: string[] = [];
        try {
          const packs = await getCoinPacks();
          const applePacks = packs.filter((p) => normalizePlatformValue(p.platform) === 'APPLE');
          const backendIds = applePacks
            .map((p) => p.productId)
            .filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
          productIdsFromApi = buildAppStoreSkuListFromBackendProductIds(backendIds);
          console.log('[useIAP] 步驟 1 (iOS): 後端 APPLE 金幣包筆數', applePacks.length, '→ 商店 SKU 數', productIdsFromApi.length);
        } catch (apiErr) {
          console.warn('[useIAP] 步驟 1 (iOS): 取得 coin-packs 失敗，商店 SKU 為空（與後端 0 筆相同處理）', apiErr);
          productIdsFromApi = [];
        }
        productIds = productIdsFromApi;
        productIdSource = 'api-apple-packs';
        logSection('useIAP iOS ProductId Source (api-apple-packs)', () => {
          logKeyValue('source', productIdSource);
          logStringList('storeSkus(sent to App Store)', productIds);
        });
      } else {
        // Android：使用本地 PRODUCT_IDS（與 Google Play Console 商品 ID 一致）
        productIds = Object.values(PRODUCT_IDS);
        productIdSource = 'local-product-ids-android';
        console.log('[useIAP] 步驟 1 (Android): 使用 PRODUCT_IDS');
        logSection('useIAP Android ProductId Source', () => {
          logKeyValue('source', productIdSource);
          logStringList('finalProductIds(sent to store)', productIds);
        });
      }
      console.log('[useIAP] 當前平台:', Platform.OS);
      console.log('[useIAP] 傳給平台的商品 ID 列表:', productIds);
      console.log('[useIAP] 商品 ID 數量:', productIds.length);
      setRequestedProductIds(productIds);
      setProductIdSource(productIdSource);

      // 驗證商品 ID 都是有效的字串
      const invalidIds = productIds.filter(id => !id || typeof id !== 'string' || id.trim().length === 0);
      if (invalidIds.length > 0) {
        console.error('[useIAP] ❌ 發現無效的商品 ID:', invalidIds);
        setError(new Error('商品 ID 配置錯誤，包含無效值'));
        setProducts([]);
        if (Platform.OS === 'ios') {
          setIapCatalogSummary('尚未呼叫 fetchProducts（商品 ID 配置錯誤）');
        }
        return;
      }

      // 步驟 2: 初始化 IAP 連線（iOS：initConnection / StoreKit；須成功後才能步驟 3 查價）
      console.log('[useIAP] 步驟 2: 初始化 IAP 連線（initConnection）...');
      const initialized = await iapService.initialize();
      if (!initialized) {
        const errorMsg = Platform.OS === 'ios'
          ? '無法初始化內購服務。可能原因：1) 未登入 App Store 帳號 2) 應用未正確配置 App Store Connect 3) 網絡連接問題'
          : '無法初始化內購服務。可能原因：1) 在模擬器上運行 2) 設備沒有 Google Play 服務 3) 應用未正確配置';
        console.warn('[useIAP]', errorMsg);
        setError(new Error(errorMsg));
        setProducts([]);
        if (Platform.OS === 'ios') {
          setIapCatalogSummary(`尚未呼叫 fetchProducts（initConnection 失敗）\n${errorMsg}`);
        }
        return;
      }

      // 步驟 3: 連線就緒後才向商店請求消耗型商品（fetchProducts + type in-app）；雙平台同順序
      console.log('[useIAP] 步驟 3: 連線已就緒，向商店取得消耗型商品（fetchProducts type: in-app）...');
      console.log('[useIAP] 當前平台:', Platform.OS);
      
      let productList: Product[] = [];

      if (Platform.OS === 'ios' && productIds.length === 0) {
        // 後端 APPLE 金幣包 0 筆：不呼叫 fetchProducts（避免 iapService 空陣列誤用預設 PRODUCT_IDS）
        console.log('[useIAP] iOS：後端無 APPLE 商品 ID，略過 fetchProducts，商品列表為空');
        productList = [];
      } else if (Platform.OS === 'android') {
        // Android 平台：使用 Google Play 獲取商品（保持現有流程不變）
        console.log('[useIAP] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('[useIAP] 📱 Android 平台：使用 Google Play 獲取商品');
        console.log('[useIAP] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('[useIAP] 將從 Google Play 獲取商品名稱和價格');
        console.log('[useIAP] 商品 ID 列表:', productIds);

        productList = await iapService.getProductList(productIds);

        console.log('[useIAP] ✓ Android: 成功獲取 IAP 商品數量:', productList.length);
        console.log('[useIAP] Android 商品列表:', productList.map(p => ({
          id: p.id,
          title: p.title,
          price: p.displayPrice || p.price,
          currency: p.currency,
        })));
      } else if (Platform.OS === 'ios') {
        // iOS 平台：使用 App Store 獲取商品
        console.log('[useIAP] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('[useIAP] 🍎 iOS 平台：使用 App Store 獲取商品');
        console.log('[useIAP] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('[useIAP] 將從 App Store 獲取商品名稱和價格');
        console.log('[useIAP] 商品 ID 列表:', productIds);

        productList = await iapService.getProductList(productIds);

        console.log('[useIAP] ✓ iOS: 成功獲取 IAP 商品數量:', productList.length);
        console.log('[useIAP] iOS 商品列表:', productList.map(p => ({
          id: p.id,
          title: p.title,
          price: p.displayPrice || p.price,
          currency: p.currency,
        })));
      } else {
        // 其他平台（理論上不會發生，但為了完整性）
        console.warn('[useIAP] ⚠️ 未知平台:', Platform.OS);
        console.warn('[useIAP] 嘗試使用通用方式獲取商品...');
        productList = await iapService.getProductList(productIds);
      }
      
      setProducts(productList);
      if (Platform.OS === 'ios') {
        const returnedIds = productList
          .map((p) => String((p as { productId?: string; id?: string }).productId ?? (p as { id?: string }).id ?? ''))
          .filter(Boolean);
        setIapCatalogSummary(
          [
            `ID 來源：${productIdSource}`,
            productIds.length === 0
              ? '後端 APPLE 金幣包 0 筆或未產生 SKU，未呼叫 fetchProducts'
              : `請求 SKU（${productIds.length}）：${productIds.join(', ')}`,
            `fetchProducts 回傳件數：${productList.length}`,
            returnedIds.length > 0
              ? `回傳 productId：${returnedIds.join(', ')}`
              : productIds.length > 0
                ? '回傳 productId：（無 — 請對照 App Store Connect 與 SKU）'
                : '回傳 productId：（未請求）',
          ].join('\n')
        );
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('載入商品失敗');
      setError(error);
      console.error('[useIAP] ========== 載入商品失敗 ==========');
      console.error('[useIAP] 錯誤:', error);
      setProducts([]);
      if (Platform.OS === 'ios') {
        setIapCatalogSummary(`getProductList／載入流程失敗：\n${error.message}`);
      }
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
        verificationResult: {
          productName: string;
          coinsAdded: number;
          message?: string;
        }
      ) => {
        console.log('[useIAP] ========== 購買成功（後端驗證已成功）==========');
        console.log('[useIAP] 購買物件:', purchase);
        console.log('[useIAP] 驗證結果:', verificationResult);

        // 從平台產品列表取得產品名稱（支援多國語系）
        const purchasedProduct = products.find((p: any) =>
          (p as any).productId === purchase.productId ||
          p.id === purchase.productId ||
          (p as any).productId === productId ||
          p.id === productId
        );

        // 優先使用平台產品名稱（支援多國語系），否則使用 productId
        const productName = purchasedProduct?.title || purchase.productId || productId;

        // 從驗證結果取得金幣額度（此時必為後端核發值）
        const coinsAdded = verificationResult.coinsAdded ?? 0;
        
        console.log('[useIAP] 商品名稱（從平台取得）:', productName);
        console.log('[useIAP] 獲取金幣:', coinsAdded);
        
        // 顯示購買成功訊息（使用平台產品名稱以支援多國語系）
        Alert.alert(
          '購買成功',
          `您已成功購買 ${productName}！\n\n獲得 ${coinsAdded} 金幣`,
          [{ text: '確定' }]
        );

        // 購買成功後強制刷新金幣餘額（略過 30s 防抖）
        console.log('[useIAP] 購買成功，開始刷新金幣餘額...');
        try {
          await refreshCoins(true);
          console.log('[useIAP] ✓ 金幣餘額已刷新');
        } catch (refreshError) {
          console.error('[useIAP] ⚠️ 刷新金幣餘額失敗:', refreshError);
          // 不影響購買成功的流程，只記錄錯誤
        }

        setIsPurchasing(false);
        console.log('[useIAP] =================================');
      };

      // 設定購買錯誤回調
      iapService.onPurchaseError = (err: Error | PurchaseError) => {
        console.error('購買錯誤:', err);
        setIsPurchasing(false);

        // 判斷是否為用戶取消購買
        const errorMessage = err instanceof Error ? err.message : err.message || '';
        const errorCode = (err as any)?.code?.toString() || '';
        const isUserCancel =
          errorMessage.toLowerCase().includes('cancel') ||
          errorMessage.toLowerCase().includes('cancelled') ||
          errorCode.includes('CANCELLED') ||
          errorCode.includes('USER_CANCEL');

        // 如果是用戶取消，不設置錯誤狀態，也不顯示錯誤訊息
        if (isUserCancel) {
          console.log('[useIAP] ℹ️ 用戶取消了購買，不設置錯誤狀態');
          return;
        }

        const error = err instanceof Error ? err : new Error(err.message || '購買失敗');
        setError(error);

        const verifyPrefix = '[VERIFY_FAILED] ';
        const isVerifyFailure = errorMessage.startsWith(verifyPrefix);
        const alertBody = isVerifyFailure
          ? errorMessage.slice(verifyPrefix.length)
          : errorMessage || '購買過程中發生錯誤，請稍後再試';
        Alert.alert(isVerifyFailure ? '驗證失敗' : '購買失敗', alertBody);
      };

      const catalogHasSku = products.some(
        (p: any) => p.productId === productId || p.id === productId
      );
      if (!catalogHasSku) {
        const msg =
          '商店列表中尚無此商品，請先在商城重新載入後再試。（需先 fetchProducts 成功再購買）';
        setError(new Error(msg));
        setIsPurchasing(false);
        Alert.alert('無法購買', msg);
        return;
      }

      // 執行購買（iapService 內會再次確認 consume 型 SKU 已自商店載入）
      await iapService.purchaseProduct(productId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('購買失敗');
      setError(error);
      setIsPurchasing(false);
      Alert.alert('購買失敗', error.message);
    }
  }, [products, refreshCoins]);

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
      requestedProductIds,
      productIdSource,
    purchaseProduct,
    restorePurchases,
    refreshProducts,
    iapCatalogSummary,
  };
}

