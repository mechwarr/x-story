import React, { useRef, useMemo, useCallback } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Video } from 'expo-av';
import colors from '../../config/colors';
import apiclient  from '../../config/apiClient';
import mediaPlayer from '../../services/mediaPlayer';

const screenWidth = Dimensions.get('window').width;

function NarratorVideo({ videoMsg, videoDirection, autoPlay = true }) {
  const video = useRef(null);

  const videoUrl = apiclient.currentBaseUrl() + 'images/update/' + videoMsg;

  const videoStyle = useMemo(
    () =>
      videoDirection === '橫'
        ? { width: screenWidth, height: screenWidth * (9 / 16) }
        : { width: screenWidth, height: screenWidth * (16 / 9) },
    [videoDirection]
  );

  // 旁白影片：逐段推進新增時於 onLoad 自動播放，且一律經由單一播放管理（mediaPlayer），
  // 同時只允許一個對象在播。不用 shouldPlay 自動播，避免繞過單一播放管理造成多個影片/音效同時出聲。
  // 「繼續閱讀還原」的歷史段落（autoPlay=false）不主動播，僅載入顯示首幀。
  const onLoad = useCallback(() => {
    if (autoPlay) mediaPlayer.playVideo(video);
  }, [autoPlay]);

  const onPlaybackStatusUpdate = useCallback(status => {
    //console.log('[NarratorVideo] onPlaybackStatusUpdate:', status);
  }, []);

  return (
    <View style={styles.container}>
      <Video
        ref={video}
        style={videoStyle}
        source={{ uri: videoUrl }}
        resizeMode="contain"
        shouldPlay={false}
        onLoad={onLoad}
        onPlaybackStatusUpdate={onPlaybackStatusUpdate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.dark,
  },
});

export default React.memo(NarratorVideo);
