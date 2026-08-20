// app/components/HeaderEyeLogo.tsx
// 登入 / 註冊 / 忘記密碼 / 重設密碼等「沒有頂欄結構」的頁面用的左上角藍眼。
// 這些頁面原本各自寫死 position:absolute + top:20 + left:20，與首頁對不上；
// 改為絕對定位到 useHeaderMetrics 算出的 eyeTop / eyeLeft，位置即與首頁頂欄的藍眼完全相同。
import React from 'react';
import { View, Image, Pressable } from 'react-native';
import useHeaderMetrics from '../hook/useHeaderMetrics';

type Props = {
  /** 有傳才可點（登入類頁面通常只是 logo，不可點） */
  onPress?: () => void;
};

export default function HeaderEyeLogo({ onPress }: Props) {
  const { iconSize, eyeLeft, eyeTop } = useHeaderMetrics();
  const image = (
    <Image
      source={require('../../assets/blueeye.png')}
      style={{ width: iconSize, height: iconSize }}
      resizeMode="contain"
    />
  );

  return (
    <View style={{ position: 'absolute', top: eyeTop, left: eyeLeft, zIndex: 10 }}>
      {onPress ? (
        <Pressable onPress={onPress} hitSlop={8}>
          {image}
        </Pressable>
      ) : (
        image
      )}
    </View>
  );
}
