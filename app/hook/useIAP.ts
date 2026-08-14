// app/hook/useIAP.ts
/**
 * 內購 Hook - 簡化內購功能的使用
 */

import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { showAlert } from "../components/CustomAlert";
import { iapService, type ProductId } from '../services/iapService';
import { type CoinPack } from '../config/shopApiClient';
import { useCoins } from '../store/coinContext';
import type { Product, Purchase, PurchaseError } from 'react-native-iap';
import { logKeyValue, logSection, logStringList } from '../utils/iapDebugLogger';
import {
  buildCatalogDiagnostics,
  currentPlatformCode,
  currentStoreName,
  fetchCurrentPlatformCatalog,
  formatCatalogDiagnostics,
} from '../utils/iapCatalog';
import { extractProductName } from '../utils/productName';
import { translate } from '../i18n/i18n';

/** 商品 ID 的來源；雙平台一律走後端 api/coin-packs，不存在本地固定清單 */
type ProductIdSource = 'api-coin-packs' | 'api-coin-packs-failed' | 'unknown';

interface UseIAPReturn {
  products: Product[];
  /**
   * 階段 1：本平台的後端金幣包（已過濾 + 依 sortOrder 排序）。
   * 由本 hook 統一取得，畫面不需要再自己呼叫一次 api/coin-packs。
   */
  coinPacks: CoinPack[];
  /** 階段 1 失敗訊息（取 coin-packs 失敗）；成功為 null。與 error（商店端錯誤）分開 */
  coinPacksError: string | null;
  /** 階段 1 診斷文字（平台分布、isActive、不匹配樣本），供「沒有商品」時判斷卡在哪一層 */
  catalogDiagnostics: string;
  isLoading: boolean;
  isPurchasing: boolean;
  error: Error | null;
  requestedProductIds: string[];
  productIdSource: ProductIdSource;
  purchaseProduct: (productId: ProductId) => Promise<void>;
  restorePurchases: () => Promise<void>;
  refreshProducts: () => Promise<void>;
  /** 最近一次階段 2（fetchProducts）請求／回傳摘要，供商城 UI 與診斷使用（雙平台一致） */
  iapCatalogSummary: string;
}

export function useIAP(): UseIAPReturn {
  const [products, setProducts] = useState<Product[]>([]);
  const [coinPacks, setCoinPacks] = useState<CoinPack[]>([]);
  const [coinPacksError, setCoinPacksError] = useState<string | null>(null);
  const [catalogDiagnostics, setCatalogDiagnostics] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [requestedProductIds, setRequestedProductIds] = useState<string[]>([]);
  const [productIdSource, setProductIdSource] = useState<ProductIdSource>('unknown');
  const [iapCatalogSummary, setIapCatalogSummary] = useState('');
  const { refreshCoins } = useCoins();

  // 初始化並載入商品
  const loadProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setIapCatalogSummary('');
      setCoinPacksError(null);

      console.log('[useIAP] ========== 開始載入商品 ==========');

      // 步驟 1: 決定要向「平台」請求的商品 ID 列表
      // 雙平台一致：清單完全來自後端 api/coin-packs，App 內沒有任何固定商品 ID，
      // 後台新增品項即可上架。傳給平台的資料：fetchProducts({ skus, type: 'in-app' })。
      // 這裡是全 App 唯一取 coin-packs 的地方，畫面直接用 coinPacks，避免重複請求造成兩份不一致的清單。
      let productIds: string[] = [];
      let packsForPlatform: CoinPack[] = [];
      let productIdSource: ProductIdSource = 'api-coin-packs';
      try {
        const catalog = await fetchCurrentPlatformCatalog();
        packsForPlatform = catalog.packs;
        productIds = catalog.skus;

        const diagnostics = buildCatalogDiagnostics(catalog.allPacks, catalog.packs);
        setCatalogDiagnostics(formatCatalogDiagnostics(diagnostics));
        console.log(
          '[useIAP] 步驟 1: 後端金幣包總數', catalog.allPacks.length,
          '｜本平台（', currentPlatformCode, '）', packsForPlatform.length,
          '→ 商店 SKU 數', productIds.length,
        );
        console.log('[useIAP] 步驟 1 診斷 raw platform 分布:', diagnostics.rawPlatformStats);
        console.log('[useIAP] 步驟 1 診斷 normalized platform 分布:', diagnostics.normalizedPlatformStats);
        console.log('[useIAP] 步驟 1 診斷 本平台 isActive=false 筆數:', diagnostics.inactiveOnThisPlatform);
        console.log('[useIAP] 步驟 1 診斷 不匹配樣本（最多 6 筆）:', diagnostics.mismatchedSamples);
      } catch (apiErr) {
        const msg = apiErr instanceof Error ? apiErr.message : String(apiErr);
        console.warn('[useIAP] 步驟 1: 取得 coin-packs 失敗，商店 SKU 為空（與後端 0 筆相同處理）', apiErr);
        productIdSource = 'api-coin-packs-failed';
        setCoinPacksError(msg);
        setCatalogDiagnostics(`平台代碼：${currentPlatformCode}\n階段 1 錯誤：${msg}`);
      }
      setCoinPacks(packsForPlatform);
      logSection(`useIAP ProductId Source (${currentPlatformCode})`, () => {
        logKeyValue('source', productIdSource);
        logStringList('backendProductIds', packsForPlatform.map((p) => p.productId));
        logStringList(`storeSkus(sent to ${currentStoreName})`, productIds);
      });
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
        setIapCatalogSummary('尚未呼叫 fetchProducts（商品 ID 配置錯誤）');
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
        setIapCatalogSummary(`尚未呼叫 fetchProducts（initConnection 失敗）\n${errorMsg}`);
        return;
      }

      // 步驟 3: 連線就緒後才向商店請求消耗型商品（fetchProducts + type in-app）；雙平台同流程
      console.log('[useIAP] 步驟 3: 連線已就緒，向商店取得消耗型商品（fetchProducts type: in-app）...');
      console.log('[useIAP] 當前平台:', Platform.OS, '｜商店:', currentStoreName);

      let productList: Product[] = [];

      if (productIds.length === 0) {
        // 後端本平台金幣包 0 筆：不呼叫 fetchProducts（沒有清單就不查，也不回退本地固定清單）
        console.log(`[useIAP] 後端無本平台（${currentPlatformCode}）商品 ID，略過 fetchProducts，商品列表為空`);
        productList = [];
      } else {
        console.log('[useIAP] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`[useIAP] 📱 從 ${currentStoreName} 取得商品名稱與價格`);
        console.log('[useIAP] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('[useIAP] 商品 ID 列表:', productIds);

        productList = await iapService.getProductList(productIds);

        console.log('[useIAP] ✓ 成功獲取 IAP 商品數量:', productList.length);
        console.log('[useIAP] 商品列表:', productList.map(p => ({
          id: p.id,
          title: p.title,
          price: p.displayPrice || p.price,
          currency: p.currency,
        })));
      }

      setProducts(productList);
      const returnedIds = productList
        .map((p) => String((p as { productId?: string; id?: string }).productId ?? (p as { id?: string }).id ?? ''))
        .filter(Boolean);
      setIapCatalogSummary(
        [
          `ID 來源：${productIdSource}`,
          productIds.length === 0
            ? `後端本平台（${currentPlatformCode}）金幣包 0 筆或未產生 SKU，未呼叫 fetchProducts`
            : `請求 SKU（${productIds.length}）：${productIds.join(', ')}`,
          `fetchProducts 回傳件數：${productList.length}`,
          returnedIds.length > 0
            ? `回傳 productId：${returnedIds.join(', ')}`
            : productIds.length > 0
              ? `回傳 productId：（無 — 請對照 ${currentStoreName} 與 SKU）`
              : '回傳 productId：（未請求）',
        ].join('\n')
      );
    } catch (err) {
      const error = err instanceof Error ? err : new Error('載入商品失敗');
      setError(error);
      console.error('[useIAP] ========== 載入商品失敗 ==========');
      console.error('[useIAP] 錯誤:', error);
      setProducts([]);
      setIapCatalogSummary(`getProductList／載入流程失敗：\n${error.message}`);
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

        // 優先使用平台產品名稱（清理括號／描述後綴，與商城卡片一致），否則使用 productId
        const productName = extractProductName(purchasedProduct?.title ?? '') || purchase.productId || productId;

        // 從驗證結果取得金幣額度（此時必為後端核發值）
        const coinsAdded = verificationResult.coinsAdded ?? 0;
        
        console.log('[useIAP] 商品名稱（從平台取得）:', productName);
        console.log('[useIAP] 獲取金幣:', coinsAdded);
        
        // 顯示購買成功訊息（使用平台產品名稱以支援多國語系）
        showAlert(
          translate('purchaseSuccessTitle'),
          translate('iapPurchaseSuccessMessage', { product: productName, coins: coinsAdded }),
          [{ text: translate('ok') }]
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
        showAlert(isVerifyFailure ? '驗證失敗' : '購買失敗', alertBody);
      };

      const catalogHasSku = products.some(
        (p: any) => p.productId === productId || p.id === productId
      );
      if (!catalogHasSku) {
        const msg =
          '商店列表中尚無此商品，請先在商城重新載入後再試。（需先 fetchProducts 成功再購買）';
        setError(new Error(msg));
        setIsPurchasing(false);
        showAlert('無法購買', msg);
        return;
      }

      // 執行購買（iapService 內會再次確認 consume 型 SKU 已自商店載入）
      await iapService.purchaseProduct(productId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('購買失敗');
      setError(error);
      setIsPurchasing(false);
      showAlert('購買失敗', error.message);
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
        showAlert(translate('restorePurchaseTitle'), translate('restorePurchaseNone'));
        return;
      }

      // 處理恢復的購買
      for (const purchase of purchases) {
        // 驗證並處理每個購買
        // await verifyPurchaseWithBackend(purchase);
        await iapService.finishTransaction(purchase, true);
      }

      showAlert(translate('restorePurchaseTitle'), translate('restorePurchaseSuccessMessage', { count: purchases.length }));
    } catch (err) {
      const error = err instanceof Error ? err : new Error('恢復購買失敗');
      setError(error);
      showAlert(translate('restorePurchaseFailedTitle'), error.message);
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
    coinPacks,
    coinPacksError,
    catalogDiagnostics,
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

