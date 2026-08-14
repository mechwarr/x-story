/**
 * 【歷史遺留對照表 — 不要再擴充】
 *
 * 當初 item_001～item_006 在 App Store Connect 誤建成 item_01～item_06，兩邊 ID 不一致，
 * 只能用這張表補救。除了這 6 筆以外，App 不保留任何商品 ID 硬編碼：
 * 新品項一律由後端 api/coin-packs 動態決定，且後端與 App Store Connect /
 * Google Play Console 必須使用「完全相同」的 productId，即可免改 code 上架。
 *
 * 查無對照者一律原樣送出（見各函式的 fallback），因此新增品項不會受這張表影響。
 * 僅 iOS 需要此對照；Android 的後端 ID 與 Play 商品 ID 本來就一致。
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

/** App Store SKU（item_01）→ 後端驗證／coin-pack 用的 productId（item_001）；非特規則原樣回傳 */
export function appStoreSkuToBackendProductId(storeSku: string): string {
  const s = String(storeSku ?? '').trim();
  for (const [backendId, appleSku] of Object.entries(BACKEND_TO_APP_STORE_SKU)) {
    if (appleSku === s) return backendId;
  }
  return s;
}
