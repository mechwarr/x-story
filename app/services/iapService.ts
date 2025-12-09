// app/services/iapService.ts
/**
 * 內購服務 - 封裝 react-native-iap 功能
 * 支援 iOS App Store 和 Google Play Store
 */

import { Platform, NativeModules } from 'react-native';
import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  finishTransaction,
  getAvailablePurchases,
  purchaseUpdatedListener,
  purchaseErrorListener,
  type Product,
  type Purchase,
  type PurchaseError,
} from 'react-native-iap';

// 商品 ID 配置（需要在 App Store Connect 和 Google Play Console 中設定）
export const PRODUCT_IDS = {
  PACK_1: 'item_001', // 入門基本包
  PACK_2: 'item_002', // 熱門推薦包
  PACK_3: 'item_003', // 高效閱讀包
  PACK_4: 'item_004', // 文青超值包
  PACK_5: 'item_005', // VIP獨享包
  PACK_6: 'item_006', // 尊爵贊助包
} as const;

export type ProductId = typeof PRODUCT_IDS[keyof typeof PRODUCT_IDS];

// 商品資訊映射（與 ShopScreen 中的 PACKS 對應）
export const PRODUCT_MAP: Record<string, { title: string; coins: number; bonus: number }> = {
  [PRODUCT_IDS.PACK_1]: { title: '入門基本包', coins: 90, bonus: 5 },
  [PRODUCT_IDS.PACK_2]: { title: '熱門推薦包', coins: 150, bonus: 20 },
  [PRODUCT_IDS.PACK_3]: { title: '高效閱讀包', coins: 300, bonus: 55 },
  [PRODUCT_IDS.PACK_4]: { title: '文青超值包', coins: 590, bonus: 120 },
  [PRODUCT_IDS.PACK_5]: { title: 'VIP獨享包', coins: 1190, bonus: 280 },
  [PRODUCT_IDS.PACK_6]: { title: '尊爵贊助包', coins: 1790, bonus: 460 },
};

class IAPService {
  private purchaseUpdateSubscription: any = null;
  private purchaseErrorSubscription: any = null;
  private isInitialized = false;

  /**
   * 檢測是否為模擬器（Android）
   */
  private async checkIfEmulator(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }

    try {
      // 嘗試使用 Platform.constants 檢測（React Native 0.62+）
      if (Platform.constants) {
        const constants = Platform.constants as any;
        const model = constants.Model || '';
        const manufacturer = constants.Manufacturer || '';
        const brand = constants.Brand || '';
        const device = constants.Device || '';
        const fingerprint = constants.Fingerprint || '';
        
        const isEmulator = 
          fingerprint.includes('generic') ||
          fingerprint.includes('unknown') ||
          model.includes('google_sdk') ||
          model.includes('Emulator') ||
          model.includes('Android SDK built for x86') ||
          manufacturer.includes('Genymotion') ||
          (brand?.startsWith('generic') && device?.startsWith('generic')) ||
          fingerprint.startsWith('generic');
        
        if (isEmulator) {
          console.log('[iapService] 檢測到模擬器特徵:', { model, manufacturer, brand, device });
        }
        
        return isEmulator;
      }
      
      // 備用方案：嘗試使用 NativeModules
      const { Build } = NativeModules;
      if (Build) {
        const fingerprint = Build.FINGERPRINT || '';
        const model = Build.MODEL || '';
        const manufacturer = Build.MANUFACTURER || '';
        
        const isEmulator = 
          fingerprint.includes('generic') ||
          fingerprint.includes('unknown') ||
          model.includes('google_sdk') ||
          model.includes('Emulator') ||
          model.includes('Android SDK built for x86') ||
          manufacturer.includes('Genymotion') ||
          (Build.BRAND?.startsWith('generic') && Build.DEVICE?.startsWith('generic')) ||
          fingerprint.startsWith('generic');
        
        return isEmulator;
      }
    } catch {
      // 忽略檢測失敗
    }
    
    return false;
  }

  /**
   * 初始化內購連線
   */
  async initialize(): Promise<boolean> {
    try {
      if (this.isInitialized) {
        console.log('[iapService] IAP 已經初始化，跳過');
        return true;
      }

      console.log('[iapService] ========== 開始初始化 IAP 連線 ==========');
      console.log('[iapService] 平台:', Platform.OS);
      
      // 檢測是否為模擬器
      if (Platform.OS === 'android') {
        const isEmulator = await this.checkIfEmulator();
        if (isEmulator) {
          console.warn('[iapService] ⚠️ 檢測到在模擬器上運行！');
          console.warn('[iapService] ⚠️ Google Play Billing 不支持模擬器，初始化將失敗');
          console.warn('[iapService] ⚠️ 請在真實設備上測試 IAP 功能');
        } else {
          console.log('[iapService] ✓ 檢測到真實設備');
        }
      }
      
      console.log('[iapService] 調用 initConnection()...');
      const result = await initConnection();
      console.log('[iapService] initConnection() 返回結果:', result);
      
      this.isInitialized = result;

      if (result) {
        console.log('[iapService] ✓ IAP 初始化成功，設定購買監聽器');
        // 設定購買更新監聽器
        this.setupPurchaseListeners();
      } else {
        console.warn('[iapService] ✗ IAP 初始化失敗，result 為 false');
        console.warn('[iapService] 這通常表示 responseCode: -1 (BILLING_UNAVAILABLE)');
      }

      return result;
    } catch (error) {
      console.error('[iapService] ========== IAP 初始化失敗 ==========');
      console.error('[iapService] 錯誤:', error);
      
      // 嘗試從錯誤中提取詳細資訊
      let responseCode: number | undefined;
      let errorCode: string | undefined;
      let debugMessage: string | undefined;
      
      // 詳細錯誤資訊
      if (error instanceof Error) {
        console.error('[iapService] 錯誤類型: Error');
        console.error('[iapService] 錯誤訊息:', error.message);
        console.error('[iapService] 錯誤堆疊:', error.stack);
        
        // 嘗試從 message 中解析 JSON（如果有的話）
        try {
          const jsonMatch = error.message.match(/\{.*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            responseCode = parsed.responseCode;
            errorCode = parsed.code;
            debugMessage = parsed.debugMessage;
            console.error('[iapService] 從錯誤訊息中解析到:', {
              code: errorCode,
              responseCode,
              debugMessage,
            });
          }
        } catch {
          // 忽略解析失敗
        }
      }
      
      // 如果是物件，嘗試解析
      if (typeof error === 'object' && error !== null) {
        console.error('[iapService] 錯誤物件類型:', error.constructor?.name);
        console.error('[iapService] 錯誤物件內容:', JSON.stringify(error, null, 2));
        
        // 嘗試提取常見的錯誤屬性
        const errorAny = error as any;
        if (errorAny.code !== undefined) {
          errorCode = String(errorAny.code);
          console.error('[iapService] 錯誤代碼 (code):', errorCode);
        }
        if (errorAny.responseCode !== undefined) {
          responseCode = Number(errorAny.responseCode);
          console.error('[iapService] 響應代碼 (responseCode):', responseCode);
        }
        if (errorAny.debugMessage !== undefined) {
          debugMessage = String(errorAny.debugMessage);
          console.error('[iapService] 調試訊息 (debugMessage):', debugMessage);
        }
        if (errorAny.message !== undefined) {
          console.error('[iapService] 錯誤訊息 (message):', errorAny.message);
        }
      }
      
      // 根據 responseCode 提供診斷資訊
      if (responseCode === -1 || errorCode === 'init-connection') {
        console.error('[iapService] ========== 診斷資訊 ==========');
        console.error('[iapService] responseCode: -1 表示 BILLING_UNAVAILABLE');
        console.error('[iapService]');
        console.error('[iapService] 可能的原因：');
        console.error('[iapService] 1. ❌ 在模擬器上運行（最常見）');
        console.error('[iapService]    → Google Play Billing 不支持模擬器');
        console.error('[iapService]    → 解決方案：在真實 Android 設備上測試');
        console.error('[iapService]');
        console.error('[iapService] 2. ❌ 設備沒有 Google Play 服務');
        console.error('[iapService]    → 某些設備或自訂 ROM 可能沒有 Google Play 服務');
        console.error('[iapService]    → 解決方案：確保設備已安裝並更新 Google Play 服務');
        console.error('[iapService]');
        console.error('[iapService] 3. ❌ 應用未在 Google Play Console 中正確配置');
        console.error('[iapService]    → 商品未建立或應用未發布到測試軌道');
        console.error('[iapService]    → 解決方案：');
        console.error('[iapService]      a. 在 Google Play Console 中建立商品（item_001, item_002 等）');
        console.error('[iapService]      b. 將應用發布到 Alpha/Beta/Internal Testing');
        console.error('[iapService]      c. 將測試帳號加入測試人員名單');
        console.error('[iapService]');
        console.error('[iapService] 4. ❌ 網絡連接問題');
        console.error('[iapService]    → 無法連接到 Google Play 服務器');
        console.error('[iapService]    → 解決方案：檢查網絡連接');
        console.error('[iapService]');
        console.error('[iapService] 5. ❌ Google Play 服務版本過舊');
        console.error('[iapService]    → 更新 Google Play 服務到最新版本');
        console.error('[iapService] =================================');
      }
      
      return false;
    }
  }

  /**
   * 設定購買監聽器
   */
  private setupPurchaseListeners() {
    // 監聽購買成功
    this.purchaseUpdateSubscription = purchaseUpdatedListener(
      async (purchase: Purchase) => {
        console.log('購買成功:', purchase);
        try {
          // 驗證收據（可選，建議在後端驗證）
          // const receipt = await this.validateReceipt(purchase);
          
          // 完成交易（標記為已處理）
          await finishTransaction({ purchase, isConsumable: true });
          
          // 觸發購買成功回調
          this.onPurchaseSuccess?.(purchase);
        } catch (error) {
          console.error('處理購買時發生錯誤:', error);
          this.onPurchaseError?.(error as Error);
        }
      }
    );

    // 監聽購買錯誤
    this.purchaseErrorSubscription = purchaseErrorListener(
      (error: PurchaseError) => {
        console.error('購買錯誤:', error);
        this.onPurchaseError?.(error);
      }
    );
  }

  /**
   * 獲取商品列表
   */
  async getProductList(): Promise<Product[]> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const productIds = Object.values(PRODUCT_IDS);
      const products = await fetchProducts({ skus: productIds });
      
      // fetchProducts 可能返回 null，需要處理
      if (!products) {
        return [];
      }
      
      // 過濾出 Product 類型（排除訂閱類型）
      return products.filter((p): p is Product => 'productId' in p && !('subscriptionPeriodUnitIOS' in p));
    } catch (error) {
      console.error('獲取商品列表失敗:', error);
      throw error;
    }
  }

  /**
   * 購買商品
   */
  async purchaseProduct(productId: ProductId): Promise<void> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // requestPurchase 需要傳遞物件，根據平台使用不同的參數
      // iOS 使用 sku，Android 也使用 sku
      await requestPurchase({ sku: productId } as any);
    } catch (error) {
      console.error('購買商品失敗:', error);
      throw error;
    }
  }

  /**
   * 獲取未完成的購買（用於恢復購買）
   */
  async getAvailablePurchases(): Promise<Purchase[]> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const purchases = await getAvailablePurchases();
      return purchases;
    } catch (error) {
      console.error('獲取未完成購買失敗:', error);
      throw error;
    }
  }

  /**
   * 獲取收據資訊（用於後端驗證）
   * 
   * 注意：react-native-iap v14+ 已移除本地驗證功能
   * 建議在後端使用以下方式驗證：
   * - iOS: 使用 App Store Server API 或驗證收據 API
   * - Android: 使用 Google Play Developer API
   * 
   * 購買成功後，可以從 Purchase 物件中獲取收據資訊：
   * - iOS: 使用 purchase.originalTransactionIdentifierIOS 或整個 purchase 物件
   * - Android: purchase.purchaseToken
   */
  getReceiptInfo(purchase: Purchase): {
    platform: 'ios' | 'android';
    receipt?: string;
    transactionId?: string;
    productId?: string;
    originalTransactionId?: string;
  } {
    const isIOS = purchase.platform === 'ios';
    const purchaseToken = (purchase as any).purchaseToken;
    const originalTransactionIdIOS = isIOS ? (purchase as any).originalTransactionIdentifierIOS : null;
    
    // 處理可能為 null 的值
    const receipt = isIOS 
      ? (originalTransactionIdIOS ? String(originalTransactionIdIOS) : (purchase.transactionId || undefined))
      : (purchaseToken ? String(purchaseToken) : undefined);
    
    const originalTransactionId = originalTransactionIdIOS && originalTransactionIdIOS !== null 
      ? String(originalTransactionIdIOS) 
      : undefined;
    
    return {
      platform: isIOS ? 'ios' : 'android',
      receipt,
      transactionId: purchase.transactionId || undefined,
      productId: purchase.productId || undefined,
      originalTransactionId,
    };
  }

  /**
   * 完成交易（標記為已處理）
   */
  async finishTransaction(purchase: Purchase, isConsumable: boolean = true): Promise<void> {
    try {
      await finishTransaction({ purchase, isConsumable });
    } catch (error) {
      console.error('完成交易失敗:', error);
      throw error;
    }
  }

  /**
   * 關閉連線（在應用關閉時調用）
   */
  async disconnect(): Promise<void> {
    try {
      if (this.purchaseUpdateSubscription) {
        this.purchaseUpdateSubscription.remove();
        this.purchaseUpdateSubscription = null;
      }

      if (this.purchaseErrorSubscription) {
        this.purchaseErrorSubscription.remove();
        this.purchaseErrorSubscription = null;
      }

      await endConnection();
      this.isInitialized = false;
    } catch (error) {
      console.error('關閉 IAP 連線失敗:', error);
    }
  }

  // 回調函數
  onPurchaseSuccess?: (purchase: Purchase) => void;
  onPurchaseError?: (error: Error | PurchaseError) => void;
}

// 導出單例
export const iapService = new IAPService();

