// services/clearUserDataService.ts
import tokenStorage from '../auth/Storage';
import storage from '../storage/storage';
import { clearAllIdempotencyKeys } from '../config/idempotencyKeyCache';
import { markSessionExpired } from '../config/sessionAuth';

/**
 * 清除所有用戶資料的服務
 * 用於登出或 token 刷新失敗時清除所有本地資料
 */
export async function clearAllUserData(): Promise<void> {
  console.log('[clearUserDataService] 🗑️ 開始清除所有資料...');

  // 先上鎖再清資料（清除是 async 的）：登出當下仍在飛的請求會帶著舊 token 回 401，
  // 那是預期中的失敗，不該讓使用者回到登入頁後又被彈一則「帳戶權限過期」。
  // 下次登入成功時由 Storage.saveLoginData → resetSessionExpiredLatch 解鎖。
  markSessionExpired();

  try {
    // 清除 AsyncStorage
    await storage.deleteAllStorage();
    console.log('[clearUserDataService] ✓ AsyncStorage 已清除');
    
    // 清除所有 idempotencyKey 緩存
    await clearAllIdempotencyKeys();
    console.log('[clearUserDataService] ✓ idempotencyKey 緩存已清除');
    
    // 清除 SecureStore 中的所有登入相關資料（accessToken、refreshToken、loginTime）
    await tokenStorage.clearLoginData();
    console.log('[clearUserDataService] ✓ 登入資料已清除（token、refreshToken、loginTime）');
    
    // 清除用戶個人資料
    await tokenStorage.clearUserProfile();
    console.log('[clearUserDataService] ✓ 用戶個人資料已清除');
    
    console.log('[clearUserDataService] ✅ 所有資料已清除完成');
  } catch (error) {
    console.error('[clearUserDataService] ❌ 清除資料時發生錯誤:', error);
    throw error;
  }
}
