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
import tokenStorage from '../auth/Storage';

// 商品 ID 類型（現在從伺服器動態獲取，不再硬編碼）
export type ProductId = string;

class IAPService {
  private purchaseUpdateSubscription: any = null;
  private purchaseErrorSubscription: any = null;
  private isInitialized = false;
  private cachedProducts: Product[] = []; // 緩存已獲取的商品列表

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
        console.warn('[iapService]');
        console.warn('[iapService] ⚠️ 如果看到 "Phenotype API error" 或 "Stale snapshot" 錯誤：');
        console.warn('[iapService]    這表示 Google Play Services 配置過期');
        console.warn('[iapService]    解決方法：');
        console.warn('[iapService]    1. 更新 Google Play Services 到最新版本');
        console.warn('[iapService]    2. 清除 Google Play Services 緩存');
        console.warn('[iapService]    3. 重啟設備');
        console.warn('[iapService]    詳細指南請查看：GOOGLE_PLAY_SERVICES_ERROR_ANALYSIS.md');
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
        console.error('[iapService]    → ⚠️ 重要：IAP 與 Google Sign-In 使用不同的驗證機制！');
        console.error('[iapService]    → Google Sign-In 使用 Google Cloud Console 的 SHA-1 配置');
        console.error('[iapService]    → IAP 使用 Google Play Console 的應用簽名驗證');
        console.error('[iapService]    → 解決方案：');
        console.error('[iapService]      a. 確認應用已發布到測試軌道（狀態為「已發布」，不是「草稿」）');
        console.error('[iapService]      b. 確認使用 Google Play 應用簽署時，使用「應用簽名證書」的 SHA-1');
        console.error('[iapService]      c. 在 Google Play Console 中建立商品（item_001, item_002 等）');
        console.error('[iapService]      d. 將測試帳號加入測試人員名單');
        console.error('[iapService]      e. 等待 30-60 分鐘讓 Google Play 同步配置');
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
   * 監聽 Google Play / App Store 返回的購買結果
   */
  private setupPurchaseListeners() {
    // 監聽購買更新（成功、取消、失敗都會觸發）
    this.purchaseUpdateSubscription = purchaseUpdatedListener(
      async (purchase: Purchase) => {
        console.log('[iapService] ========== 收到購買更新 ==========');
        console.log('[iapService] 購買物件:', JSON.stringify(purchase, null, 2));
        
        try {
          // 提取購買資訊
          const purchaseInfo = this.extractPurchaseInfo(purchase);
          
          // 記錄購買資訊（包含收據號碼）
          this.logPurchaseInfo(purchaseInfo);
          
          // 驗證購買是否有效
          if (!purchase || !purchaseInfo.transactionId) {
            console.warn('[iapService] ⚠️ 購買物件無效或缺少交易 ID');
            throw new Error('無效的購買物件');
          }
          
          // 檢查購買狀態
          const purchaseState = (purchase as any).purchaseStateAndroid;
          if (purchaseState !== undefined) {
            // Android 購買狀態：0 = 已購買, 1 = 已取消, 2 = 待處理
            if (purchaseState === 1) {
              console.log('[iapService] ⚠️ 購買已取消');
              // 即使取消，也要完成交易以避免重複處理
              await finishTransaction({ purchase, isConsumable: true });
              return;
            } else if (purchaseState === 2) {
              console.log('[iapService] ⚠️ 購買待處理（可能需要用戶確認）');
            }
          }
          
          // 驗證收據（調用後端 API）
          console.log('[iapService] 開始驗證收據...');
          const verificationResult = await this.verifyReceipt(purchase);
          
          // 只有驗證成功時才完成交易並觸發成功回調
          if (verificationResult.success) {
            // 完成交易（標記為已處理）
            // 重要：必須調用 finishTransaction，否則 Google Play 會認為交易未完成
            console.log('[iapService] 完成交易（finishTransaction）...');
            await finishTransaction({ purchase, isConsumable: true });
            console.log('[iapService] ✓ 交易已完成');
            
            // 獲取商品名稱（用於顯示）
            const productId = purchase.productId || (purchase as any).productId;
            const productName = this.cachedProducts.find(
              (p: any) => (p as any).productId === productId || p.id === productId
            )?.title || productId || '商品';
            
            // 觸發購買成功回調（傳遞驗證結果和商品名稱）
            console.log('[iapService] 觸發購買成功回調...');
            this.onPurchaseSuccess?.(purchase, {
              productName,
              coinsAdded: verificationResult.coinsAdded || 0,
              message: verificationResult.message,
            });
            
            console.log('[iapService] ========== 購買處理完成 ==========');
          } else {
            // 驗證失敗，記錄錯誤但不完成交易（讓用戶可以重試）
            console.error('[iapService] ❌ 收據驗證失敗:', verificationResult.message);
            throw new Error(verificationResult.message || '收據驗證失敗');
          }
        } catch (error) {
          console.error('[iapService] ========== 處理購買時發生錯誤 ==========');
          console.error('[iapService] 錯誤:', error);
          console.error('[iapService] 購買物件:', JSON.stringify(purchase, null, 2));
          console.error('[iapService] ===========================================');
          
          // 即使處理失敗，也要嘗試完成交易（避免重複處理）
          try {
            await finishTransaction({ purchase, isConsumable: true });
            console.log('[iapService] ✓ 已強制完成交易（避免重複處理）');
          } catch (finishError) {
            console.error('[iapService] ❌ 完成交易失敗:', finishError);
          }
          
          // 觸發購買錯誤回調
          this.onPurchaseError?.(error as Error);
        }
      }
    );

    // 監聽購買錯誤（用戶取消、支付失敗等）
    this.purchaseErrorSubscription = purchaseErrorListener(
      (error: PurchaseError) => {
        console.error('[iapService] ========== 購買錯誤 ==========');
        console.error('[iapService] 錯誤代碼:', error.code);
        console.error('[iapService] 錯誤訊息:', error.message);
        console.error('[iapService] 錯誤詳情:', JSON.stringify(error, null, 2));
        
        // 判斷錯誤類型
        const errorCode = String(error.code || '');
        const errorMessage = String(error.message || '');
        
        if (errorCode.includes('CANCELLED') || errorMessage.toLowerCase().includes('cancel')) {
          console.log('[iapService] ℹ️ 用戶取消了購買');
        } else if (errorCode.includes('NETWORK') || errorMessage.toLowerCase().includes('network')) {
          console.error('[iapService] ❌ 網絡錯誤，請檢查網絡連接');
        } else {
          console.error('[iapService] ❌ 購買失敗:', errorMessage);
        }
        
        console.error('[iapService] =================================');
        
        // 觸發購買錯誤回調
        this.onPurchaseError?.(error);
      }
    );
    
    console.log('[iapService] ✓ 購買監聽器已設置');
  }

  /**
   * 提取購買資訊
   */
  private extractPurchaseInfo(purchase: Purchase): {
    transactionId: string;
    transactionReceipt: string;
    purchaseToken: string;
    productId: string;
    orderId: string;
    purchaseTime: number;
    platform: string;
  } {
    const purchaseAny = purchase as any;
    
    return {
      transactionId: purchase.transactionId || purchaseAny.transactionId || purchaseAny.orderId || 'N/A',
      transactionReceipt: (purchase as any).transactionReceipt || purchaseAny.transactionReceipt || purchaseAny.receipt || 'N/A',
      purchaseToken: purchaseAny.purchaseToken || purchaseAny.token || 'N/A',
      productId: purchase.productId || purchaseAny.productId || purchaseAny.productIds?.[0] || 'N/A',
      orderId: purchaseAny.orderId || purchase.transactionId || 'N/A',
      purchaseTime: purchaseAny.purchaseTime || purchaseAny.purchaseTimeMillis || Date.now(),
      platform: Platform.OS,
    };
  }

  /**
   * 從 token 中解析用戶 ID（如果是 JWT）
   * 如果無法解析，則返回 token 本身作為備選方案
   */
  private async getUserId(): Promise<string> {
    try {
      const token = await tokenStorage.getToken();
      if (!token) {
        console.warn('[iapService] ⚠️ 無法獲取 token，使用預設 userId');
        return 'unknown_user';
      }

      // 嘗試解析 JWT token
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          // 嘗試從 payload 中獲取 userId、id、sub 等常見字段
          const userId = payload.userId || payload.id || payload.sub || payload.user_id;
          if (userId) {
            console.log('[iapService] ✓ 從 token 中解析到 userId:', userId);
            return String(userId);
          }
        }
      } catch {
        // 如果不是 JWT 格式，忽略錯誤
        console.log('[iapService] token 不是 JWT 格式，使用 token 作為 userId');
      }

      // 如果無法解析，使用 token 的前 20 個字符作為 userId（避免過長）
      return token.substring(0, 20);
    } catch (error) {
      console.error('[iapService] 獲取 userId 失敗:', error);
      return 'unknown_user';
    }
  }

  /**
   * 驗證收據（調用後端 API）
   * @param purchase - 購買物件
   * @param productName - 商品名稱（用於顯示）
   * @returns Promise<{ success: boolean; coinsAdded?: number; message?: string }>
   */
  private async verifyReceipt(
    purchase: Purchase,
    productName?: string
  ): Promise<{ success: boolean; coinsAdded?: number; message?: string }> {
    try {
      console.log('[iapService] ========== 開始驗證收據 ==========');
      
      // 獲取購買資訊
      const purchaseInfo = this.extractPurchaseInfo(purchase);
      const platform = Platform.OS === 'android' ? 'GOOGLE' : 'APPLE';
      
      // 獲取 userId
      const userId = await this.getUserId();
      
      // 準備請求資料
      // 對於 Google Play，使用 purchaseToken 作為 receipt
      const receipt = purchaseInfo.purchaseToken !== 'N/A' 
        ? purchaseInfo.purchaseToken 
        : purchaseInfo.transactionReceipt;
      
      const requestData = {
        platform,
        receipt,
        userId,
      };
      
      console.log('[iapService] 驗證請求資料:', JSON.stringify({
        ...requestData,
        receipt: receipt.substring(0, 50) + '...', // 只顯示前 50 個字符
      }, null, 2));
      
      // 調用驗證 API
      const apiUrl = 'http://20.198.216.126:3001/api/iap/verify';
      console.log('[iapService] API URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[iapService] ❌ API 響應錯誤:', response.status, errorText);
        throw new Error(`驗證收據失敗: HTTP ${response.status}`);
      }
      
      const result = await response.json();
      console.log('[iapService] ✓ 驗證 API 響應:', JSON.stringify(result, null, 2));
      
      if (result.success) {
        console.log('[iapService] ✓ 收據驗證成功');
        console.log('[iapService]   獲取金幣:', result.coinsAdded || 0);
        console.log('[iapService]   訊息:', result.message);
        
        return {
          success: true,
          coinsAdded: result.coinsAdded,
          message: result.message,
        };
      } else {
        console.warn('[iapService] ⚠️ 收據驗證失敗:', result.message);
        return {
          success: false,
          message: result.message || '收據驗證失敗',
        };
      }
    } catch (error) {
      console.error('[iapService] ========== 驗證收據時發生錯誤 ==========');
      console.error('[iapService] 錯誤:', error);
      if (error instanceof Error) {
        console.error('[iapService] 錯誤訊息:', error.message);
        console.error('[iapService] 錯誤堆疊:', error.stack);
      }
      console.error('[iapService] ===========================================');
      
      return {
        success: false,
        message: error instanceof Error ? error.message : '驗證收據時發生未知錯誤',
      };
    }
  }

  /**
   * 記錄購買資訊（包含收據號碼）
   */
  private logPurchaseInfo(info: ReturnType<typeof this.extractPurchaseInfo>): void {
    console.log('[iapService] ========== 購買資訊 ==========');
    console.log('[iapService] 📦 商品 ID:', info.productId);
    console.log('[iapService] 🧾 交易 ID (Transaction ID):', info.transactionId);
    console.log('[iapService] 🎫 訂單 ID (Order ID):', info.orderId);
    console.log('[iapService] 🔑 購買 Token (Purchase Token):', info.purchaseToken);
    console.log('[iapService] 📄 交易收據 (Transaction Receipt):', info.transactionReceipt);
    console.log('[iapService] ⏰ 購買時間:', new Date(info.purchaseTime).toISOString());
    console.log('[iapService] 📱 平台:', info.platform);
    console.log('[iapService] =================================');
    
    // 特別標記收據號碼（用於封閉測試期間追蹤）
    console.log('[iapService] ════════════════════════════════════');
    console.log('[iapService] 🧾 收據號碼（用於測試追蹤）:');
    console.log('[iapService]    Transaction ID:', info.transactionId);
    console.log('[iapService]    Order ID:', info.orderId);
    console.log('[iapService]    Purchase Token:', info.purchaseToken);
    console.log('[iapService] ════════════════════════════════════');
  }

  /**
   * 獲取商品列表
   * @param productIds - 商品 ID 列表（必須提供，從伺服器獲取）
   */
  async getProductList(productIds: string[]): Promise<Product[]> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // 必須提供商品 ID 列表
      if (!productIds || productIds.length === 0) {
        console.warn('[iapService] ⚠️ 未提供商品 ID 列表，無法獲取商品');
        return [];
      }

      const skus = productIds;
      
      console.log('[iapService] ========== 開始獲取商品列表 ==========');
      console.log('[iapService] 使用的商品 ID 列表:', JSON.stringify(skus, null, 2));
      console.log('[iapService] 商品 ID 數量:', skus.length);
      console.log('[iapService] 平台:', Platform.OS);
      
      const products = await fetchProducts({ skus });
      
      // fetchProducts 可能返回 null，需要處理
      if (!products) {
        console.warn('[iapService] ⚠️ fetchProducts 返回 null');
        console.warn('[iapService] 這通常表示：');
        console.warn('[iapService] 1. 商品 ID 與 Google Play Console 中的不一致');
        console.warn('[iapService] 2. 應用未發布到測試軌道');
        console.warn('[iapService] 3. 測試帳號未加入測試人員');
        console.warn('[iapService] 4. 在模擬器上運行（Google Play Billing 不支持模擬器）');
        return [];
      }
      
      console.log('[iapService] ✓ 成功獲取商品數量:', products.length);
      
      // 顯示原始返回的商品結構（用於調試）
      if (products.length > 0) {
        console.log('[iapService] 📦 原始返回的商品結構:');
        products.forEach((p: any, index: number) => {
          console.log(`[iapService]   商品 ${index + 1}:`, JSON.stringify({
            id: p.id,
            productId: p.productId,
            type: p.type,
            hasProductId: 'productId' in p,
            hasId: 'id' in p,
            hasSubscriptionPeriod: 'subscriptionPeriodUnitIOS' in p,
            allKeys: Object.keys(p),
          }, null, 2));
        });
      }
      
      if (products.length === 0) {
        console.error('[iapService] ⚠️⚠️⚠️ 獲取到 0 個商品！⚠️⚠️⚠️');
        console.error('[iapService] ========== 詳細診斷資訊 ==========');
        console.error('[iapService] 這是 Google Play IAP 最常見的問題之一');
        console.error('[iapService]');
        console.error('[iapService] 📋 當前請求的商品 ID:');
        skus.forEach((sku, index) => {
          console.error(`[iapService]   ${index + 1}. ${sku}`);
        });
        console.error('[iapService]');
        console.error('[iapService] 🔍 請按照以下順序逐步檢查：');
        console.error('[iapService]');
        console.error('[iapService] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('[iapService] 1️⃣  應用是否已發布到測試軌道？（最常見）');
        console.error('[iapService]    ⚠️  這是最常見的原因！');
        console.error('[iapService]    📍 路徑：Google Play Console → 您的應用 → 測試 → [選擇測試軌道]');
        console.error('[iapService]    ✅ 檢查：');
        console.error('[iapService]       - 狀態必須顯示為「已發布」而非「草稿」或「審核中」');
        console.error('[iapService]       - 必須完成整個發布流程（上傳 → 填寫資訊 → 審核 → 發布）');
        console.error('[iapService]       - 等待發布完成（通常需要 5-15 分鐘）');
        console.error('[iapService]');
        console.error('[iapService] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('[iapService] 2️⃣  測試帳號是否已加入測試人員？');
        console.error('[iapService]    📍 路徑：測試軌道 → 測試人員 → 添加測試人員');
        console.error('[iapService]    ✅ 檢查：');
        console.error('[iapService]       - 設備上的 Google 帳號必須在測試人員列表中');
        console.error('[iapService]       - 如果使用「電子郵件地址列表」，需要接受測試邀請');
        console.error('[iapService]       - 等待幾分鐘讓 Google Play 同步');
        console.error('[iapService]');
        console.error('[iapService] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('[iapService] 3️⃣  商品狀態是否為「已啟用」？');
        console.error('[iapService]    📍 路徑：Google Play Console → 您的應用 → 貨幣化 → 產品和訂閱 → 應用內商品');
        console.error('[iapService]    ✅ 檢查每個商品（item_001 到 item_006）：');
        console.error('[iapService]       - 狀態必須為「已啟用」（不是「草稿」）');
        console.error('[iapService]       - 商品 ID 必須與程式碼完全一致（區分大小寫）');
        console.error('[iapService]       - 價格已設定');
        console.error('[iapService]       - 名稱已設定');
        console.error('[iapService]');
        console.error('[iapService] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('[iapService] 4️⃣  商品 ID 是否完全一致？（區分大小寫）');
        console.error('[iapService]    ⚠️  必須完全一致，包括大小寫、空格、特殊字符');
        console.error('[iapService]    ✅ 程式碼中的 ID:');
        skus.forEach((sku) => {
          console.error(`[iapService]       "${sku}"`);
        });
        console.error('[iapService]    ❌ 常見錯誤：');
        console.error('[iapService]       - Item_001（大寫 I）- 錯誤');
        console.error('[iapService]       - item_001 （尾隨空格）- 錯誤');
        console.error('[iapService]       - item_1（少了一個 0）- 錯誤');
        console.error('[iapService]    ✅ 必須是：');
        console.error('[iapService]       - item_001（完全一致）- 正確');
        console.error('[iapService]');
        console.error('[iapService] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('[iapService] 5️⃣  應用簽名是否正確？');
        console.error('[iapService]    📍 路徑：Google Play Console → 您的應用 → 發布 → 應用簽名');
        console.error('[iapService]    ✅ 檢查：');
        console.error('[iapService]       - 如果使用「Google Play 應用簽署」，使用提供的測試證書');
        console.error('[iapService]       - 確保本地 APK 簽名與 Google Play 一致');
        console.error('[iapService]');
        console.error('[iapService] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('[iapService] 6️⃣  是否等待足夠時間？（Google Play 同步延遲）');
        console.error('[iapService]    ⏰ 等待時間：');
        console.error('[iapService]       - 商品建立/啟用後：5-30 分鐘');
        console.error('[iapService]       - 測試軌道發布後：10-60 分鐘');
        console.error('[iapService]       - 第一次安裝測試版本後：可能需要更長時間');
        console.error('[iapService]    ✅ 建議：');
        console.error('[iapService]       - 清除 Google Play 商店快取');
        console.error('[iapService]       - 重啟設備');
        console.error('[iapService]       - 卸載並重新安裝測試版本');
        console.error('[iapService]       - 等待 30-60 分鐘後再試');
        console.error('[iapService]');
        console.error('[iapService] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('[iapService] 7️⃣  Package Name 是否一致？');
        console.error('[iapService]    ✅ 檢查：com.rueiyang.story');
        console.error('[iapService]       - app.json');
        console.error('[iapService]       - AndroidManifest.xml');
        console.error('[iapService]       - build.gradle (applicationId)');
        console.error('[iapService]       - Google Play Console');
        console.error('[iapService]');
        console.error('[iapService] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('[iapService] 8️⃣  是否在真實設備上測試？');
        console.error('[iapService]    ⚠️  Google Play Billing 不支持模擬器');
        console.error('[iapService]    ✅ 必須在真實的 Android 設備上測試');
        console.error('[iapService]');
        console.error('[iapService] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('[iapService] 📚 詳細診斷指南：');
        console.error('[iapService]    請查看 GOOGLE_PLAY_FETCH_PRODUCTS_TROUBLESHOOTING.md');
        console.error('[iapService] ============================================');
      } else {
        console.log('[iapService] 商品詳情:');
        products.forEach((p, index) => {
          console.log(`[iapService] 商品 ${index + 1}:`, {
            id: p.id,
            title: p.title,
            description: p.description,
            price: p.price,
            displayPrice: p.displayPrice,
            currency: p.currency,
          });
        });
      }
      
      // 過濾出 Product 類型（排除訂閱類型）
      // 注意：react-native-iap 返回的 Product 可能使用 'id' 或 'productId' 屬性
      const filteredProducts = products
        .filter((p: any) => {
          // 檢查是否有 productId 或 id 屬性（都表示這是一個商品）
          const hasProductId = 'productId' in p || 'id' in p;
          // 排除訂閱類型（訂閱有 subscriptionPeriodUnitIOS 屬性）
          const isNotSubscription = !('subscriptionPeriodUnitIOS' in p);
          return hasProductId && isNotSubscription;
        })
        .map((p: any) => {
          // 統一處理：確保所有商品都有 productId 和 id 屬性
          // 如果只有 id，則複製到 productId；如果只有 productId，則複製到 id
          if (!p.productId && p.id) {
            p.productId = p.id;
          }
          if (!p.id && p.productId) {
            p.id = p.productId;
          }
          return p as Product;
        });
      
      console.log('[iapService] 過濾後的商品數量:', filteredProducts.length);
      if (filteredProducts.length !== products.length) {
        console.warn('[iapService] ⚠️ 過濾掉了一些商品，原始數量:', products.length);
        console.warn('[iapService] 過濾後的商品 ID:', filteredProducts.map((p: any) => p.productId || p.id));
      }
      
      // 顯示過濾後的商品資訊
      if (filteredProducts.length > 0) {
        console.log('[iapService] ✅ 過濾後的商品列表:');
        filteredProducts.forEach((p: any, index: number) => {
          console.log(`[iapService]   商品 ${index + 1}:`, {
            id: p.id,
            productId: p.productId,
            title: p.title || '(無標題)',
            price: p.price || p.displayPrice || '(無價格)',
          });
        });
      }
      
      console.log('[iapService] ==========================================');
      
      // 更新緩存的商品列表
      this.cachedProducts = filteredProducts;
      
      return filteredProducts;
    } catch (error) {
      console.error('[iapService] ========== 獲取商品列表失敗 ==========');
      console.error('[iapService] 錯誤:', error);
      if (error instanceof Error) {
        console.error('[iapService] 錯誤訊息:', error.message);
        console.error('[iapService] 錯誤堆疊:', error.stack);
      }
      console.error('[iapService] ==========================================');
      throw error;
    }
  }

  /**
   * 購買商品
   * @param productId - 商品 ID（從伺服器獲取）
   */
  async purchaseProduct(productId: ProductId): Promise<void> {
    try {
      // 驗證 productId
      if (!productId || typeof productId !== 'string' || productId.trim() === '') {
        throw new Error('Invalid product ID: productId is required and must be a non-empty string');
      }

      console.log('[iapService] ========== 開始購買流程 ==========');
      console.log('[iapService] 商品 ID:', productId);
      console.log('[iapService] 當前初始化狀態:', this.isInitialized);

      // 確保已初始化
      if (!this.isInitialized) {
        console.log('[iapService] IAP 未初始化，開始初始化...');
        const initialized = await this.initialize();
        if (!initialized) {
          throw new Error('無法初始化 IAP 服務。請確保：1) 在真實設備上運行 2) 已安裝 Google Play 服務 3) 應用已正確配置');
        }
      }

      // 根據 react-native-iap v14.4.5 的文檔
      // 重要：可能需要先獲取商品詳情，然後使用商品對象購買
      // 嘗試多種方法來確保購買成功
      
      console.log('[iapService] 準備購買，商品 ID:', productId);
      console.log('[iapService] 平台:', Platform.OS);
      console.log('[iapService] 緩存的商品數量:', this.cachedProducts.length);
      
      // 方法 1: 嘗試從緩存的商品中找到對應的商品對象
      let product: Product | undefined = this.cachedProducts.find(
        (p) => (p as any).productId === productId || p.id === productId
      );
      
      if (product) {
        const productIdValue = (product as any).productId || product.id;
        console.log('[iapService] ✓ 從緩存中找到商品:', productIdValue);
      } else {
        console.log('[iapService] ⚠️ 緩存中沒有找到商品，嘗試獲取商品詳情...');
        // 如果緩存中沒有，嘗試獲取商品詳情
        try {
          const products = await this.getProductList([productId]);
          product = products.find((p) => (p as any).productId === productId || p.id === productId);
          if (product) {
            console.log('[iapService] ✓ 成功獲取商品詳情');
          }
        } catch (error) {
          console.warn('[iapService] ⚠️ 獲取商品詳情失敗，將使用商品 ID:', error);
        }
      }
      
      // 診斷：檢查商品是否可獲取
      const productIdValue = product ? ((product as any).productId || product.id) : productId;
      
      if (!product) {
        console.warn('[iapService] ⚠️⚠️⚠️ 警告：無法從 Google Play 獲取商品詳情 ⚠️⚠️⚠️');
        console.warn('[iapService] ⚠️ 這是最可能導致「找不到您要購買的項目」錯誤的原因！');
        console.warn('[iapService]');
        console.warn('[iapService] 📋 診斷資訊：');
        console.warn(`[iapService]   嘗試購買的商品 ID: "${productIdValue}"`);
        console.warn('[iapService]   緩存中的商品數量:', this.cachedProducts.length);
        console.warn('[iapService]   緩存中的商品 ID 列表:', this.cachedProducts.map((p: any) => (p as any).productId || p.id));
        console.warn('[iapService]');
        console.warn('[iapService] 🔍 請檢查以下項目：');
        console.warn('[iapService]   1. ✅ 商品 ID 是否與 Google Play Console 中的完全一致（區分大小寫）');
        console.warn('[iapService]   2. ✅ 應用是否已發布到測試軌道（狀態為「已發布」）');
        console.warn('[iapService]   3. ✅ 測試帳號是否已加入測試人員名單');
        console.warn('[iapService]   4. ✅ 商品是否已啟用（不是草稿狀態）');
        console.warn('[iapService]   5. ✅ fetchProducts 是否能成功獲取該商品');
        console.warn('[iapService]');
        console.warn('[iapService] 💡 建議：');
        console.warn('[iapService]   - 先確保 fetchProducts 能成功獲取該商品');
        console.warn('[iapService]   - 如果 fetchProducts 返回空，購買時也會找不到商品');
        console.warn('[iapService]   - 詳細排查指南請查看：GOOGLE_PLAY_FETCH_PRODUCTS_TROUBLESHOOTING.md');
        console.warn('[iapService] ⚠️⚠️⚠️ 將嘗試購買，但可能會失敗 ⚠️⚠️⚠️');
      } else {
        console.log('[iapService] ✓ 商品詳情已獲取，商品 ID:', productIdValue);
        console.log('[iapService]   商品名稱:', (product as any).title || product.id);
        console.log('[iapService]   商品價格:', (product as any).price || (product as any).displayPrice || 'N/A');
      }
      
      // 嘗試多種格式（react-native-iap v14.4.5 可能需要不同的格式）
      
      // 購買前的最終驗證
      console.log('[iapService] ========== 購買前最終驗證 ==========');
      console.log('[iapService] 📋 準備購買的商品資訊:');
      console.log('[iapService]   商品 ID:', productIdValue);
      console.log('[iapService]   是否在緩存中:', !!product);
      if (product) {
        console.log('[iapService]   商品詳情:', {
          id: (product as any).id || (product as any).productId,
          title: (product as any).title,
          price: (product as any).price || (product as any).displayPrice,
        });
      }
      console.log('[iapService]   緩存中的商品 ID 列表:', this.cachedProducts.map((p: any) => (p as any).productId || p.id));
      console.log('[iapService]');
      console.log('[iapService] ⚠️ 如果 Google Play 顯示「找不到您要購買的項目」:');
      console.log('[iapService]   1. 檢查商品 ID 是否與 Google Play Console 完全一致');
      console.log('[iapService]   2. 確認商品在 Google Play Console 中狀態為「已啟用」');
      console.log('[iapService]   3. 確認應用已發布到測試軌道（狀態為「已發布」）');
      console.log('[iapService]   4. 等待 30-60 分鐘讓 Google Play 完全同步商品資訊');
      console.log('[iapService]   5. 清除 Google Play 商店快取並重啟設備');
      console.log('[iapService] ==========================================');
      
      // 方法 1: 嘗試嵌套的 request 格式
      try {
        console.log('[iapService] 嘗試方法 1: 嵌套 request 格式');
        
        // react-native-iap v14.4.5 可能需要嵌套格式
        const config1 = {
          request: Platform.OS === 'android' 
            ? {
                android: {
                  skus: [productIdValue],
                },
              }
            : {
                ios: {
                  sku: productIdValue,
                },
              },
        };
        
        console.log('[iapService] 購買配置 (方法 1):', JSON.stringify(config1, null, 2));
        console.log('[iapService] ⚠️ 即將調用 requestPurchase，商品 ID:', productIdValue);
        console.log('[iapService] ⚠️ 如果 Google Play 顯示「找不到」，請檢查上述驗證項目');
        
        await requestPurchase(config1 as any);
        
        console.log('[iapService] ✅✅✅ 方法 1 成功（嵌套格式）✅✅✅');
        console.log('[iapService] ✓ requestPurchase 調用成功');
        console.log('[iapService] ⏳ 等待 Google Play 返回購買結果...');
        console.log('[iapService] 📱 Google Play 購買介面應該已經打開');
        console.log('[iapService] 💡 請在 Google Play 購買介面中完成購買操作');
        console.log('[iapService] 💡 購買完成後，結果將通過 purchaseUpdatedListener 回傳');
        console.log('[iapService] 💡 請查看日誌中的「收到購買更新」訊息');
        return;
      } catch (error1: any) {
        console.warn('[iapService] 方法 1 失敗:', error1?.message);
        
        // 方法 2: 嘗試直接使用 skus 格式
        try {
          console.log('[iapService] 嘗試方法 2: 直接 skus 格式');
          
          const config2 = Platform.OS === 'android' 
            ? { skus: [productIdValue] }
            : { sku: productIdValue };
          
          console.log('[iapService] 購買配置 (方法 2):', JSON.stringify(config2, null, 2));
          await requestPurchase(config2 as any);
          
          console.log('[iapService] ✓ 方法 2 成功（直接 skus 格式）');
          console.log('[iapService] ⏳ 等待 Google Play 返回購買結果...');
          return;
        } catch (error2: any) {
          console.warn('[iapService] 方法 2 失敗:', error2?.message);
          
          // 方法 3: 嘗試使用 sku（單數）格式
          try {
            console.log('[iapService] 嘗試方法 3: sku 單數格式');
            
            const config3 = { sku: productIdValue };
            
            console.log('[iapService] 購買配置 (方法 3):', JSON.stringify(config3, null, 2));
            await requestPurchase(config3 as any);
            
            console.log('[iapService] ✓ 方法 3 成功（sku 單數格式）');
            console.log('[iapService] ⏳ 等待 Google Play 返回購買結果...');
            return;
          } catch (error3: any) {
            // 所有方法都失敗，拋出最後一個錯誤
            console.error('[iapService] ❌ 所有購買方法都失敗');
            const finalError = error3 || error2 || error1;
            const errorMsg = String(finalError?.message || '').toLowerCase();
            
            console.error('[iapService] ========== 購買失敗 ==========');
            console.error('[iapService] 錯誤:', finalError?.message);
            console.error('[iapService] 嘗試購買的商品 ID:', productIdValue);
            
            // 如果是「找不到商品」的錯誤，提供詳細診斷
            if (errorMsg.includes('item') && (errorMsg.includes('not found') || errorMsg.includes('找不到'))) {
              console.error('[iapService] ========== 商品找不到錯誤診斷 ==========');
              console.error('[iapService] ❌ 錯誤：找不到商品');
              console.error(`[iapService] 嘗試購買的商品 ID: "${productIdValue}"`);
              console.error('[iapService]');
              console.error('[iapService] 最可能的原因：');
              console.error('[iapService]   1. ❌ fetchProducts 無法獲取該商品');
              console.error('[iapService]      → 請確認商品是否在 fetchProducts 的返回列表中');
              console.error('[iapService]   2. ❌ 商品 ID 不匹配（區分大小寫、空格等）');
              console.error('[iapService]      → 請與 Google Play Console 中的商品 ID 完全對比');
              console.error('[iapService]   3. ❌ 商品在 Google Play Console 中未啟用或不存在');
              console.error('[iapService] ==========================================');
            }
            
            console.error('[iapService] ==========================================');
            
            // 重新拋出錯誤，讓上層處理
            throw finalError;
          }
        }
      }
    } catch (error) {
      console.error('[iapService] ========== 購買失敗 ==========');
      console.error('[iapService] 錯誤:', error);
      console.error('[iapService] 錯誤詳情:', {
        message: error instanceof Error ? error.message : String(error),
        productId,
        isInitialized: this.isInitialized,
        platform: Platform.OS,
      });
      console.error('[iapService] =================================');
      
      // 重新拋出錯誤，讓上層處理
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
  onPurchaseSuccess?: (
    purchase: Purchase,
    verificationResult?: {
      productName: string;
      coinsAdded: number;
      message?: string;
    }
  ) => void;
  onPurchaseError?: (error: Error | PurchaseError) => void;
}

// 導出單例
export const iapService = new IAPService();

