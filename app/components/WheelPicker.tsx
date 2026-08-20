// app/components/WheelPicker.tsx
// 單欄滾輪選擇器（自繪，不用原生 Picker）。
//
// 為什麼不用 @react-native-picker/picker：
//  - Android 的 Picker 實作是 android.widget.Spinner（下拉選單／對話框），不是滾輪，
//    且 itemStyle 只有 iOS 生效 → 兩平台外觀無法一致。
//  - 原生日期選擇器（@react-native-community/datetimepicker）的 locale 屬性是 iOS only，
//    Android 一律跟隨裝置語系，做不到「跟隨 App 語系」。
// 自繪滾輪的文字全部由呼叫端組字，三語完全受控、兩平台行為一致。
import React, { useCallback, useEffect, useRef } from 'react';
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

export type WheelItem = { label: string; value: number };

type Props = {
  items: WheelItem[];
  selectedValue: number;
  onChange: (value: number) => void;
  /** 單列高度（由呼叫端以 ms() 換算，平板一致放大） */
  itemHeight: number;
  /** 可見列數，需為奇數（選取列才會落在正中央） */
  visibleCount?: number;
  fontSize: number;
};

export default function WheelPicker({
  items,
  selectedValue,
  onChange,
  itemHeight,
  visibleCount = 5,
  fontSize,
}: Props) {
  const scrollRef = useRef<ScrollView>(null);
  /** 目前捲動位置對應的索引。用來區分「使用者自己滾出來的」與「外部值變更」，
   *  避免在慣性捲動途中被 effect 重新 scrollTo 而互相打架。 */
  const settledIndexRef = useRef(-1);

  const height = itemHeight * visibleCount;
  const padding = (height - itemHeight) / 2;

  const foundIndex = items.findIndex((it) => it.value === selectedValue);
  const index = foundIndex >= 0 ? foundIndex : 0;

  // 外部值變更（例如月份改變後日數被夾住）時對位
  useEffect(() => {
    if (index === settledIndexRef.current) return;
    settledIndexRef.current = index;
    scrollRef.current?.scrollTo({ y: index * itemHeight, animated: false });
  }, [index, itemHeight]);

  const handleSettle = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const raw = Math.round(e.nativeEvent.contentOffset.y / itemHeight);
      const clamped = Math.min(items.length - 1, Math.max(0, raw));
      settledIndexRef.current = clamped;
      const next = items[clamped];
      if (next && next.value !== selectedValue) onChange(next.value);
    },
    [itemHeight, items, onChange, selectedValue]
  );

  return (
    <View style={{ height, flex: 1 }}>
      {/* 中央選取帶 */}
      <View pointerEvents="none" style={[styles.indicator, { top: padding, height: itemHeight }]} />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        decelerationRate="fast"
        nestedScrollEnabled
        // 慢速拖曳放開後不會有慣性事件，故兩個都要接
        onMomentumScrollEnd={handleSettle}
        onScrollEndDrag={handleSettle}
        // 初次開啟與選項數量變動（例如 31 天的月份切到 28 天）後對位。
        // 用 onContentSizeChange 而非 onLayout：onLayout 觸發時內容尚未量測完，scrollTo 會被夾成 0。
        onContentSizeChange={() => {
          settledIndexRef.current = index;
          scrollRef.current?.scrollTo({ y: index * itemHeight, animated: false });
        }}
        contentContainerStyle={{ paddingVertical: padding }}
      >
        {items.map((it, i) => (
          <View key={it.value} style={[styles.row, { height: itemHeight }]}>
            <Text
              style={[styles.text, { fontSize }, i === index && styles.textSelected]}
              numberOfLines={1}
            >
              {it.label}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  indicator: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#4a4f55',
  },
  row: { justifyContent: 'center', alignItems: 'center' },
  text: { color: '#9aa3ad' },
  textSelected: { color: '#e7eef6', fontWeight: '700' },
});
