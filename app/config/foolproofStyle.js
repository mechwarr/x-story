// 將「防呆視窗」參數表的 size / weight / color 三欄，轉成可餵給 <Text> 的樣式物件。
// 後端這些欄位允許為 null/空字串（未設定）；此時對應樣式屬性直接省略，
// 讓 CustomAlert 沿用預設外觀，不會把字級變成 0 或顏色變成空字串。
import { Platform } from 'react-native';

export const toAlertTextStyle = (size, weight, color) => {
  const style = {};
  const fontSize = Number(size);
  if (Number.isFinite(fontSize) && fontSize > 0) style.fontSize = fontSize;
  if (color && String(color).trim()) style.color = String(color).trim();
  // 後端字重下拉選單以中文「粗」／「細」描述：
  //   粗 → 粗體；細 → 常規（明確給 normal，才能蓋掉 CustomAlert 標題／按鈕底層預設的粗體，
  //   否則設「細」會沒反應——標題／按鈕永遠是粗的）。
  //   其餘（未設定／空字串）→ 省略 fontWeight，沿用 CustomAlert 預設外觀。
  const w = String(weight ?? '').trim();
  if (w === '粗') style.fontWeight = Platform.OS === 'ios' ? '600' : 'bold';
  else if (w === '細') style.fontWeight = 'normal';
  return style;
};
