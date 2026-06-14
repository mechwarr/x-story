import {
  View,
  StyleSheet,
  Pressable,
  Image,
  ImageBackground,
  Platform,
  Modal,
  Text,
} from 'react-native';
import { showAlert } from "./CustomAlert";
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
import { translate, matchesCurrentStoryLang } from '../i18n/i18n';
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

  // 後端「試閱場次範圍(尾)」(read_range_end) 為 0（或非正數）代表沒有設定試閱長度。
  // 只有「試閱章節且尚未購買」才依賴此範圍，購買後為完整內容、不受限。
  const trialRangeEnd = Number(read_range_end);
  const isTrialRangeInvalid =
    isFreeOpen && !isBookPurchased && Number.isFinite(trialRangeEnd) && trialRangeEnd <= 0;

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
      showAlert(translate('genericErrorTitle'), translate('storyIdNotFound'));
      return;
    }
    if (!priceCoins || priceCoins <= 0) {
      showAlert(translate('noticeTitle'), translate('storyNotPurchasable'));
      return;
    }
    if (coins < priceCoins) {
      showAlert(
        translate('coinsInsufficientTitle'),
        translate('coinsInsufficientMessage', { price: priceCoins, coins }),
        [
          { text: translate('cancel'), style: 'cancel' },
          {
            text: translate('goToShop'),
            onPress: () => navigation.navigate(routes.HOME, { screen: routes.SHOP }),
          },
        ]
      );
      return;
    }
    showAlert(
      translate('confirmPurchase'),
      translate('confirmPurchaseMessage', { price: priceCoins, name: storyName }),
      [
        { text: translate('cancel'), style: 'cancel' },
        {
          text: translate('confirmPurchase'),
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
                showAlert(
                  translate('purchaseSuccessTitle'),
                  translate('purchaseSuccessMessage', { name: storyName, coins: result.coinsSpent || priceCoins }),
                  [{ text: translate('ok') }]
                );
              } else {
                showAlert(translate('purchaseFailedTitle'), translate('purchaseFailedRetry'));
              }
            } catch (error) {
              console.error('[ChapterItem] 購買失敗:', error);
              showAlert(translate('purchaseFailedTitle'), error?.message || translate('purchaseErrorGeneric'));
            }
          },
        },
      ]
    );
  }, [storyId, priceCoins, coins, storyName, navigation, refreshCoins, onPurchaseSuccess]);

  const onPress = () => {
    if (canView) {
      // 試閱章節但後端未設定試閱範圍（試閱場次範圍尾為 0）：警告且不進入，避免進場後空白／彈回
      if (isTrialRangeInvalid) {
        showAlert(translate('noticeTitle'), translate('trialRangeNotSet'));
        return;
      }
      if (isFreeOpen) {
        showAlert(
          window_title,
          chapter_infor,
          [
            { text: window_btn_left, cancelable: true },
            {
              text: translate('ok'),
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
  // 用正規化比對，避免後端 lang 欄位簡繁字形/文案差異造成比對失敗
  if (!matchesCurrentStoryLang(lang)) return null;
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
              <Text style={styles.closeOverlayButtonText}>{translate('close')}</Text>
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
