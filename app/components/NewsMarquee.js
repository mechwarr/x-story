import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import AppText from './AppText';

// 最新消息跑馬燈：
// 文字從容器右邊進入、往左邊移出，整段文字完全離開後才重新開始，無限輪迴。
// 速度以「每個字元耗時 msPerChar 毫秒」定義（預設 3000ms，約 3 秒一個字元，刻意放慢）。
// 實際動畫時間 = 總移動距離(容器寬 + 文字寬) 依「每字元寬度」換算成對應的字元數再乘上 msPerChar。
function NewsMarquee({ text, textStyle, msPerChar = 3000 }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);

  useEffect(() => {
    // 尚未量到容器/文字寬度，或沒有文字時不啟動動畫
    if (!text || containerWidth <= 0 || textWidth <= 0) return;

    const charCount = Math.max(text.length, 1);
    const perCharWidth = textWidth / charCount;      // 單一字元約佔的像素寬
    const distance = containerWidth + textWidth;       // 由右側完全進入到左側完全離開的總距離
    const duration = (distance / perCharWidth) * msPerChar;

    translateX.setValue(containerWidth);               // 起點：文字整段藏在右邊界外
    const animation = Animated.loop(
      Animated.timing(translateX, {
        toValue: -textWidth,                           // 終點：文字整段移出左邊界外
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [text, containerWidth, textWidth, msPerChar, translateX]);

  return (
    <View
      style={styles.container}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <Animated.View
        style={[styles.track, { transform: [{ translateX }] }]}
        onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
      >
        <AppText numberOfLines={1} style={textStyle}>
          {text}
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
