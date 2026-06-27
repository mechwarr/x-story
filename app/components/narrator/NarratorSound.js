import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Pressable, Image } from 'react-native';
import { Audio } from 'expo-av';
import apiclient  from '../../config/apiClient';

function NarratorSound({ soundMsg }) {
  const [sound, setSound] = useState('');

  const playSound = useCallback(async () => {
    const soundUrl = apiclient.currentBaseUrl() + 'images/update/' + soundMsg;
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const { _sound } = await Audio.Sound.createAsync(
      { uri: soundUrl },
      { shouldPlay: true }
    );
    setSound(_sound);
  }, [soundMsg]);

  // 不自動播放：改由使用者點擊下方播放按鈕（Pressable）才播放。
  useEffect(() => {
    return () => {
      setTimeout(() => {
        try {
          console.log('Unloading Sound');
          sound?.unloadAsync();
        } catch {}
      }, 40000);
    };
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
