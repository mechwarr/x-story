import React, { useRef, useMemo, useCallback } from 'react';
import { View, StyleSheet, Dimensions, Pressable } from 'react-native';
import { Video } from 'expo-av';
import colors from '../../config/colors';
import apiclient  from '../../config/apiClient';

const screenWidth = Dimensions.get('window').width;

function NarratorVideo({ videoMsg, videoDirection }) {
  const video = useRef(null);

  const videoUrl = apiclient.currentBaseUrl() + 'images/update/' + videoMsg;

  const videoStyle = useMemo(
    () =>
      videoDirection === '橫'
        ? { width: screenWidth, height: screenWidth * (9 / 16) }
        : { width: screenWidth, height: screenWidth * (16 / 9) },
    [videoDirection]
  );

  // 不自動播放：改由使用者點擊（Pressable / 原生播放控制）才播放。
  const onPress = useCallback(async () => {
    try {
      await video.current?.playAsync();
    } catch (error) {
      console.error('[NarratorVideo] playAsync error:', error);
    }
  }, []);

  const onPlaybackStatusUpdate = useCallback(status => {
    //console.log('[NarratorVideo] onPlaybackStatusUpdate:', status);
  }, []);

  return (
    <Pressable style={styles.container} onPress={onPress}>
      <Video
        ref={video}
        style={videoStyle}
        source={{ uri: videoUrl }}
        resizeMode="contain"
        shouldPlay={false}
        useNativeControls
        onPlaybackStatusUpdate={onPlaybackStatusUpdate}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.dark,
  },
});

export default React.memo(NarratorVideo);
