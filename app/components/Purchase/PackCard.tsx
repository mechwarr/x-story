import React from 'react';
import { View, Text, StyleSheet, Image, Pressable, ViewStyle } from 'react-native';

export type PackItem = {
  id: string;
  title: string;
  coins: number;
  bonus?: number;
  priceUsd: number;
};

type Props = {
  data: PackItem;
  onPress?: (p: PackItem) => void;
  rightColor?: string;        // 右側色塊底色
  style?: ViewStyle;
  disabled?: boolean;          // 是否禁用
};

export default function PackCard({ data, onPress, rightColor = '#F7BA7E', style, disabled = false }: Props) {
  const { title, coins, bonus, priceUsd } = data;

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
        {/* 第一行：標題 + 金幣icon（貼近你的圖） */}
        <View style={styles.titleRow}>
          <Text numberOfLines={1} style={styles.title}>{title}</Text>
          <Image style={styles.titleCoin} source={require('../../../assets/coin.png')} />
        </View>

        {/* 第二行：數量 / bonus */}
        <View style={styles.metaRow}>
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
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: '#171717',
    fontSize: 22,                        // 比之前大，貼近截圖
    fontWeight: '800',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  titleCoin: { width: 26, height: 26, marginTop: 2 },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  coins: {
    color: '#222',
    fontSize: 22,
    fontWeight: '800',
  },
  bonusPlus: {
    color: '#E5413B',
    fontSize: 22,
    fontWeight: '900',
  },
  bonusPill: {
    backgroundColor: '#E53935',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  bonusPillText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },

  // 右半
  right: {
    width: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  price: {
    color: '#0E4C44',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
