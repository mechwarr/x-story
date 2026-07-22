import React, { useCallback } from 'react';
import { View, StyleSheet, Pressable, Image } from 'react-native';
import apiclient  from '../../config/apiClient';
import mediaPlayer from '../../services/mediaPlayer';

function ChatSoundArea({ soundMsg, backgroundColor }) {
  // 對話音效：使用者點擊才播。經由單一播放管理（同時只播一個對象、離開頁面釋放）。
  const playSound = useCallback(() => {
    const soundUrl = apiclient.currentBaseUrl() + 'images/update/' + soundMsg;
    mediaPlayer.playSound(soundUrl);
  }, [soundMsg]);

  // 觸控範圍只包住可見的白底播放框（不用 flex:1 撐滿整列）：
  // 點框外空白處會落到外層 Chat 的 onPressOption(null) → 續進故事；只有點白底框才播音訊。
  return (
    <Pressable onPress={playSound} style={styles.pressable}>
      <View style={[styles.container, backgroundColor]}>
        <Image
          style={styles.img}
          source={require('../../../assets/play.png')}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    // 只包住白底播放框；靠左對齊，避免占用整列寬度而攔截旁邊空白的「續進故事」點擊。
    alignSelf: 'flex-start',
  },
  container: {
    alignSelf: 'flex-start',
    padding: 10,
    borderRadius: 15,
  },
  text: {
    fontWeight: 'bold',
  },
  img: {
    width: 130,
  },
});

export default React.memo(ChatSoundArea);
