// app/utils/iapDebugLogger.ts
import { Platform } from 'react-native';

const TAG = '[IAP-DIAG]';

type JsonLike = Record<string, unknown> | unknown[] | string | number | boolean | null | undefined;

function divider(title: string) {
  console.log(`${TAG} ===== ${title} =====`);
}

function endDivider() {
  console.log(`${TAG} ===============================`);
}

function safeStringify(value: JsonLike): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function logKeyValue(label: string, value: JsonLike) {
  console.log(`${TAG} ${label}: ${safeStringify(value)}`);
}

export function logStringList(title: string, items: string[]) {
  console.log(`${TAG} ${title} (count=${items.length})`);
  if (items.length === 0) {
    console.log(`${TAG}   (empty)`);
    return;
  }
  items.forEach((item, index) => {
    const normalized = typeof item === 'string' ? item.trim() : String(item);
    const hasWhitespace = item !== normalized;
    console.log(
      `${TAG}   [${index + 1}] raw="${item}" | trimmed="${normalized}" | len=${normalized.length}${hasWhitespace ? ' | hasLeadingOrTrailingWhitespace=true' : ''}`
    );
  });
}

export function logSection(title: string, builder: () => void) {
  divider(title);
  builder();
  endDivider();
}

export function logProductsSnapshot(
  title: string,
  products: Array<Record<string, unknown>>,
) {
  console.log(`${TAG} ${title} (count=${products.length})`);
  if (products.length === 0) {
    console.log(`${TAG}   (empty)`);
    return;
  }

  products.forEach((product, index) => {
    const id = (product.productId ?? product.id ?? '').toString();
    const titleText = (product.title ?? '').toString();
    const displayPrice = (product.displayPrice ?? '').toString();
    const price = (product.price ?? '').toString();
    const currency = (product.currency ?? '').toString();
    const type = (product.type ?? '').toString();
    const isSubscription = Object.prototype.hasOwnProperty.call(product, 'subscriptionPeriodUnitIOS');
    console.log(
      `${TAG}   [${index + 1}] id="${id}" | title="${titleText}" | displayPrice="${displayPrice}" | price="${price}" | currency="${currency}" | type="${type}" | isSubscription=${isSubscription}`
    );
  });
}

export function logSkuCompare(
  requestedSkus: string[],
  returnedIds: string[],
  invalidIds: string[],
) {
  logSection('SKU Compare', () => {
    logKeyValue('platform', Platform.OS);
    logStringList('requestedSkus', requestedSkus);
    logStringList('returnedIds', returnedIds);
    logStringList('invalidIds', invalidIds);
  });
}

function normalizeSku(value: string): string {
  return value.trim().toLowerCase();
}

export function logInvalidSkuClassification(
  requestedSkus: string[],
  returnedIds: string[],
) {
  const requestedSet = new Set(requestedSkus);
  const returnedSet = new Set(returnedIds);
  const invalidIds = requestedSkus.filter(sku => !returnedSet.has(sku));

  logSection('Invalid SKU Classification', () => {
    if (requestedSkus.length === 0) {
      console.log(`${TAG} verdict: no-requested-skus`);
      console.log(`${TAG} hint: 前端沒有送出任何 SKU，請先檢查 productIds 來源`);
      return;
    }

    if (invalidIds.length === 0) {
      console.log(`${TAG} verdict: no-invalid-skus`);
      return;
    }

    const returnedNormalizedMap = new Map<string, string[]>();
    returnedIds.forEach((rid) => {
      const normalized = normalizeSku(rid);
      const list = returnedNormalizedMap.get(normalized) ?? [];
      list.push(rid);
      returnedNormalizedMap.set(normalized, list);
    });

    invalidIds.forEach((invalid, index) => {
      const trimmed = invalid.trim();
      const hasWhitespace = trimmed !== invalid;
      const normalized = normalizeSku(invalid);
      const caseInsensitiveCandidates = returnedNormalizedMap.get(normalized) ?? [];
      const looksLikeCaseMismatch =
        caseInsensitiveCandidates.length > 0 &&
        !caseInsensitiveCandidates.includes(invalid);

      const reasons: string[] = [];
      if (hasWhitespace) reasons.push('leading-or-trailing-whitespace');
      if (looksLikeCaseMismatch) reasons.push('case-mismatch');
      if (reasons.length === 0) reasons.push('not-returned-by-store');

      console.log(
        `${TAG} invalid[${index + 1}] raw="${invalid}" | trimmed="${trimmed}" | reasons=${reasons.join(',')}`
      );

      if (looksLikeCaseMismatch) {
        console.log(
          `${TAG}   case-insensitive-match-candidates=${safeStringify(caseInsensitiveCandidates)}`
        );
      }
    });

    const requestedAppleLikely = requestedSkus.some(
      sku => sku.toLowerCase().includes('item_') || sku.toLowerCase().includes('coin') || sku.toLowerCase().includes('pack'),
    );
    const allInvalid = invalidIds.length === requestedSkus.length;

    if (allInvalid && requestedAppleLikely) {
      console.log(`${TAG} verdict: all-requested-skus-invalid`);
      console.log(`${TAG} hint: 疑似後端 APPLE 商品 ID 清單不正確、未同步或不屬於此 App/Bundld ID`);
    }

    if (returnedIds.length === 0) {
      console.log(`${TAG} verdict: empty-store-response`);
      console.log(`${TAG} hint: 商店回傳 0 筆，請優先檢查 App Store Connect 商品狀態與測試帳號`);
    }

    const unknownReturnedIds = returnedIds.filter(id => !requestedSet.has(id));
    if (unknownReturnedIds.length > 0) {
      console.log(`${TAG} verdict: store-returned-unrequested-ids`);
      console.log(`${TAG} hint: 請檢查是否有舊商品殘留或資料源混用`);
      logStringList('unrequestedReturnedIds', unknownReturnedIds);
    }
  });
}
