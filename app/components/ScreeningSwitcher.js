import React, { useState, useEffect, useRef } from 'react';
import { View, Pressable, Text, ScrollView, StyleSheet } from 'react-native';
import { translate } from '../i18n/i18n';

/**
 * 場次快速切換器（僅 role >= 9 由父層決定是否掛載）。
 *
 * 收合：頂端置中黑底膠囊 + 短白線握把，僅佔握把觸控區，不遮蔽播放器內容。
 * 展開：黑底面板顯示 < 場次 {場次順序order} >，左右箭頭切上下場，
 *       （顯示 order 而非資料庫主鍵 id：order 跨語系穩定、且與 choiceNext 跳轉目標同一基準；
 *        id 為全域自增主鍵，換語系即不同，顯示出來會誤導。）
 *       下方為全部場次清單，超長時可垂直滾動拖曳。
 * 任一切換（上一場 / 下一場 / 點選任意場次）後立即收回，只剩頂部握把。
 *
 * `top` 由父層傳入，預設 0（貼齊最頂端、位於 Auto 鈕上方）。
 */
export default function ScreeningSwitcher({ sessions = [], currentIndex, onSelect, top = 0 }) {
  const [expanded, setExpanded] = useState(false);
  const listRef = useRef(null);

  const total = sessions.length;
  const atStart = currentIndex <= 0;
  const atEnd = currentIndex >= total - 1;
  // 顯示用：場次順序 order（跨語系穩定、對齊 choiceNext 跳轉基準），非資料庫 id。
  const currentSessionOrder = sessions[currentIndex]?.order;

  // 每次展開時，將清單捲動到目前場次附近
  useEffect(() => {
    if (!expanded) return;
    const t = setTimeout(() => {
      listRef.current?.scrollTo({
        y: Math.max(0, currentIndex * ITEM_HEIGHT - ITEM_HEIGHT),
        animated: false,
      });
    }, 0);
    return () => clearTimeout(t);
  }, [expanded, currentIndex]);

  // 切換場次：先收回面板，再通知父層跳轉
  const jumpTo = (targetIndex) => {
    if (targetIndex < 0 || targetIndex >= total) return;
    setExpanded(false);
    if (targetIndex !== currentIndex) onSelect?.(targetIndex);
  };

  return (
    // box-none：面板以外的空白區不攔截觸控 → 不影響底下劇情輕觸推進
    <View style={[styles.wrap, { top }]} pointerEvents="box-none">
      {!expanded ? (
        <Pressable style={styles.handle} hitSlop={10} onPress={() => setExpanded(true)}>
          <View style={styles.grabLine} />
        </Pressable>
      ) : (
        <View style={styles.panel}>
          {/* 上排：上一場 / 目前場次（點此收合）/ 下一場 */}
          <View style={styles.row}>
            <Pressable
              style={styles.arrow}
              disabled={atStart}
              hitSlop={8}
              onPress={() => jumpTo(currentIndex - 1)}
            >
              <Text style={[styles.arrowText, atStart && styles.disabledText]}>‹</Text>
            </Pressable>

            <Pressable style={styles.center} onPress={() => setExpanded(false)}>
              <Text style={styles.label}>{translate('screening')}</Text>
              <Text style={styles.session}>{currentSessionOrder ?? '-'}</Text>
              <Text style={styles.sub}>{total ? currentIndex + 1 : 0} / {total}</Text>
            </Pressable>

            <Pressable
              style={styles.arrow}
              disabled={atEnd}
              hitSlop={8}
              onPress={() => jumpTo(currentIndex + 1)}
            >
              <Text style={[styles.arrowText, atEnd && styles.disabledText]}>›</Text>
            </Pressable>
          </View>

          <View style={styles.divider} />

          {/* 下排：全部場次清單，超長可滾動拖曳 */}
          <ScrollView
            ref={listRef}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator
            nestedScrollEnabled
          >
            {sessions.map((s, i) => {
              const active = i === currentIndex;
              return (
                <Pressable
                  key={s?.id ?? i}
                  style={[styles.item, active && styles.itemActive]}
                  onPress={() => jumpTo(i)}
                >
                  <Text style={[styles.itemText, active && styles.itemTextActive]}>
                    {i + 1}. {translate('screening')} {s?.order ?? '-'}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const ITEM_HEIGHT = 40; // 單筆場次按鈕高度（含 margin），供初始捲動定位估算

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    // top 由父層傳入（預設 0：貼齊最頂端、位於 Auto 鈕上方）
    alignItems: 'center',
    zIndex: 20,
  },
  handle: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 28,
    paddingVertical: 6,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  grabLine: {
    width: 34,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  panel: {
    width: '86%',
    backgroundColor: 'rgba(0,0,0,0.88)',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  arrow: { paddingHorizontal: 14, paddingVertical: 4 },
  arrowText: { color: '#fff', fontSize: 30, fontWeight: '600', lineHeight: 32 },
  disabledText: { color: 'rgba(255,255,255,0.22)' },
  center: { alignItems: 'center', minWidth: 96 },
  label: { color: 'rgba(255,255,255,0.55)', fontSize: 11 },
  session: { color: '#fff', fontSize: 18, fontWeight: '700' },
  sub: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginVertical: 8,
  },
  list: { maxHeight: 200 },
  listContent: { paddingVertical: 2 },
  item: {
    height: 34,
    marginVertical: 3,
    paddingHorizontal: 12,
    borderRadius: 8,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  itemActive: { backgroundColor: 'rgba(255,255,255,0.18)' },
  itemText: { color: 'rgba(255,255,255,0.85)', fontSize: 14 },
  itemTextActive: { color: '#fff', fontWeight: '700' },
});
