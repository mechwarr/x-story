import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, Image } from 'react-native';
import ImageModal from '../ImageModal';
import routes from '../../navigations/routes';
import apiclient  from '../../config/apiClient';
import { useGuardedNavigate } from '../../../hooks/useGuardedNavigate';
import useResponsive from '../../hook/useResponsive';

const domain = apiclient.currentBaseUrl() + 'images/update/';
// 載入前的預設比例，避免取得原圖尺寸前 aspectRatio 為 0 導致高度塌陷。
const DEFAULT_ASPECT_RATIO = 4 / 3;
// 訊息圖片的基準寬度（手機）。平板用 ms() 統一放大，不滿版以免撐爆整列、把頭像欄拉高。
const IMG_BASE_WIDTH = 256;

function ChatImageArea({ imgMsg, backgroundColor }) {
  const imageUrl = domain + imgMsg;
  const modalRef = useRef(null);
  const navigation = useGuardedNavigate();
  const { ms } = useResponsive();
  // RWD：圖片寬度收斂到基準寬（手機 256、平板 ms() 放大），高度依原圖比例（aspectRatio）
  // 自適應；不再滿版，避免訊息列被撐寬撐高、連帶把左側頭像欄拉長。
  const imgWidth = ms(IMG_BASE_WIDTH);
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
    <View style={{ alignSelf: 'flex-start' }}>
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
            style={[styles.img, { width: imgWidth, aspectRatio }]}
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
    alignSelf: 'flex-start',
    borderRadius: 15,
  },
  img: {
    borderRadius: 15,
  },
});

export default React.memo(ChatImageArea);
