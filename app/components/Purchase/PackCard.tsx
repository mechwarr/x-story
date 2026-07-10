import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Image, Pressable, ViewStyle } from 'react-native';

export type PackItem = {
  id: string;
  title: string;
  name?: string;                        // 商品名稱（不含括號和描述），優先使用此字段
  coins: number;
  bonus?: number;
  priceUsd: number;
  displayPrice?: string;                // 商店原始價格字串（含幣別符號），優先顯示此字段
  currencyCode?: string;                // 幣別代碼（如 TWD/JPY），零小數幣別用於去除 .00
};

// 產品 ID 到 coins 和 bonus 的映射表
const PRODUCT_COINS_BONUS_MAP: Record<string, { coins: number; bonus: number }> = {
  'item_001': { coins: 90, bonus: 5 },
  'item_002': { coins: 150, bonus: 20 },
  'item_003': { coins: 300, bonus: 55 },
  'item_004': { coins: 590, bonus: 120 },
  'item_005': { coins: 1190, bonus: 280 },
  'item_006': { coins: 1790, bonus: 460 },
  // iOS App Store SKU（與上列同階金額，供無後端數值時與 Android 顯示一致）
  'item_01': { coins: 90, bonus: 5 },
  'item_02': { coins: 150, bonus: 20 },
  'item_03': { coins: 300, bonus: 55 },
  'item_04': { coins: 590, bonus: 120 },
  'item_05': { coins: 1190, bonus: 280 },
  'item_06': { coins: 1790, bonus: 460 },
};

type Props = {
  data: PackItem;
  onPress?: (p: PackItem) => void;
  rightColor?: string;        // 右側色塊底色
  style?: ViewStyle;
  disabled?: boolean;          // 是否禁用
  priceFontSize?: number;      // 價格字級（由外層依同批最長價格算出，讓同幣別各卡字級一致）
};

export default function PackCard({ data, onPress, rightColor = '#F7BA7E', style, disabled = false, priceFontSize = 24 }: Props) {
  const { name, title, priceUsd, displayPrice } = data;
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
  // 優先使用 data 中的值（從 API 獲取），如果沒有或為 0，則使用硬編碼的 fallback
  const { coins, bonus } = useMemo(() => {
    // 優先使用 data 中的值（從 API 獲取）
    if (data.coins && data.coins > 0) {
      return { coins: data.coins, bonus: data.bonus || 0 };
    }
    
    // 如果 data 中沒有值或為 0，使用硬編碼的 fallback（向後兼容）
    const productInfo = PRODUCT_COINS_BONUS_MAP[productId];
    if (productInfo) {
      return { coins: productInfo.coins, bonus: productInfo.bonus };
    }
    
    // 最後的 fallback：使用 data 中的值（即使為 0）
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
          {/* 商品名稱 - 固定寬度 */}
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
          
          {/* 金幣圖標 */}
          <Image style={styles.titleCoin} source={require('../../../assets/coin.png')} />
          
          {/* 金幣數量 - 固定寬度 */}
          <View style={styles.coinsContainer}>
            <Text style={styles.coins}>{coins}</Text>
          </View>
          
          {/* BONUS 組件 - 固定寬度，上下排版 */}
          {typeof bonus === 'number' && bonus > 0 && (
            <View style={styles.bonusContainer}>
              <Text style={styles.bonusPlus}>+{bonus}</Text>
              <View style={styles.bonusPill}>
                <Text style={styles.bonusPillText}>Bonus</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* 右：價格區塊 */}
      <View style={[styles.right, { backgroundColor: rightColor }]}>
        {/* 同批各卡共用 priceFontSize，避免大額價格被 adjustsFontSizeToFit 縮小而看起來像鼓勵買小額 */}
        <Text
          style={[styles.price, { fontSize: priceFontSize }]}
          numberOfLines={1}
        >
          {displayPrice || String(priceUsd)}
        </Text>
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
  // 商品名稱 - 固定寬度
  titleContainer: {
    width: 90,                          // 固定寬度，統一排版
    alignItems: 'flex-start',
    justifyContent: 'center',
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
  // 金幣數量 - 固定寬度
  coinsContainer: {
    width: 60,                          // 固定寬度，統一排版
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  coins: {
    color: '#222',
    fontSize: 16,                       // 統一文本大小，與標題一致
    fontWeight: '800',
  },
  // BONUS 組件 - 固定寬度，上下排版
  bonusContainer: {
    width: 50,                          // 固定寬度，統一排版
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,                             // 上下間距
  },
  bonusPlus: {
    color: '#E5413B',
    fontSize: 14,                       // 稍微縮小以適應固定寬度
    fontWeight: '900',
    textAlign: 'center',
  },
  bonusPill: {
    backgroundColor: '#E53935',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',                      // 填滿容器寬度
  },
  bonusPillText: {
    color: '#fff',
    fontSize: 10,                       // 稍微縮小以適應固定寬度
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // 右半
  right: {
    width: 100,                         // 固定寬度，讓價格區塊更靠右
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,                      // 防止被壓縮
    paddingHorizontal: 8,               // 左右內距，避免文字貼邊
  },
  price: {
    color: '#0E4C44',
    fontSize: 24,                      // 稍微縮小價格文字，與整體協調
    fontWeight: '900',
    letterSpacing: 0.5,
    textAlign: 'center',
    alignSelf: 'stretch',              // 撐滿容器寬度，adjustsFontSizeToFit 才會生效
  },
});
