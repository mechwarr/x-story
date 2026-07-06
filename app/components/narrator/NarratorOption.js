import { View, Platform, Pressable } from 'react-native';
import React, { useState } from 'react';
import AppText from '../AppText';

const NarratorOption = (props) => {
  const { onPressOption, choseRef } = props;
  
  return (
    <View>
      {[1, 2, 3].map((e) => {
        if (!props?.[`choice${e}Content`]) return;
        return (
          <Pressable
            key={e}
            onPress={() => {
              // 【轉場診斷】選項實際被按下：印出目標 choiceNext 與當下 choseRef 狀態。
              // 若按下卻沒有後續 [轉場診斷] 選項按下 → 代表被 onPressOption 內的 choseRef guard 擋掉；
              // 若連這行都沒印 → 代表 Pressable 被 disabled（choseRef.current 為 true）而未觸發。
              console.log('[轉場診斷] NarratorOption 按下 →', {
                choice: e,
                choiceNext: props?.[`choice${e}Next`],
                choseRef: choseRef?.current,
              });
              onPressOption && onPressOption(props?.[`choice${e}Next`]);
            }}
            disabled={choseRef?.current}
            style={{
              marginBottom: 10,
              justifyContent: 'center',
              alignContent: 'center',
              width: 300,
              height: 50,
              borderWidth: 0,
              borderRadius: 10,
              paddingHorizontal: 12,
              backgroundColor: props?.[`choice${e}BaseColor`],
            }}
          >
            <AppText
              style={{
                textAlign: 'center',
                ...(props?.[`choice${e}Weight`] === '粗' && {
                  fontWeight: Platform.OS === 'ios' ? 600 : 'bold',
                }),
                fontSize: +props?.[`choice${e}Size`] ?? 20,
                color: props?.[`choice${e}Color`],
              }}
            >
              {props?.[`choice${e}Content`]}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
};

export default NarratorOption;
