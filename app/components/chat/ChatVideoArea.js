import React, { useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Video } from 'expo-av';
import Slider from '@react-native-community/slider';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import colors from '../../config/colors';
import apiclient  from '../../config/apiClient';
import mediaPlayer from '../../services/mediaPlayer';
import useResponsive from '../../hook/useResponsive';

// 取得原片實際比例前的預設值（16:9），避免 aspectRatio 為 0 造成高度塌陷。
const DEFAULT_ASPECT_RATIO = 16 / 9;
// 對話影片基準寬（手機），平板以 ms() 統一放大；維持在聊天欄內的小尺寸（非滿版）。
const VIDEO_BASE_WIDTH = 256;

// 對話影片：聊天欄內小尺寸、近黑底(colors.dark)。不自動播放；中央顯示白色實心三角播放鈕，
// 點擊影片容器才播放（再點暫停），走單一播放管理 mediaPlayer。開始播放後，底部顯示一條
// 可拖曳的細進度條（讀 onPlaybackStatusUpdate 的 positionMillis/durationMillis，拖曳可 seek）。
function ChatVideoArea({ videoMsg }) {
  const video = useRef(null);
  const { ms } = useResponsive();
  const videoUrl = apiclient.currentBaseUrl() + 'images/update/' + videoMsg;
  const videoWidth = ms(VIDEO_BASE_WIDTH);

  const [aspectRatio, setAspectRatio] = useState(DEFAULT_ASPECT_RATIO);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  // 拖曳中：暫停以 status 回寫進度，避免拇指與播放位置互相拉扯跳動。
  const seekingRef = useRef(false);

  // 取得原片實際比例，讓小框高度貼合影片、降低上下黑邊。
  const onReadyForDisplay = useCallback((e) => {
    const w = e?.naturalSize?.width;
    const h = e?.naturalSize?.height;
    if (w && h) setAspectRatio(w / h);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      video.current?.pauseAsync?.().catch(() => {});
      setIsPlaying(false);
    } else {
      mediaPlayer.playVideo(video); // 先停其他對象再播
      setIsPlaying(true);
      setHasStarted(true);
    }
  }, [isPlaying]);

  const onPlaybackStatusUpdate = useCallback((status) => {
    if (!status?.isLoaded) return;
    if (typeof status.durationMillis === 'number') setDuration(status.durationMillis);
    if (!seekingRef.current && typeof status.positionMillis === 'number') {
      setPosition(status.positionMillis);
    }
    if (status.didJustFinish) {
      // 播畢：回到起點、顯示播放鈕，方便重播。
      setIsPlaying(false);
      setPosition(0);
      video.current?.setPositionAsync?.(0).catch(() => {});
      return;
    }
    // 以 shouldPlay 反映播放意圖（被單一播放管理暫停時也會轉 false）→ 決定是否顯示播放鈕。
    setIsPlaying(status.shouldPlay === true);
  }, []);

  const onSlidingStart = useCallback(() => {
    seekingRef.current = true;
  }, []);
  const onValueChange = useCallback((v) => {
    setPosition(v); // 拖曳中即時更新拇指位置
  }, []);
  const onSlidingComplete = useCallback((v) => {
    video.current?.setPositionAsync?.(v).catch(() => {});
    seekingRef.current = false;
  }, []);

  return (
    <View style={[styles.container, { width: videoWidth }]}>
      <Pressable onPress={togglePlay}>
        <Video
          ref={video}
          style={[styles.video, { width: videoWidth, aspectRatio }]}
          source={{ uri: videoUrl }}
          resizeMode="contain"
          shouldPlay={false}
          onReadyForDisplay={onReadyForDisplay}
          onPlaybackStatusUpdate={onPlaybackStatusUpdate}
        />
        {!isPlaying ? (
          <View style={styles.playOverlay} pointerEvents="none">
            <MaterialCommunityIcons name="play" size={ms(48)} color={colors.white} />
          </View>
        ) : null}
      </Pressable>

      {/* 自訂底部進度條：Slider 為 Pressable 的同層兄弟（非其子孫），拖曳手勢不會誤觸「點擊播放」。 */}
      {hasStarted ? (
        <View style={styles.progressBar} pointerEvents="box-none">
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={duration > 0 ? duration : 1}
            value={position}
            onSlidingStart={onSlidingStart}
            onValueChange={onValueChange}
            onSlidingComplete={onSlidingComplete}
            minimumTrackTintColor={colors.white}
            maximumTrackTintColor="rgba(255,255,255,0.35)"
            thumbTintColor={colors.white}
          />
        </View>
      ) : null}
    </View>
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
  progressBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 4,
  },
  slider: {
    width: '100%',
    height: 28,
  },
});

export default React.memo(ChatVideoArea);
