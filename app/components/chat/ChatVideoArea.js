import React, { useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Video } from 'expo-av';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import colors from '../../config/colors';
import apiclient  from '../../config/apiClient';
import mediaPlayer from '../../services/mediaPlayer';
import useResponsive from '../../hook/useResponsive';

// 取得原片實際尺寸前的預設比例（16:9），避免 aspectRatio 為 0 導致高度塌陷。
const DEFAULT_ASPECT_RATIO = 16 / 9;
// 對話影片基準寬（手機），平板以 ms() 統一放大。取代舊版固定 256×144，
// 高度改由 aspectRatio 依原片比例自適應，降低上下黑邊（空白高度）機率。
const VIDEO_BASE_WIDTH = 256;

function ChatVideoArea({ videoMsg }) {
  const video = useRef(null);
  const { ms } = useResponsive();
  const videoUrl = apiclient.currentBaseUrl() + 'images/update/' + videoMsg;

  const videoWidth = ms(VIDEO_BASE_WIDTH);
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_ASPECT_RATIO);
  const [isPlaying, setIsPlaying] = useState(false);

  // 取得原片實際比例，讓容器高度貼合影片，避免固定高造成的上下留白。
  const onReadyForDisplay = useCallback((e) => {
    const w = e?.naturalSize?.width;
    const h = e?.naturalSize?.height;
    if (w && h) setAspectRatio(w / h);
  }, []);

  // 訊息影片：不自動播放，點畫面（整塊影片即按鈕）才播/暫停。經由單一播放管理（同時只播一個對象）。
  const togglePlay = useCallback(() => {
    if (isPlaying) {
      video.current?.pauseAsync?.().catch(() => {});
      setIsPlaying(false);
    } else {
      mediaPlayer.playVideo(video); // 先停其他對象再播
      setIsPlaying(true);
    }
  }, [isPlaying]);

  // 以 shouldPlay 反映播放意圖：被單一播放管理暫停或播畢時 → 回到「顯示播放鍵」狀態；
  // 用 shouldPlay 而非 isPlaying，避免緩衝中（尚未真正播出）誤判成暫停造成按鈕閃爍。
  const onPlaybackStatusUpdate = useCallback((status) => {
    if (!status?.isLoaded) return;
    if (status.didJustFinish) {
      setIsPlaying(false);
      return;
    }
    setIsPlaying(status.shouldPlay === true);
  }, []);

  return (
    <Pressable onPress={togglePlay}>
      <View style={styles.container}>
        <Video
          ref={video}
          style={[styles.video, { width: videoWidth, aspectRatio }]}
          source={{ uri: videoUrl }}
          resizeMode='contain'
          shouldPlay={false}
          onReadyForDisplay={onReadyForDisplay}
          onPlaybackStatusUpdate={onPlaybackStatusUpdate}
        />
        {!isPlaying ? (
          <View style={styles.playOverlay} pointerEvents="none">
            <MaterialCommunityIcons
              name="play"
              size={ms(56)}
              color={colors.white}
            />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: colors.dark,
  },
  video: {
    borderRadius: 15,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default React.memo(ChatVideoArea);
