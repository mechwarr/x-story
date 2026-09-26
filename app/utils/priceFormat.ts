// app/utils/priceFormat.ts
// 商店（App Store／Google Play）價格字串的顯示整理：商城卡片與購買紀錄共用，
// 確保同一筆價格在兩個畫面長得一樣。只整理外觀，不換算金額、不改幣別符號本身。

// 這些幣別的最小單位即為整數（無小數），商店回傳的價格字串若帶 .00 應去除
const ZERO_DECIMAL_CURRENCIES = [
  'TWD', 'JPY', 'KRW', 'VND', 'CLP', 'PYG',
  'BIF', 'DJF', 'GNF', 'ISK', 'KMF', 'RWF',
  'UGX', 'VUV', 'XAF', 'XOF', 'XPF',
];

// 幣別符號：前綴字母只有緊貼在這些符號前面時才去除
const CURRENCY_SYMBOLS = '$¥￥₩€£₹₫₱฿₪₺₴₦₡₲₵₸₮₭₽';
const SYMBOL_PREFIX_RE = new RegExp(`[A-Za-z]{1,3}(?=[${CURRENCY_SYMBOLS}])`, 'g');

/**
 * 去掉幣別符號前的地區字母前綴，只留符號本身。
 * 同一商品的價格字串會隨裝置／帳號地區設定而不同（zh-TW 回 "$90"、en-US 回 "NT$90"），
 * 統一去前綴後各地區顯示一致，也省下價格區塊的寬度。
 * 例如 "NT$1,790" -> "$1,790"、"US$2.99" -> "$2.99"、"HK$23" -> "$23"、"JP¥300" -> "¥300"
 * 沒有符號、只有幣別代碼的字串（如 "CHF 10"、"TWD 90"）不動——去掉就看不出幣別了。
 */
export function stripCurrencyPrefix(price: string): string {
  if (!price) return price;
  return price.replace(SYMBOL_PREFIX_RE, '');
}

/**
 * 針對零小數幣別，去掉價格字串尾端的 .00（例：$150.00 -> $150）。
 * 僅去除「整數 .00 / ,00」尾綴（含歐式逗號小數）；若小數非全為 0（如 .50）則保留。
 * 後綴需為非數字到字串結尾，避免誤刪千分位（如 "1,000" 不受影響）。
 */
export function stripZeroDecimals(price: string, currencyCode?: string): string {
  if (!price) return price;
  if (currencyCode && ZERO_DECIMAL_CURRENCIES.includes(currencyCode.toUpperCase())) {
    return price.replace(/[.,]00(?=\D*$)/, '');
  }
  return price;
}

/** 商店價格字串的完整顯示整理：去地區前綴 + 零小數幣別去 .00 */
export function formatStorePrice(
  price: string | undefined | null,
  currencyCode?: string,
): string | undefined {
  if (!price) return price ?? undefined;
  return stripZeroDecimals(stripCurrencyPrefix(price), currencyCode);
}
