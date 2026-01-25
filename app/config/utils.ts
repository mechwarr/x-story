/**
 * 生成 UUID v4 格式的唯一識別碼
 * 格式：C5E4A3F7-8D4A-4B4B-9A12-0E6B6C8F1A99
 * @returns string UUID 字串
 */
export function generateUUID(): string {
  // UUID v4 格式：xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  // 其中 x 是任意十六進位數字，y 是 8、9、A 或 B 之一
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16).toUpperCase();
  });
}
