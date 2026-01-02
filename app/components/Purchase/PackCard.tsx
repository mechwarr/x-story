import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Image, Pressable, ViewStyle } from 'react-native';

export type PackItem = {
  id: string;
  title: string;
  name?: string;                        // 商品名稱（不含括號和描述），優先使用此字段
  coins: number;
  bonus?: number;
  priceUsd: number;
};

// 產品 ID 到 coins 和 bonus 的映射表
const PRODUCT_COINS_BONUS_MAP: Record<string, { coins: number; bonus: number }> = {
  'item_001': { coins: 90, bonus: 5 },
  'item_002': { coins: 150, bonus: 20 },
  'item_003': { coins: 300, bonus: 55 },
  'item_004': { coins: 590, bonus: 120 },
  'item_005': { coins: 1190, bonus: 280 },
  'item_006': { coins: 1790, bonus: 460 },
};

type Props = {
  data: PackItem;
  onPress?: (p: PackItem) => void;
  rightColor?: string;        // 右側色塊底色
  style?: ViewStyle;
  disabled?: boolean;          // 是否禁用
};

export default function PackCard({ data, onPress, rightColor = '#F7BA7E', style, disabled = false }: Props) {
  const { name, title, priceUsd } = data;
  // 優先使用 name，如果沒有則使用 title
  const displayName = name || title;
  
  // 從 id 中提取產品 ID（處理 "iap-item_001" 格式）
  const productId = useMemo(() => {
    // 如果 id 包含 "iap-"，則提取後面的部分
    if (data.id.startsWith('iap-')) {
      return data.id.replace('iap-', '');
    }
    // 否則直接使用 id
    return data.id;
  }, [data.id]);

  // 根據產品 ID 獲取 coins 和 bonus
  const { coins, bonus } = useMemo(() => {
    const productInfo = PRODUCT_COINS_BONUS_MAP[productId];
    if (productInfo) {
      return { coins: productInfo.coins, bonus: productInfo.bonus };
    }
    // 如果找不到對應的產品 ID，使用 data 中的值（向後兼容）
    return { coins: data.coins || 0, bonus: data.bonus || 0 };
  }, [productId, data.coins, data.bonus]);

  return (
    <Pressable
      onPress={() => !disabled && onPress?.(data)}
      disabled={disabled}
      style={({ pressed }) => [
        styles.card,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style
      ]}
    >
      {/* 左：內容 */}
      <View style={styles.left}>
        {/* 單行：標題 + 金幣icon + 數量 + bonus */}
        <View style={styles.contentRow}>
          <View style={styles.titleContainer}>
            <Text 
              numberOfLines={1} 
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              style={styles.title}
            >
              {displayName}
            </Text>
          </View>
          <Image style={styles.titleCoin} source={require('../../../assets/coin.png')} />
          <Text style={styles.coins}>{coins}</Text>
          {typeof bonus === 'number' && bonus > 0 && (
            <>
              <Text style={styles.bonusPlus}>+{bonus}</Text>
              <View style={styles.bonusPill}>
                <Text style={styles.bonusPillText}>Bonus</Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* 右：價格區塊 */}
      <View style={[styles.right, { backgroundColor: rightColor }]}>
        <Text style={styles.price}>${priceUsd}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F4E6D6',          // 卡片底（左半）
  },
  pressed: { transform: [{ scale: 0.995 }] },
  disabled: { opacity: 0.5 },

  // 左半
  left: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: 'center',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  titleContainer: {
    maxWidth: 85,                        // 固定最大寬度，確保後面元素有空間
    minWidth: 60,
    flexShrink: 1,                      // 允許縮小
  },
  title: {
    color: '#171717',
    fontSize: 16,                       // 統一文本大小
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  titleCoin: { 
    width: 20,                          // 統一圖標大小
    height: 20, 
  },
  coins: {
    color: '#222',
    fontSize: 16,                       // 統一文本大小，與標題一致
    fontWeight: '800',
  },
  bonusPlus: {
    color: '#E5413B',
    fontSize: 16,                       // 統一文本大小
    fontWeight: '900',
  },
  bonusPill: {
    backgroundColor: '#E53935',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bonusPillText: {
    color: '#fff',
    fontSize: 12,                       // Bonus 文字稍小但保持可讀性
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // 右半
  right: {
    width: 100,                         // 固定寬度，讓價格區塊更靠右
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,                      // 防止被壓縮
  },
  price: {
    color: '#0E4C44',
    fontSize: 24,                      // 稍微縮小價格文字，與整體協調
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
