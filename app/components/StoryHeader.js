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
      {/* 書名（config 未載入前不顯示）。
          允許最多兩行；長書名時以 adjustsFontSizeToFit 自動縮小字級塞進兩行，
          字級基準仍取 CMS 的 stroy_name_size（變動）。 */}
      <View style={styles.titleGroup}>
        {author_size ? (
          <AppText
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
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
          {/* 關閉時為灰底（預設）；自動播放啟動中 → 底色轉綠，暗示「自動中」；文字顏色不變 */}
          <Pressable
            onPress={onToggleAutoPlay}
            hitSlop={8}
            style={[styles.autoBtn, isAutoPlay && styles.autoBtnActive]}
          >
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
    // 侷限在左側（避免長書名折兩行時往右壓到置中的 Auto 鈕）。
    maxWidth: '40%',
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
    borderRadius: 20,
    backgroundColor: colors.autoPlayGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoBtnActive: {
    backgroundColor: 'rgba(19, 158, 155, 0.7)',
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
