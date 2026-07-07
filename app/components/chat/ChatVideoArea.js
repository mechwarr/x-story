import React, { useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, Modal, Dimensions } from 'react-native';
import { Video } from 'expo-av';
import Slider from '@react-native-community/slider';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import colors from '../../config/colors';
import apiclient  from '../../config/apiClient';
import mediaPlayer from '../../services/mediaPlayer';
import useResponsive from '../../hook/useResponsive';

const screenWidth = Dimensions.get('window').width;
// 取得原片實際比例前的預設值（16:9），避免 aspectRatio 為 0 造成高度塌陷。
const DEFAULT_ASPECT_RATIO = 16 / 9;
// 對話影片縮圖基準寬（手機），平板以 ms() 統一放大；維持在聊天欄內的小尺寸。
const VIDEO_BASE_WIDTH = 256;

// 對話影片（LINE 式流程）：
//  1) 聊天欄內顯示「小縮圖（首幀）+ 白色三角播放鈕」，不播放。
//  2) 點縮圖 → 放大成全螢幕黑底(colors.dark)容器、影片以完整螢幕寬置中，自動開始播放；
//     底部有可拖曳的進度條（讀 positionMillis/durationMillis，拖曳可 seek）。
//  3) 點全螢幕影片任一處 → 縮回小縮圖（暫停）。播畢亦自動縮回。
// 全螢幕影片走單一播放管理 mediaPlayer（同時只播一個對象）。
function ChatVideoArea({ videoMsg }) {
  const { ms } = useResponsive();
  const videoUrl = apiclient.currentBaseUrl() + 'images/update/' + videoMsg;
  const thumbWidth = ms(VIDEO_BASE_WIDTH);

  const fsVideo = useRef(null);
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_ASPECT_RATIO);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  // 拖曳中：暫停以 status 回寫進度，避免拇指與播放位置互相拉扯跳動。
  const seekingRef = useRef(false);

  // 取得原片實際比例，讓縮圖高度貼合影片、降低上下黑邊。
  const onReadyForDisplay = useCallback((e) => {
    const w = e?.naturalSize?.width;
    const h = e?.naturalSize?.height;
    if (w && h) setAspectRatio(w / h);
  }, []);

  const openFullscreen = useCallback(() => {
    setPosition(0);           // 每次開啟從頭播放
    setIsFullscreen(true);
  }, []);

  const closeFullscreen = useCallback(() => {
    fsVideo.current?.pauseAsync?.().catch(() => {});
    mediaPlayer.release();    // 停止並釋放目前播放對象
    setIsFullscreen(false);
  }, []);

  // 全螢幕影片載入完成 → 自動播放（交由單一播放管理，先停其他對象）。
  const onFsLoad = useCallback(() => {
    mediaPlayer.playVideo(fsVideo);
  }, []);

  const onPlaybackStatusUpdate = useCallback((status) => {
    if (!status?.isLoaded) return;
    if (typeof status.durationMillis === 'number') setDuration(status.durationMillis);
    if (!seekingRef.current && typeof status.positionMillis === 'number') {
      setPosition(status.positionMillis);
    }
    if (status.didJustFinish) {
      closeFullscreen();      // 播畢自動縮回小縮圖
    }
  }, [closeFullscreen]);

  const onSlidingStart = useCallback(() => {
    seekingRef.current = true;
  }, []);
  const onValueChange = useCallback((v) => {
    setPosition(v); // 拖曳中即時更新拇指位置
  }, []);
  const onSlidingComplete = useCallback((v) => {
    fsVideo.current?.setPositionAsync?.(v).catch(() => {});
    seekingRef.current = false;
  }, []);

  return (
    <>
      {/* 縮圖：小尺寸、近黑底、首幀 + 白色三角鈕；點擊放大到全螢幕 */}
      <Pressable onPress={openFullscreen}>
        <View style={[styles.thumb, { width: thumbWidth }]}>
          <Video
            style={[styles.thumbVideo, { width: thumbWidth, aspectRatio }]}
            source={{ uri: videoUrl }}
            resizeMode="contain"
            shouldPlay={false}
            onReadyForDisplay={onReadyForDisplay}
          />
          <View style={styles.playOverlay} pointerEvents="none">
            <MaterialCommunityIcons name="play" size={ms(48)} color={colors.white} />
          </View>
        </View>
      </Pressable>

      {/* 全螢幕黑底播放器 */}
      <Modal
        visible={isFullscreen}
        animationType="fade"
        onRequestClose={closeFullscreen}
        supportedOrientations={['portrait', 'landscape']}
      >
        <View style={styles.fsContainer}>
          {/* 點影片任一處 → 縮回小縮圖（進度條為兄弟層，不受影響） */}
          <Pressable style={styles.fsPress} onPress={closeFullscreen}>
            <Video
              ref={fsVideo}
              style={styles.fsVideo}
              source={{ uri: videoUrl }}
              resizeMode="contain"
              shouldPlay={false}
              onLoad={onFsLoad}
              onPlaybackStatusUpdate={onPlaybackStatusUpdate}
            />
          </Pressable>

          {/* 底部可拖曳進度條（貼齊全螢幕黑底容器底部） */}
          <View style={styles.fsProgress} pointerEvents="box-none">
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
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  thumb: {
    alignSelf: 'flex-start',
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: colors.dark,
  },
  thumbVideo: {
    borderRadius: 15,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fsContainer: {
    flex: 1,
    backgroundColor: colors.dark, // 全螢幕近黑底
    justifyContent: 'center',
  },
  fsPress: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
  },
  fsVideo: {
    width: screenWidth, // 完整螢幕寬，contain 置中（保留比例，上下留黑邊）
    height: '100%',
  },
  fsProgress: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 30, // 避開底部安全區
    paddingHorizontal: 12,
  },
  slider: {
    width: '100%',
    height: 28,
  },
});

export default React.memo(ChatVideoArea);
