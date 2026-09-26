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
  Pressable,
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

/** 捲動停止多久後視為「已停妥」（保底用，見 handleScroll 註解） */
const SCROLL_IDLE_MS = 150;
/** 程式對位（scrollTo）後忽略捲動事件的時間窗：對位本身也會觸發 onScroll，
 *  而初次開啟時內容尚未量測完，位置可能暫時被夾成 0 —— 不能拿來結算成第一列。 */
const ALIGN_IGNORE_MS = 250;

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
  /** 手指拖曳中：保底計時器不在此期間結算，交給 onScrollEndDrag／onMomentumScrollEnd */
  const isDraggingRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignoreScrollUntilRef = useRef(0);
  /** 保底計時器是延後執行的，須讀最新的 props（而非排程當下的 closure） */
  const latestRef = useRef({ items, selectedValue, onChange, itemHeight });
  latestRef.current = { items, selectedValue, onChange, itemHeight };

  const height = itemHeight * visibleCount;
  const padding = (height - itemHeight) / 2;

  const foundIndex = items.findIndex((it) => it.value === selectedValue);
  const index = foundIndex >= 0 ? foundIndex : 0;

  /** 程式對位：不經動畫直接跳到該列，並讓保底計時器略過這次對位產生的捲動事件 */
  const alignTo = useCallback((i: number, h: number) => {
    settledIndexRef.current = i;
    ignoreScrollUntilRef.current = Date.now() + ALIGN_IGNORE_MS;
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    scrollRef.current?.scrollTo({ y: i * h, animated: false });
  }, []);

  // 外部值變更（例如月份改變後日數被夾住）時對位
  useEffect(() => {
    if (index === settledIndexRef.current) return;
    alignTo(index, itemHeight);
  }, [index, itemHeight, alignTo]);

  useEffect(
    () => () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    },
    []
  );

  /** 以捲動位置結算選取值；snap=true 時順便把沒對齊的位置吸附到該列 */
  const settleAt = useCallback((offsetY: number, snap: boolean) => {
    const cur = latestRef.current;
    if (cur.items.length === 0) return;
    const raw = Math.round(offsetY / cur.itemHeight);
    const clamped = Math.min(cur.items.length - 1, Math.max(0, raw));
    settledIndexRef.current = clamped;
    if (snap && Math.abs(offsetY - clamped * cur.itemHeight) > 1) {
      scrollRef.current?.scrollTo({ y: clamped * cur.itemHeight, animated: true });
    }
    const next = cur.items[clamped];
    if (next && next.value !== cur.selectedValue) cur.onChange(next.value);
  }, []);

  const handleSettle = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => settleAt(e.nativeEvent.contentOffset.y, false),
    [settleAt]
  );

  // 保底：滑鼠滾輪／觸控板（模擬器、iPad 外接滑鼠）、VoiceOver／TalkBack 的捲動、
  // 以及「按住停下慣性」都不會觸發 onScrollEndDrag／onMomentumScrollEnd，
  // 畫面捲到新位置但選取值沒更新（按確定拿到舊值）。
  // 故改以「捲動事件停止一小段時間」作為結算時機，並把沒對齊的位置吸附回去。
  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (Date.now() < ignoreScrollUntilRef.current) return;
      const offsetY = e.nativeEvent.contentOffset.y;
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        idleTimerRef.current = null;
        if (isDraggingRef.current) return;
        settleAt(offsetY, true);
      }, SCROLL_IDLE_MS);
    },
    [settleAt]
  );

  /** 點按非中央的列 → 直接捲到該列並選取 */
  const handlePressItem = (i: number) => {
    const target = items[i];
    if (!target) return;
    settledIndexRef.current = i;
    scrollRef.current?.scrollTo({ y: i * itemHeight, animated: true });
    if (target.value !== selectedValue) onChange(target.value);
  };

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
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onScrollBeginDrag={() => {
          isDraggingRef.current = true;
        }}
        // 慢速拖曳放開後不會有慣性事件，故兩個都要接
        onMomentumScrollEnd={handleSettle}
        onScrollEndDrag={(e) => {
          isDraggingRef.current = false;
          handleSettle(e);
        }}
        // 初次開啟與選項數量變動（例如 31 天的月份切到 28 天）後對位。
        // 用 onContentSizeChange 而非 onLayout：onLayout 觸發時內容尚未量測完，scrollTo 會被夾成 0。
        onContentSizeChange={() => alignTo(index, itemHeight)}
        contentContainerStyle={{ paddingVertical: padding }}
      >
        {items.map((it, i) => (
          <Pressable
            key={it.value}
            style={[styles.row, { height: itemHeight }]}
            onPress={() => handlePressItem(i)}
            accessibilityRole="button"
            accessibilityState={{ selected: i === index }}
          >
            <Text
              style={[styles.text, { fontSize }, i === index && styles.textSelected]}
              numberOfLines={1}
            >
              {it.label}
            </Text>
          </Pressable>
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
