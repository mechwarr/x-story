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
export const PRICE_MAX_FONT = 22;

// 金幣數量欄：同批各卡共用同一寬度（以最多位數那筆為準），
// 金幣圖示才會排成一直線；欄寬收到最小，整組貼齊 Bonus，數字靠左緊接金幣圖示。
export const COINS_FONT_SIZE = 19;
export const COINS_DIGIT_WIDTH_RATIO = 0.6;   // 粗體數字約 0.6em
export const DEFAULT_COINS_WIDTH = 46;         // 4 位數

// 商品名稱：同批各卡共用同一字級（以最長名稱塞得下的字級為準），
// 不讓各卡各自縮字造成大小不一。名稱欄吃剩餘寬度，外層需知道左半其餘元件佔掉多少。
export const TITLE_MAX_FONT = 19;
export const TITLE_MIN_FONT = 13;
export const TITLE_LETTER_SPACING = 0.3;
const LEFT_PADDING_LEFT = 12;
const LEFT_PADDING_RIGHT = 4;
const TITLE_MARGIN_RIGHT = 4;
const COIN_ICON_SIZE = 24;
const COIN_ICON_MARGIN_RIGHT = 3;
const COINS_MARGIN_RIGHT = 2;
const BONUS_WIDTH = 48;
// 卡片寬度扣掉這個值與 coinsWidth，就是名稱欄可用寬度
export const TITLE_ROW_FIXED_WIDTH =
  PRICE_BOX_WIDTH + LEFT_PADDING_LEFT + LEFT_PADDING_RIGHT + TITLE_MARGIN_RIGHT +
  COIN_ICON_SIZE + COIN_ICON_MARGIN_RIGHT + COINS_MARGIN_RIGHT + BONUS_WIDTH;

type Props = {
  data: PackItem;
  onPress?: (p: PackItem) => void;
  rightColor?: string;        // 右側色塊底色
  style?: ViewStyle;
  disabled?: boolean;          // 是否禁用
  priceFontSize?: number;      // 價格字級（由外層依同批最長價格算出，讓同幣別各卡字級一致）
  coinsWidth?: number;         // 金幣數量欄寬（由外層依同批最多位數算出，讓金幣圖示對齊成一直線）
  titleFontSize?: number;      // 名稱字級（由外層依同批最長名稱算出，讓各卡名稱字級一致）
};

export default function PackCard({ data, onPress, rightColor = '#F7BA7E', style, disabled = false, priceFontSize = PRICE_MAX_FONT, coinsWidth = DEFAULT_COINS_WIDTH, titleFontSize = TITLE_MAX_FONT }: Props) {
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
          {/* 商品名稱 - 吃滿剩餘寬度 */}
          <View style={styles.titleContainer}>
            <Text 
              numberOfLines={1} 
              // 字級已由外層依最長名稱算好；這裡只是保險，避免估算誤差造成尾端被「…」截掉
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              style={[styles.title, { fontSize: titleFontSize }]}
            >
              {displayName}
            </Text>
          </View>
          
          {/* 金幣圖標 */}
          <Image style={styles.titleCoin} source={require('../../../assets/coin.png')} />
          
          {/* 金幣數量 - 同批共用最小寬度，數字靠左緊接金幣圖示 */}
          <View style={[styles.coinsContainer, { width: coinsWidth }]}>
            <Text style={styles.coins} numberOfLines={1}>{coins}</Text>
          </View>
          
          {/* BONUS 組件 - 固定寬度；+值與紅底上下堆疊，整組在卡片高度內垂直置中 */}
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
    minHeight: 80,                       // 垂直空間由卡片高度控制（左半不再設垂直內距）
  },
  pressed: { transform: [{ scale: 0.995 }] },
  disabled: { opacity: 0.5 },

  // 左半
  left: {
    flex: 1,
    paddingLeft: LEFT_PADDING_LEFT,
    paddingRight: LEFT_PADDING_RIGHT,   // 右側收窄，讓 Bonus 貼近價格區塊
  },
  contentRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // 商品名稱 - 吃滿剩餘寬度
  titleContainer: {
    flex: 1,
    minWidth: 0,
    marginRight: TITLE_MARGIN_RIGHT,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  title: {
    color: '#171717',
    fontSize: TITLE_MAX_FONT,
    fontWeight: '800',
    letterSpacing: TITLE_LETTER_SPACING,
  },
  titleCoin: {
    width: COIN_ICON_SIZE,
    height: COIN_ICON_SIZE,
    marginRight: COIN_ICON_MARGIN_RIGHT,
  },
  // 金幣數量 - 寬度由 coinsWidth 決定
  coinsContainer: {
    marginRight: COINS_MARGIN_RIGHT,    // 緊貼 Bonus
    alignItems: 'flex-start',           // 數字靠左緊接金幣圖示
    justifyContent: 'center',
  },
  coins: {
    color: '#222',
    fontSize: COINS_FONT_SIZE,          // 與標題一致
    fontWeight: '800',
  },
  // BONUS 組件 - 固定寬度
  bonusContainer: {
    width: BONUS_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',           // +值與紅底整組垂直置中於卡片
    gap: 2,
  },
  bonusPlus: {
    color: '#E5413B',
    fontSize: 16,                       // 放大 +bonus 數字
    fontWeight: '900',
    textAlign: 'center',
  },
  bonusPill: {
    alignSelf: 'stretch',               // 填滿 Bonus 欄寬
    backgroundColor: '#E53935',
    borderRadius: 6,
    paddingHorizontal: 2,               // 內距收窄，讓 Bonus 在固定寬度內排得下一行
    paddingVertical: 3,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: PRICE_MAX_FONT,
    fontWeight: '900',
    letterSpacing: PRICE_LETTER_SPACING,
    textAlign: 'center',
    alignSelf: 'stretch',              // 撐滿容器寬度，adjustsFontSizeToFit 才會生效
  },
});
