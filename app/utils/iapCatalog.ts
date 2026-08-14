// app/utils/iapCatalog.ts
/**
 * 雙平台（Google Play / App Store）內購目錄的共用工具。
 *
 * 原則：App 內不保留任何「商品 ID／金幣數／商品名稱」的固定清單，
 * 一律以後端 api/coin-packs 為單一真實來源。後台新增品項（並在 Google Play Console /
 * App Store Connect 建好同名商品）即可直接上架，不需要改 code 重新發版。
 *
 * 唯一例外是 iosIapSkuMapping 內既有的 6 筆歷史 SKU 對照（item_001↔item_01…），
 * 那是當初命名不一致造成的遺留；新品項請在後端與商店後台使用「完全相同」的 productId。
 */

import { Platform } from 'react-native';
import { getCoinPacks, type CoinPack } from '../config/shopApiClient';
import {
  appStoreSkuMatchesBackendProductId,
  backendProductIdToAppStoreSku,
} from './iosIapSkuMapping';

export type PlatformCode = 'GOOGLE' | 'APPLE';

// 後端 platform 欄位的容許寫法。放寬比對是為了避免新品項因為後台填了 android/ios
// 這類同義值就被整筆濾掉（症狀會是「本平台金幣包數量為 0」，非常難查）。
const GOOGLE_ALIASES = new Set(['GOOGLE', 'GOOGLE_PLAY', 'PLAY', 'PLAY_STORE', 'ANDROID']);
const APPLE_ALIASES = new Set(['APPLE', 'APPLE_STORE', 'APP_STORE', 'APPSTORE', 'ITUNES', 'IOS', 'IPADOS']);

/** 後端 platform 欄位正規化為 GOOGLE / APPLE；無法辨識回傳 UNKNOWN */
export function normalizePlatformValue(value: unknown): PlatformCode | 'UNKNOWN' {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s\-.]+/g, '_');
  if (!normalized) return 'UNKNOWN';
  if (GOOGLE_ALIASES.has(normalized)) return 'GOOGLE';
  if (APPLE_ALIASES.has(normalized)) return 'APPLE';
  return 'UNKNOWN';
}

/** 當前執行平台對應的後端 platform 代碼 */
export const currentPlatformCode: PlatformCode = Platform.OS === 'ios' ? 'APPLE' : 'GOOGLE';

/** 當前平台的商店名稱（僅用於訊息文案） */
export const currentStoreName = Platform.OS === 'ios' ? 'App Store' : 'Google Play';

/** 後端 productId → 送給商店（fetchProducts / requestPurchase）的 SKU */
export function backendProductIdToStoreSku(backendProductId: string): string {
  const trimmed = String(backendProductId ?? '').trim();
  // iOS 需走既有 6 筆歷史對照；查無對照者原樣送出（新品項兩邊 ID 應相同）
  return Platform.OS === 'ios' ? backendProductIdToAppStoreSku(trimmed) : trimmed;
}

/** 商店回傳的 productId 是否對應某一筆後端金幣包 */
export function storeSkuMatchesBackendProductId(
  storeProductId: string,
  backendProductId: string
): boolean {
  const store = String(storeProductId ?? '').trim();
  const backend = String(backendProductId ?? '').trim();
  if (!store || !backend) return false;
  if (store === backend) return true;
  // 僅 iOS 需要額外容許歷史對照；Android 兩邊本來就一致
  return Platform.OS === 'ios' && appStoreSkuMatchesBackendProductId(store, backend);
}

/** 由商店回傳的 productId 反查後端金幣包 */
export function findPackForStoreProductId(
  packs: CoinPack[],
  storeProductId: string
): CoinPack | undefined {
  return packs.find((pack) => storeSkuMatchesBackendProductId(storeProductId, pack.productId));
}

/**
 * 篩出「本平台可販售」的金幣包並依後台 sortOrder 排序。
 * isActive 僅在明確為 false 時排除（欄位缺漏時視為可販售，避免後端沒回該欄就整批消失）。
 */
export function filterPacksForCurrentPlatform(packs: CoinPack[]): CoinPack[] {
  return packs
    .filter((pack) => normalizePlatformValue((pack as any).platform) === currentPlatformCode)
    .filter((pack) => (pack as any).isActive !== false)
    .filter((pack) => typeof pack.productId === 'string' && pack.productId.trim().length > 0)
    .map((pack, index) => ({ pack, index }))
    .sort((a, b) => {
      const sa = Number.isFinite(Number(a.pack.sortOrder)) ? Number(a.pack.sortOrder) : Number.MAX_SAFE_INTEGER;
      const sb = Number.isFinite(Number(b.pack.sortOrder)) ? Number(b.pack.sortOrder) : Number.MAX_SAFE_INTEGER;
      if (sa !== sb) return sa - sb;
      return a.index - b.index; // sortOrder 相同時維持後端回傳順序
    })
    .map(({ pack }) => pack);
}

/** 由金幣包組出要送給商店的 SKU 清單（去重、保序） */
export function buildStoreSkusFromPacks(packs: CoinPack[]): string[] {
  const seen = new Set<string>();
  const skus: string[] = [];
  for (const pack of packs) {
    const sku = backendProductIdToStoreSku(pack.productId);
    if (!sku || seen.has(sku)) continue;
    seen.add(sku);
    skus.push(sku);
  }
  return skus;
}

export type CurrentPlatformCatalog = {
  /** 後端原始回傳（未過濾），供診斷用 */
  allPacks: CoinPack[];
  /** 本平台可販售的金幣包，已依 sortOrder 排序 */
  packs: CoinPack[];
  /** 對應的商店 SKU 清單，順序與 packs 一致 */
  skus: string[];
};

/**
 * 取得本平台的金幣包與商店 SKU 清單。
 * 這是「要向商店查哪些商品」的唯一來源；雙平台共用同一條路徑。
 */
export async function fetchCurrentPlatformCatalog(): Promise<CurrentPlatformCatalog> {
  const allPacks = await getCoinPacks();
  const packs = filterPacksForCurrentPlatform(allPacks);
  const skus = buildStoreSkusFromPacks(packs);
  return { allPacks, packs, skus };
}

export type CatalogDiagnostics = {
  platformCode: PlatformCode;
  /** 後端回傳總筆數（所有平台） */
  total: number;
  /** platform 欄位的原始值分布 */
  rawPlatformStats: Record<string, number>;
  /** platform 欄位正規化後的分布 */
  normalizedPlatformStats: Record<string, number>;
  /** 本平台過濾後可販售筆數 */
  matched: number;
  /** 本平台但被 isActive=false 擋掉的筆數（新品忘記啟用時最常見） */
  inactiveOnThisPlatform: number;
  /** 非本平台的樣本（最多 6 筆），供對照 platform 欄位是否填錯 */
  mismatchedSamples: {
    id: number;
    productId: string;
    platformRaw: unknown;
    platformNormalized: string;
  }[];
};

/** 由後端原始回傳與過濾結果組出診斷資料；「商城沒商品」時用來判斷卡在哪一層 */
export function buildCatalogDiagnostics(
  allPacks: CoinPack[],
  packs: CoinPack[]
): CatalogDiagnostics {
  const rawPlatformStats = allPacks.reduce<Record<string, number>>((acc, pack) => {
    const key = String((pack as any).platform ?? 'undefined');
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const normalizedPlatformStats = allPacks.reduce<Record<string, number>>((acc, pack) => {
    const key = normalizePlatformValue((pack as any).platform);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const inactiveOnThisPlatform = allPacks.filter(
    (pack) =>
      normalizePlatformValue((pack as any).platform) === currentPlatformCode &&
      (pack as any).isActive === false
  ).length;

  const mismatchedSamples = allPacks
    .filter((pack) => normalizePlatformValue((pack as any).platform) !== currentPlatformCode)
    .slice(0, 6)
    .map((pack) => ({
      id: pack.id,
      productId: pack.productId,
      platformRaw: (pack as any).platform,
      platformNormalized: normalizePlatformValue((pack as any).platform),
    }));

  return {
    platformCode: currentPlatformCode,
    total: allPacks.length,
    rawPlatformStats,
    normalizedPlatformStats,
    matched: packs.length,
    inactiveOnThisPlatform,
    mismatchedSamples,
  };
}

/** 將診斷資料轉成可直接顯示／寫 log 的多行文字 */
export function formatCatalogDiagnostics(diag: CatalogDiagnostics): string {
  return [
    `平台代碼：${diag.platformCode}`,
    `後端總筆數：${diag.total}`,
    `raw platform 分布：${JSON.stringify(diag.rawPlatformStats)}`,
    `normalized 分布：${JSON.stringify(diag.normalizedPlatformStats)}`,
    `本平台過濾後：${diag.matched}`,
    `本平台但 isActive=false：${diag.inactiveOnThisPlatform}`,
    diag.mismatchedSamples.length > 0
      ? `不匹配樣本：${JSON.stringify(diag.mismatchedSamples)}`
      : '不匹配樣本：無',
  ].join('\n');
}

/** 後端 productId → 後台商品名稱，供商店尚未載入時的顯示 fallback（來源仍是 API，非硬編碼） */
export function buildBackendNameMap(packs: CoinPack[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const pack of packs) {
    const backendId = String(pack.productId ?? '').trim();
    if (!backendId || !pack.name) continue;
    map[backendId] = pack.name;
    const sku = backendProductIdToStoreSku(backendId);
    if (sku && sku !== backendId) map[sku] = pack.name;
  }
  return map;
}
