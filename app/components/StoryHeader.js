import React from 'react';
import { View, StyleSheet, Platform, Pressable } from 'react-native';
import AppText from './AppText';

import colors from '../config/colors';

function StoryHeader({ storyName, author, config, isAutoPlay, onToggleAutoPlay }) {
  const {
    author_color,
    author_size,
    author_weight,
    stroy_name_color,
    stroy_name_size,
    stroy_name_weight,
  } = config ?? {};

  return (
    <View style={styles.container}>
      {/* 書名（config 未載入前不顯示） */}
      <View style={styles.titleGroup}>
        {author_size ? (
          <AppText
            style={[
              styles.text,
              {
                fontSize: stroy_name_size ?? 20,
                color: stroy_name_color?.trim() || '#fff',
                ...(stroy_name_weight === '粗' && {
                  fontWeight: Platform.OS === 'ios' ? 600 : 'bold',
                }),
              },
            ]}
          >
            {storyName}
          </AppText>
        ) : null}
      </View>

      {/* 自動播放開關：綠底圓角鈕，置中於書名與作者之間，僅劇情內（有傳 onToggleAutoPlay）時顯示 */}
      {onToggleAutoPlay ? (
        <View style={styles.centerGroup} pointerEvents="box-none">
          <Pressable onPress={onToggleAutoPlay} hitSlop={8} style={styles.autoBtn}>
            <AppText style={styles.autoBtnText}>Auto</AppText>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.rightGroup}>
        {author_size ? (
          <AppText
            style={[
              styles.text,
              {
                fontSize: author_size ?? 20,
                color: author_color || '#fff',
                ...(author_weight === '粗' && {
                  fontWeight: Platform.OS === 'ios' ? 600 : 'bold',
                }),
              },
            ]}
          >
            {author}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    minHeight: 30,
    paddingHorizontal: 15,
    marginBottom: 20,
    marginTop: 10,
    paddingBottom: 2,
    backgroundColor: colors.transparent,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleGroup: {
    flexShrink: 1,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  centerGroup: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoBtn: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.autoPlayGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  text: {
    fontWeight: 'bold',
    fontSize: 20,
  },
});

export default StoryHeader;
