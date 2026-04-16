/**
 * 後端 coin-packs 的 productId（常為 item_001～item_006）與 App Store Connect 實際 SKU（item_01～item_06）對照。
 * 僅在 iOS fetchProducts 前將後端 ID 轉成商店 SKU；Android 仍使用後端／Play 一致的 ID。
 */

const BACKEND_TO_APP_STORE_SKU: Record<string, string> = {
  item_001: 'item_01',
  item_002: 'item_02',
  item_003: 'item_03',
  item_004: 'item_04',
  item_005: 'item_05',
  item_006: 'item_06',
};

/** 後端 productId → 傳給 StoreKit / fetchProducts 的 SKU */
export function backendProductIdToAppStoreSku(backendProductId: string): string {
  const trimmed = String(backendProductId ?? '').trim();
  return BACKEND_TO_APP_STORE_SKU[trimmed] ?? trimmed;
}

/** 商城列表：用商店回傳的 productId 對應後端 coin-pack 的 productId */
export function appStoreSkuMatchesBackendProductId(
  storeProductId: string,
  backendProductId: string
): boolean {
  const b = String(backendProductId ?? '').trim();
  const s = String(storeProductId ?? '').trim();
  if (b === s) return true;
  return BACKEND_TO_APP_STORE_SKU[b] === s;
}

/**
 * 由後端金幣包 productId 列表組出要送給 App Store 的 SKU 列表（去重、保序）。
 */
export function buildAppStoreSkuListFromBackendProductIds(backendIds: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of backendIds) {
    const trimmed = String(raw ?? '').trim();
    if (!trimmed) continue;
    const sku = backendProductIdToAppStoreSku(trimmed);
    if (seen.has(sku)) continue;
    seen.add(sku);
    out.push(sku);
  }
  return out;
}

/** App Store SKU（item_01）→ 後端驗證／coin-pack 用的 productId（item_001）；非特規則原樣回傳 */
export function appStoreSkuToBackendProductId(storeSku: string): string {
  const s = String(storeSku ?? '').trim();
  for (const [backendId, appleSku] of Object.entries(BACKEND_TO_APP_STORE_SKU)) {
    if (appleSku === s) return backendId;
  }
  return s;
}
