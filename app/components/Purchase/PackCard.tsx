import React from 'react';
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

// 價格區塊的版面常數：外層（ShopScreen）要用同一組數字換算共用字級，
// 兩邊各自寫死會在改版面時悄悄失準，所以由這裡輸出。
export const PRICE_BOX_WIDTH = 100;
export const PRICE_BOX_PADDING = 6;
export const PRICE_LETTER_SPACING = 0.3;

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
  
  // 金幣數與 bonus 一律以後端金幣包（api/coin-packs）為準，不再保留本地固定對照表：
  // 對照表會讓後台調整面額後 App 仍顯示舊值，也讓新品項無表可查而顯示錯誤數字。
  const coins = data.coins || 0;
  const bonus = data.bonus || 0;

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
                {/* 紅底寬度固定，字要壓成一行：不換行、必要時只縮字不撐容器 */}
                <Text
                  style={styles.bonusPillText}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  Bonus
                </Text>
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
          // 字級已由外層依最長價格算好；這裡只是保險，避免估算誤差造成尾端被「…」截掉
          adjustsFontSizeToFit
          minimumFontScale={0.8}
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
    paddingHorizontal: 12,              // 略縮左右內距，換取放大後的水平空間
    paddingVertical: 14,
    justifyContent: 'center',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  // 商品名稱 - 固定寬度
  titleContainer: {
    width: 96,                          // 固定寬度，統一排版
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  title: {
    color: '#171717',
    fontSize: 19,                       // 放大商品名稱
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  titleCoin: {
    width: 24,                          // 放大金幣圖標
    height: 24,
  },
  // 金幣數量 - 固定寬度
  coinsContainer: {
    width: 64,                          // 固定寬度，統一排版
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  coins: {
    color: '#222',
    fontSize: 19,                       // 放大金幣數量，與標題一致
    fontWeight: '800',
  },
  // BONUS 組件 - 固定寬度，上下排版
  bonusContainer: {
    width: 56,                          // 固定寬度，統一排版
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,                             // 上下間距
  },
  bonusPlus: {
    color: '#E5413B',
    fontSize: 16,                       // 放大 +bonus 數字
    fontWeight: '900',
    textAlign: 'center',
  },
  bonusPill: {
    backgroundColor: '#E53935',
    borderRadius: 6,
    paddingHorizontal: 4,               // 內距收窄，讓 Bonus 在固定寬度內排得下一行
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',                      // 填滿容器寬度
  },
  bonusPillText: {
    color: '#fff',
    fontSize: 12,                       // 放大 Bonus 標籤
    fontWeight: '900',
    letterSpacing: 0.3,
    textAlign: 'center',
    alignSelf: 'stretch',               // 撐滿可用寬度，adjustsFontSizeToFit 才有依據
  },

  // 右半
  right: {
    width: PRICE_BOX_WIDTH,             // 固定寬度，讓價格區塊更靠右
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,                      // 防止被壓縮
    paddingHorizontal: PRICE_BOX_PADDING, // 內距收窄，換取價格字串的可用寬度
  },
  price: {
    color: '#0E4C44',
    fontSize: 24,                      // 稍微縮小價格文字，與整體協調
    fontWeight: '900',
    letterSpacing: PRICE_LETTER_SPACING,
    textAlign: 'center',
    alignSelf: 'stretch',              // 撐滿容器寬度，adjustsFontSizeToFit 才會生效
  },
});
