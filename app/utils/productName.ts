// app/utils/productName.ts
// 商品包名稱清理：平台（App Store／Google Play）回傳的 title 常帶括號或描述後綴，
// 商城卡片與購買成功彈窗共用此函式，只保留純名稱，避免顯示雜訊。

/**
 * 從平台 title 中提取純名稱（去掉括號和描述）。
 * 例如 "尊爵贊助包 (Premium Support Pack)" -> "尊爵贊助包"
 * 例如 "尊爵贊助包（Premium Support Pack）" -> "尊爵贊助包"
 * 例如 "尊爵贊助包 - Description" -> "尊爵贊助包"
 */
export function extractProductName(title: string): string {
  if (!title) return '';
  // 去掉所有括號及其內容（包括中文括號和英文括號）
  let name = title
    .replace(/\([^)]*\)/g, '')  // 去掉英文括號及其內容
    .replace(/（[^）]*）/g, '')  // 去掉中文括號及其內容
    .replace(/[()（）]/g, '')   // 去掉所有殘留的括號字符
    .trim();
  // 去掉可能的其他描述文字（如 " - Description"）
  name = name.split(' - ')[0].split(' – ')[0].split(' — ')[0].trim();
  return name;
}
