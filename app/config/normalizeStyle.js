import { Platform } from 'react-native';

// 後台（參數管理）色碼欄位為自由輸入字串，更新時常被夾帶前後空白，
// 例如「 #fff 」在 RN 會被判為無效色值而整個吃不到 → 一律先 trim 再用。
// 色碼：去空白，空值退回 fallback（預設 '#fff'；背景類欲保留 StyleSheet 預設時請傳 ''）。
export const toColor = (value, fallback = '#fff') => {
  const c = typeof value === 'string' ? value.trim() : value;
  return c || fallback;
};

// 後台字重下拉同時提供「粗 / 細」兩個選項（存 DB 為中文字串）。
// 舊寫法只判斷 === '粗'，選「細」時條件為 false → 靜默忽略、套不上任何字重。
// 這裡讓「細」明確回 'normal'（才能蓋掉底層 StyleSheet 的預設粗體），並容忍空白。
export const toFontWeight = (value) => {
  const w = typeof value === 'string' ? value.trim() : value;
  if (w === '粗') return Platform.OS === 'ios' ? '600' : 'bold';
  return 'normal'; // 「細」或未設 → 正常字重
};
