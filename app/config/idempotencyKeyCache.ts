/**
 * IdempotencyKey 緩存管理工具
 * 用於防止重複購買，每個 storyListId 對應一個 idempotencyKey
 * 購買成功後清除緩存，失敗時保留緩存以便重試
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateUUID } from './utils';

const IDEMPOTENCY_KEY_PREFIX = 'idempotencyKey_';
const IDEMPOTENCY_KEY_MAP_KEY = 'idempotencyKeyMap'; // 用於存儲所有 key 的映射表

/**
 * 獲取或創建指定故事的 idempotencyKey
 * 如果緩存中已存在，返回緩存的 key；否則創建新的 key 並緩存
 * @param storyListId - 故事 ID
 * @returns Promise<string> idempotencyKey
 */
export async function getOrCreateIdempotencyKey(storyListId: number): Promise<string> {
  try {
    const cacheKey = `${IDEMPOTENCY_KEY_PREFIX}${storyListId}`;
    
    // 嘗試從緩存中獲取
    const cachedKey = await AsyncStorage.getItem(cacheKey);
    
    if (cachedKey) {
      console.log(`[idempotencyKeyCache] ✓ 找到緩存的 idempotencyKey (storyListId: ${storyListId}):`, cachedKey);
      return cachedKey;
    }
    
    // 如果緩存中沒有，創建新的 UUID
    const newKey = generateUUID();
    console.log(`[idempotencyKeyCache] ✨ 創建新的 idempotencyKey (storyListId: ${storyListId}):`, newKey);
    
    // 保存到緩存
    await AsyncStorage.setItem(cacheKey, newKey);
    
    // 更新映射表（用於管理所有緩存的 key）
    await updateIdempotencyKeyMap(storyListId);
    
    return newKey;
  } catch (error) {
    console.error(`[idempotencyKeyCache] 獲取或創建 idempotencyKey 失敗 (storyListId: ${storyListId}):`, error);
    // 如果緩存失敗，仍然返回新的 UUID（至少保證功能可用）
    return generateUUID();
  }
}

/**
 * 清除指定故事的 idempotencyKey 緩存（購買成功時調用）
 * @param storyListId - 故事 ID
 */
export async function clearIdempotencyKey(storyListId: number): Promise<void> {
  try {
    const cacheKey = `${IDEMPOTENCY_KEY_PREFIX}${storyListId}`;
    await AsyncStorage.removeItem(cacheKey);
    
    // 從映射表中移除
    await removeFromIdempotencyKeyMap(storyListId);
    
    console.log(`[idempotencyKeyCache] ✓ 已清除 idempotencyKey 緩存 (storyListId: ${storyListId})`);
  } catch (error) {
    console.error(`[idempotencyKeyCache] 清除 idempotencyKey 緩存失敗 (storyListId: ${storyListId}):`, error);
  }
}

/**
 * 清除所有 idempotencyKey 緩存（可選，用於登出或清理時）
 */
export async function clearAllIdempotencyKeys(): Promise<void> {
  try {
    // 獲取映射表
    const mapJson = await AsyncStorage.getItem(IDEMPOTENCY_KEY_MAP_KEY);
    if (!mapJson) {
      console.log('[idempotencyKeyCache] 沒有需要清除的 idempotencyKey');
      return;
    }
    
    const storyListIds: number[] = JSON.parse(mapJson);
    
    // 清除所有緩存的 key
    const removePromises = storyListIds.map(storyListId => {
      const cacheKey = `${IDEMPOTENCY_KEY_PREFIX}${storyListId}`;
      return AsyncStorage.removeItem(cacheKey);
    });
    
    await Promise.all(removePromises);
    
    // 清除映射表
    await AsyncStorage.removeItem(IDEMPOTENCY_KEY_MAP_KEY);
    
    console.log(`[idempotencyKeyCache] ✓ 已清除所有 idempotencyKey 緩存 (共 ${storyListIds.length} 個)`);
  } catch (error) {
    console.error('[idempotencyKeyCache] 清除所有 idempotencyKey 緩存失敗:', error);
  }
}

/**
 * 更新 idempotencyKey 映射表（內部函數）
 */
async function updateIdempotencyKeyMap(storyListId: number): Promise<void> {
  try {
    const mapJson = await AsyncStorage.getItem(IDEMPOTENCY_KEY_MAP_KEY);
    const storyListIds: number[] = mapJson ? JSON.parse(mapJson) : [];
    
    // 如果不存在，添加到映射表
    if (!storyListIds.includes(storyListId)) {
      storyListIds.push(storyListId);
      await AsyncStorage.setItem(IDEMPOTENCY_KEY_MAP_KEY, JSON.stringify(storyListIds));
    }
  } catch (error) {
    console.error('[idempotencyKeyCache] 更新映射表失敗:', error);
  }
}

/**
 * 從映射表中移除指定 storyListId（內部函數）
 */
async function removeFromIdempotencyKeyMap(storyListId: number): Promise<void> {
  try {
    const mapJson = await AsyncStorage.getItem(IDEMPOTENCY_KEY_MAP_KEY);
    if (!mapJson) return;
    
    const storyListIds: number[] = JSON.parse(mapJson);
    const filteredIds = storyListIds.filter(id => id !== storyListId);
    
    if (filteredIds.length === 0) {
      // 如果映射表為空，直接刪除
      await AsyncStorage.removeItem(IDEMPOTENCY_KEY_MAP_KEY);
    } else {
      await AsyncStorage.setItem(IDEMPOTENCY_KEY_MAP_KEY, JSON.stringify(filteredIds));
    }
  } catch (error) {
    console.error('[idempotencyKeyCache] 從映射表移除失敗:', error);
  }
}
