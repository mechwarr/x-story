import React, { useCallback, useEffect } from 'react';
import { StyleSheet, Pressable, Image } from 'react-native';
import apiclient  from '../../config/apiClient';
import mediaPlayer from '../../services/mediaPlayer';

function NarratorSound({ soundMsg, autoPlay = true }) {
  // 旁白音效：逐段推進新增時自動播放，並提供按鈕可再次點擊重播。
  // 經由單一播放管理（同時只播一個對象、離開頁面釋放）。
  const playSound = useCallback(() => {
    const soundUrl = apiclient.currentBaseUrl() + 'images/update/' + soundMsg;
    mediaPlayer.playSound(soundUrl);
  }, [soundMsg]);

  // 進場時自動播放一次；但「繼續閱讀還原」的歷史段落（autoPlay=false）不主動播，
  // 僅保留喇叭按鈕供使用者手動點擊。
  useEffect(() => {
    if (autoPlay) playSound();
  }, []);

  return (
    <Pressable onPress={playSound} style={{ flex: 1 }}>
      <Image
        style={styles.img}
        source={require('../../../assets/Sound-W.png')}
        resizeMode='contain'
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  img: {
    width: 200,
    height: 60,
  },
});

export default React.memo(NarratorSound);
