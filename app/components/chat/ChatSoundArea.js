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

  return (
    <Pressable onPress={playSound} style={{ flex: 1 }}>
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
