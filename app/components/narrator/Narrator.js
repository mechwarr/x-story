import React, { useMemo } from 'react';
import { Image, Platform, Pressable, StyleSheet, View } from 'react-native';

import { widthPercentageToDP as wp } from 'react-native-responsive-screen';
import colors from '../../config/colors';
import AppText from '../AppText';
import NarratorOption from './NarratorOption';
import NarratorSound from './NarratorSound';
import NarratorVideo from './NarratorVideo';
import apiclient  from '../../config/apiClient';

function Narrator(props) {
  const {
    textMsg,
    imgMsg,
    soundMsg,
    videoMsg,
    videoDirection,
    choice1Content = '',
    onPressOption,
    textContentColor,
    textContentWeight,
    textContentSize,
    textContentBaseColor,
    choseRef,
    isActive = true,
    // 是否可主動播放影片/音效：true=逐段推進新增（自動/手動點擊），false=繼續閱讀還原的歷史段落。
    autoPlay = true,
  } = props;

  const imgUrl = useMemo(
    () => apiclient.currentBaseUrl() + 'images/update/' + imgMsg,
    [imgMsg]
  );
  return (
    <Pressable style={[styles.contentContainer]} onPress={() => onPressOption(null)}>
      {textMsg ? (
        <View
          style={{
            backgroundColor: textContentBaseColor ?? 'transparent',
            borderRadius: 20,
            padding: 10,
          }}
        >
          <AppText
            style={{
              textAlign: 'center',
              fontSize: textContentSize || 20,
              color: textContentColor || '#fff',
              ...(textContentWeight === '粗' && {
                fontWeight: Platform.OS === 'ios' ? 600 : 'bold',
              }),
            }}
          >
            {textMsg}
          </AppText>
        </View>
      ) : null}
      {imgMsg ? (
        <Image
          style={{ width: wp('100%'), height: 200 }}
          source={{ uri: imgUrl }}
        />
      ) : null}
      {soundMsg ? <NarratorSound soundMsg={soundMsg} autoPlay={autoPlay} /> : null}
      {videoMsg ? (
        <NarratorVideo
          videoMsg={videoMsg}
          videoDirection={videoDirection}
          autoPlay={autoPlay}
        />
      ) : null}
      {choice1Content && isActive ? (
        <NarratorOption
          {...props}
          onPressOption={onPressOption}
          choseRef={choseRef}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    alignSelf: 'center',
    backgroundColor: colors.transparent,
    marginVertical: 3,
    flex: 1,
  },
});

export default React.memo(Narrator);
