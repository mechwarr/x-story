import React, { useRef } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Video } from 'expo-av';
import colors from '../../config/colors';
import apiclient  from '../../config/apiClient';

function ChatVideoArea({ videoMsg }) {
  const video = useRef(null);
  // const [status, setStatus] = useState({});
  const videoUrl = apiclient.currentBaseUrl() + 'images/update/' + videoMsg;

  // 不自動播放：改由使用者點擊（Pressable / 原生播放控制）才播放。

  return (
    <Pressable
      onPress={() => {
        video.current?.playAsync();
      }}
    >
      <View style={styles.container}>
        <Video
          ref={video}
          style={styles.video}
          source={{ uri: videoUrl }}
          useNativeControls
          resizeMode='contain'
          // isLooping
          // onPlaybackStatusUpdate={(status) => setStatus(() => status)}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 15,
    backgroundColor: colors.dark,
  },
  video: {
    borderRadius: 15,
    width: 256,
    height: 144,
  },
});

export default React.memo(ChatVideoArea);
