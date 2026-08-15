import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import AppText from './AppText';

// 最新消息跑馬燈（ticker 式）：
// text 可為單一字串或字串陣列（多則訊息）。每則文字從容器右邊進入、往左邊移出。
// 「下一則」不等前一則完全跑完才出現：前一則的「尾端」完全進入畫面後，隔 gapMs（預設 2 秒）
// 下一則就從右側接著進場，因此畫面上可能同時有多則訊息在移動（新聞台跑馬燈的常見形式）。
// 依訊息總條數循環：最後一則之後接回第一則，無限輪播。
//
// 速度：所有訊息採「同一固定像素速度」= fontSize / msPerChar（px/ms）。
// 對中文而言一個字寬約等於 fontSize，故 msPerChar 仍保有「每個中文字約耗時 800ms」的原語意；
// 統一速度同時是 ticker 的必要條件——若各則各自按字寬換算速度，後一則可能比前一則快，
// 造成追上重疊。固定速度下，2 秒的時間間隔即固定的畫面距離，永不碰撞。

// 文字排版可用的寬度上限（px）。Yoga 量測絕對定位元素時仍會以「父容器寬度」為上限，
// 導致長訊息被夾在容器寬內而截成「...」。給軌道一個遠大於任何實際訊息的固定寬度，
// 文字就永遠在單行內完整排版、任何長度都不會截斷。
// （1e6 px 在 fontSize 20 下約可容納 5 萬個中文字，遠超任何一則最新消息的長度。）
const MARQUEE_TRACK_WIDTH = 1000000;
const DEFAULT_FONT_SIZE = 20;

// 單則訊息的動畫軌道：掛載後量測完整文字寬度，動畫分兩段——
// 進場段（右邊界外 → 尾端完全進入畫面）結束時通知父層可排程下一則（onEntered），
// 離場段（→ 整段移出左邊界）結束時通知父層移除自己（onDone）。
function MarqueeItem({ text, textStyle, pxPerMs, containerWidth, onEntered, onDone }) {
  const translateX = useRef(new Animated.Value(containerWidth)).current;
  const [textWidth, setTextWidth] = useState(0);

  useEffect(() => {
    if (textWidth <= 0 || containerWidth <= 0 || pxPerMs <= 0) return;

    // 進場：文字左緣自容器右邊界起，移動 textWidth 後尾端恰好完全進入畫面
    // 離場：再移動 containerWidth 後整段移出左邊界
    translateX.setValue(containerWidth);
    const enter = Animated.timing(translateX, {
      toValue: containerWidth - textWidth,
      duration: textWidth / pxPerMs,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    const exit = Animated.timing(translateX, {
      toValue: -textWidth,
      duration: containerWidth / pxPerMs,
      easing: Easing.linear,
      useNativeDriver: true,
    });

    let stopped = false;
    enter.start(({ finished }) => {
      if (!finished || stopped) return;
      onEntered();
      exit.start(({ finished: exitFinished }) => {
        if (exitFinished && !stopped) onDone();
      });
    });
    return () => {
      stopped = true;
      enter.stop();
      exit.stop();
    };
  }, [textWidth, containerWidth, pxPerMs]);

  return (
    <Animated.View
      style={[styles.track, { transform: [{ translateX }] }]}
      pointerEvents="none"
    >
      {/* 不設 numberOfLines：軌道寬度足夠大，文字必為完整單行，不存在「...」截斷路徑。
          量測文字本身，拿到的才是完整字串的實際像素寬。 */}
      <AppText
        style={textStyle}
        onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
      >
        {text}
      </AppText>
    </Animated.View>
  );
}

function NewsMarquee({ text, textStyle, msPerChar = 800, gapMs = 2000 }) {
  // 統一整理成「非空訊息陣列」；單一字串也視為只有一則的陣列。
  const messages = useMemo(() => {
    const arr = Array.isArray(text) ? text : [text];
    return arr.filter((m) => typeof m === 'string' && m.length > 0);
  }, [text]);

  const [containerWidth, setContainerWidth] = useState(0);
  // 目前掛在畫面上的訊息軌道（可能同時多條）。id 只增不減，供 key 與移除使用。
  const [items, setItems] = useState([]);
  const nextIndexRef = useRef(0); // 下一則要播放的訊息索引（依總條數取餘循環）
  const nextIdRef = useRef(0);
  const gapTimerRef = useRef(null);

  // spawn 由 effect 與計時器共用，改讀 ref 以免拿到過期的 messages
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const fontSize = textStyle?.fontSize ?? DEFAULT_FONT_SIZE;
  const pxPerMs = fontSize / msPerChar;

  const spawn = () => {
    const msgs = messagesRef.current;
    if (!msgs.length) return;
    const index = nextIndexRef.current % msgs.length;
    nextIndexRef.current = index + 1;
    const id = nextIdRef.current++;
    setItems((prev) => [...prev, { id, text: msgs[index] }]);
  };

  // 啟動／重置：容器寬度就緒、或訊息整組變動（如語系切換）時，清場並自第一則重新開始。
  useEffect(() => {
    clearTimeout(gapTimerRef.current);
    setItems([]);
    nextIndexRef.current = 0;
    if (!messages.length || containerWidth <= 0) return;
    spawn();
    return () => clearTimeout(gapTimerRef.current);
  }, [messages, containerWidth]);

  // 一則訊息「尾端完全進入畫面」後，固定隔 gapMs 讓下一則進場（不等它跑完整段路程）。
  const handleEntered = () => {
    clearTimeout(gapTimerRef.current);
    gapTimerRef.current = setTimeout(spawn, gapMs);
  };

  // 一則訊息整段移出左邊界後，把它的軌道從畫面移除。
  const handleDone = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <View
      style={styles.container}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {items.map((item) => (
        <MarqueeItem
          key={item.id}
          text={item.text}
          textStyle={textStyle}
          pxPerMs={pxPerMs}
          containerWidth={containerWidth}
          onEntered={handleEntered}
          onDone={() => handleDone(item.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  // 絕對定位＋固定超大寬度：單靠絕對定位仍會被 Yoga 以父容器寬度夾限（「...」截斷的根因），
  // 必須明確給定寬度，文字才真正不受容器寬度限制、完整單行排版。
  // 超出容器的部分由外層 overflow: 'hidden' 裁掉，不影響畫面。
  track: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: MARQUEE_TRACK_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default NewsMarquee;
