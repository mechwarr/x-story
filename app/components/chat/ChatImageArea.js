import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, Image } from 'react-native';
import ImageModal from '../ImageModal';
import routes from '../../navigations/routes';
import apiclient  from '../../config/apiClient';
import { useGuardedNavigate } from '../../../hooks/useGuardedNavigate';

const domain = apiclient.currentBaseUrl() + 'images/update/';
// 載入前的預設比例，避免取得原圖尺寸前 aspectRatio 為 0 導致高度塌陷。
const DEFAULT_ASPECT_RATIO = 4 / 3;

function ChatImageArea({ imgMsg, backgroundColor }) {
  const imageUrl = domain + imgMsg;
  const modalRef = useRef(null);
  const navigation = useGuardedNavigate();
  // RWD：圖片寬度一律滿版（width 100% = 對話列扣掉頭像/間距後的剩餘寬度），
  // 高度依原圖比例（aspectRatio）自適應，手機／平板同一套邏輯、不另設固定寬度。
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_ASPECT_RATIO);

  useEffect(() => {
    let mounted = true;
    Image.getSize(
      imageUrl,
      (width, height) => {
        if (!mounted || !width || !height) return;
        setAspectRatio(width / height);
      },
      () => {} // 取尺寸失敗則沿用預設比例，仍維持滿版寬度可顯示
    );
    return () => {
      mounted = false;
    };
  }, [imageUrl]);

  return (
    <View style={[{ flex: 1 }]}>
      <Pressable
        onPress={() => {
          navigation.navigate(routes.IMAGE, {
            img: imageUrl,
          });
        }}
      >
        <View style={[styles.container, backgroundColor]}>
          <Image
            fadeDuration={0}
            style={[styles.img, { width: '100%', aspectRatio }]}
            source={{ uri: imageUrl }}
            resizeMode='contain'
          />
        </View>
      </Pressable>
      <ImageModal ref={modalRef} imageUrl={imageUrl} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 15,
  },
  img: {
    borderRadius: 15,
  },
});

export default React.memo(ChatImageArea);
