import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import AppText from './AppText';

// 最新消息跑馬燈：
// text 可為單一字串或字串陣列（多則訊息）。每則文字從容器右邊進入、往左邊移出，
// 整段完全離開後接著播下一則；最後一則播完再回到第一則，如此無限循環。
// 速度以「每個字元耗時 msPerChar 毫秒」定義（預設 800ms，約較舊版 3000ms 快 3~4 倍）。
// 實際動畫時間 = 總移動距離(容器寬 + 文字寬) 依「每字元寬度」換算成對應的字元數再乘上 msPerChar。
function NewsMarquee({ text, textStyle, msPerChar = 800 }) {
  // 統一整理成「非空訊息陣列」；單一字串也視為只有一則的陣列。
  const messages = useMemo(() => {
    const arr = Array.isArray(text) ? text : [text];
    return arr.filter((m) => typeof m === 'string' && m.length > 0);
  }, [text]);

  const translateX = useRef(new Animated.Value(0)).current;
  const [containerWidth, setContainerWidth] = useState(0);
  // tick：每播完一則 +1。用「遞增計數器」而非直接設定 index，才能在只有一則訊息時也持續重播
  //（index 值不變不會觸發 effect 重新啟動動畫）。
  const [tick, setTick] = useState(0);
  // 記錄目前量到的寬度是屬於「哪一則文字」，避免用上一則的寬度去跑這一則的動畫而造成閃爍。
  const [measured, setMeasured] = useState({ text: null, width: 0 });

  const index = messages.length ? tick % messages.length : 0;
  const current = messages[index] ?? '';

  // 訊息整組變動（例如語系切換）時，回到第一則重新開始。
  useEffect(() => {
    setTick(0);
  }, [messages]);

  useEffect(() => {
    // 需等容器寬度就緒，且量到的寬度確實屬於「目前這一則」文字，才開始動畫
    if (!current || containerWidth <= 0) return;
    if (measured.text !== current || measured.width <= 0) return;

    const textWidth = measured.width;
    const charCount = Math.max(current.length, 1);
    const perCharWidth = textWidth / charCount;      // 單一字元約佔的像素寬
    const distance = containerWidth + textWidth;       // 由右側完全進入到左側完全離開的總距離
    const duration = (distance / perCharWidth) * msPerChar;

    translateX.setValue(containerWidth);               // 起點：文字整段藏在右邊界外
    const animation = Animated.timing(translateX, {
      toValue: -textWidth,                             // 終點：文字整段移出左邊界外
      duration,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      // 這一則完整移出後，接續播放下一則；播完最後一則會經由取餘數回到第一則。
      if (finished) setTick((t) => t + 1);
    });
    return () => animation.stop();
  }, [current, containerWidth, measured, msPerChar, translateX, tick]);

  return (
    <View
      style={styles.container}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <Animated.View
        style={[styles.track, { transform: [{ translateX }] }]}
        onLayout={(e) =>
          setMeasured({ text: current, width: e.nativeEvent.layout.width })
        }
      >
        <AppText numberOfLines={1} style={textStyle}>
          {current}
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  // 絕對定位讓文字不受容器寬度限制，量到的才是整段文字的實際寬度（不會被截斷/換行）。
  track: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default NewsMarquee;
