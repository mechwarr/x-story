import {
  View,
  StyleSheet,
  Pressable,
  Alert,
  Image,
  ImageBackground,
  Platform,
  Modal,
  Text,
} from 'react-native';
import React, { useState, useCallback } from 'react';
import AppText from './AppText';
import routes from '../navigations/routes';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import apiclient from '../config/apiClient';
import { useGuardedNavigate } from '../../hooks/useGuardedNavigate';
import { purchaseStoryWithCoins } from '../config/userApiClient';
import { getOrCreateIdempotencyKey, clearIdempotencyKey } from '../config/idempotencyKeyCache';
import { translate, getCurrentStoryLang } from '../i18n/i18n';
import colors from '../config/colors';
import storage from '../storage/storage';
import { canAccessChapter } from '../services/bookAccessService';

const ChapterItem = (props) => {
  const {
    chapter_name,
    chapter_name_size,
    chapter_img,
    chapter_name_weight,
    chapter_name_color,
    chapter_infor,
    window_title,
    window_btn_left,
    window_btn_right,
    free_open,
    storyId,
    id,
    lang,
    read_range_end,
    index,
    author,
    storyData,
    nochapter,
    uiConfig,
    storyName,
    priceCoins = 0,
    coins = 0,
    refreshCoins,
    isBookPurchased = false,
    onPurchaseSuccess,
  } = props ?? {};

  const isFreeOpen = free_open === '開放';
  const canView = canAccessChapter({ freeOpen: free_open, isBookPurchased });
  const showLock = !canView;

  const navigation = useGuardedNavigate();
  const imageUri = apiclient.currentBaseUrl() + `images/update/${chapter_img}`;
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  const navigateToStory = useCallback(() => {
    navigation.navigate(routes.STORY, {
      storyId,
      chapterId: id,
      name: storyName,
      author,
      storyData,
      nochapter,
      read_range_end,
      free_open,
    });
  }, [navigation, storyId, id, storyName, author, storyData, nochapter, read_range_end, free_open]);

  const handlePurchaseStory = useCallback(() => {
    if (!storyId) {
      Alert.alert('錯誤', '找不到故事 ID');
      return;
    }
    if (!priceCoins || priceCoins <= 0) {
      Alert.alert('提示', '此故事無法購買');
      return;
    }
    if (coins < priceCoins) {
      Alert.alert(
        '金幣不足',
        `此故事需要 ${priceCoins} 金幣，您目前有 ${coins} 金幣。\n請前往商城購買更多金幣。`,
        [
          { text: translate('cancel') || '取消', style: 'cancel' },
          {
            text: '前往商城',
            onPress: () => navigation.navigate(routes.HOME, { screen: routes.SHOP }),
          },
        ]
      );
      return;
    }
    Alert.alert(
      '確認購買',
      `確定要使用 ${priceCoins} 金幣購買「${storyName}」嗎？`,
      [
        { text: translate('cancel') || '取消', style: 'cancel' },
        {
          text: '確認購買',
          onPress: async () => {
            try {
              const idempotencyKey = await getOrCreateIdempotencyKey(storyId);
              const result = await purchaseStoryWithCoins({
                storyListId: storyId,
                idempotencyKey,
              });
              if (result) {
                await clearIdempotencyKey(storyId);
                await refreshCoins?.();
                await storage.addLocalPurchasedStoryId(storyId);
                onPurchaseSuccess?.();
                setShowPurchaseModal(false);
                Alert.alert(
                  '購買成功',
                  `您已成功購買「${storyName}」！\n\n花費 ${result.coinsSpent || priceCoins} 金幣`,
                  [{ text: translate('ok') || '確定' }]
                );
              } else {
                Alert.alert('購買失敗', '請稍後再試');
              }
            } catch (error) {
              console.error('[ChapterItem] 購買失敗:', error);
              Alert.alert('購買失敗', error?.message || '發生錯誤，請稍後再試');
            }
          },
        },
      ]
    );
  }, [storyId, priceCoins, coins, storyName, navigation, refreshCoins, onPurchaseSuccess]);

  const onPress = () => {
    if (canView) {
      if (isFreeOpen) {
        Alert.alert(
          window_title,
          chapter_infor,
          [
            { text: window_btn_left, cancelable: true },
            {
              text: window_btn_right,
              onPress: navigateToStory,
            },
          ],
          { cancelable: true }
        );
      } else {
        navigateToStory();
      }
    } else {
      setShowPurchaseModal(true);
    }
  };

  // 只顯示與 App 啟動語系相符的章節（取代原本寫死的「繁體中文」）
  if (lang !== getCurrentStoryLang()) return null;
  return (
    <>
      <Pressable
        style={[
          styles.container,
          {
            borderWidth: +uiConfig?.chapter_outer_weight,
            borderColor: uiConfig?.chapter_outer_color,
          },
        ]}
        onPress={onPress}
      >
        <ImageBackground source={{ uri: imageUri }} style={styles.imgBg}>
          {showLock ? (
            <View style={styles.lock}>
              <Image
                style={styles.lockIcon}
                source={require('../../assets/lock.png')}
              />
            </View>
          ) : null}
          <AppText
          style={{
            fontSize: chapter_name_size || 20,
            ...(chapter_name_weight === '粗' && {
              fontWeight: Platform.OS === 'ios' ? 600 : 'bold',
            }),
            alignSelf: index % 2 !== 0 ? 'flex-end' : 'flex-start',
            alignItems: 'flex-end',
            color: chapter_name_color || '#fff',
          }}
        >
          {chapter_name}
        </AppText>
      </ImageBackground>
    </Pressable>

      <Modal
        visible={showPurchaseModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPurchaseModal(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setShowPurchaseModal(false)}
        >
          <Pressable style={styles.overlayContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.purchaseButtonWrap}>
              <Pressable
                style={styles.purchaseButton}
                onPress={handlePurchaseStory}
              >
                <View style={styles.purchaseButtonRow}>
                  <Text style={styles.purchaseButtonText}>
                    {translate('unlock')}
                  </Text>
                  <Image
                    style={styles.purchaseButtonCoin}
                    source={require('../../assets/coin.png')}
                  />
                  <Text style={styles.purchaseButtonText}>{priceCoins}</Text>
                </View>
              </Pressable>
            </View>
            <Pressable
              style={styles.closeOverlayButton}
              onPress={() => setShowPurchaseModal(false)}
            >
              <Text style={styles.closeOverlayButtonText}>關閉</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    // flex: 1,
    height: wp('50%'),
    width: wp('90%'),
    borderWidth: 4,
    marginBottom: 20,
  },
  imgBg: { width: '100%', height: '100%', justifyContent: 'flex-end' },
  lockIcon: {
    width: 40,
    height: 40,
  },
  lock: {
    position: 'absolute',
    zIndex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayContent: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  purchaseButtonWrap: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  purchaseButton: {
    paddingVertical: 15,
    paddingHorizontal: 24,
    backgroundColor: colors.primary,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  purchaseButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  purchaseButtonText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
  },
  purchaseButtonCoin: {
    width: 27,
    height: 27,
  },
  closeOverlayButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  closeOverlayButtonText: {
    fontSize: 16,
    color: '#fff',
  },
});

export default ChapterItem;
