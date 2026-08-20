import {
  View,
  StyleSheet,
  Pressable,
  Image,
  ImageBackground,
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
import { translate, matchesCurrentStoryLang, coinCountLabel } from '../i18n/i18n';
import colors from '../config/colors';
import storage from '../storage/storage';
import { recordCoinOrderBook } from '../storage/coinOrderBooks';
import { canAccessChapter } from '../services/bookAccessService';
import useResponsive from '../hook/useResponsive';
import { toAlertTextStyle } from '../config/foolproofStyle';
import { toColor, toFontWeight } from '../config/normalizeStyle';

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
    toastConfig,
    storyName,
    priceCoins = 0,
    coins = 0,
    refreshCoins,
    isBookPurchased = false,
    onPurchaseSuccess,
    isAdmin = false,
  } = props ?? {};

  const { isTablet } = useResponsive();
  // 解鎖鎖頭 icon：平板 RWD 放大 1/3，手機維持原尺寸
  const LOCK_ICON_BASE_SIZE = 40;
  const lockIconSize = isTablet
    ? Math.round(LOCK_ICON_BASE_SIZE * (4 / 3))
    : LOCK_ICON_BASE_SIZE;

  const isFreeOpen = free_open === '開放';
  // isAdmin 由 ChapterScreen 以 canPreviewAll(role>=5) 解析後下傳：小編／管理員可完整預覽、
  // 不需購買、不受試閱設定限制（需求 5/6）。故 canPreview 直接沿用此旗標。
  const canView = canAccessChapter({ freeOpen: free_open, isBookPurchased, canPreview: isAdmin });
  const showLock = !canView;

  // 後端「試閱場次範圍(尾)」(read_range_end) 為 0（或非正數）代表沒有設定試閱長度。
  // 只有「試閱章節且尚未購買」才依賴此範圍，購買後為完整內容、不受限。
  // role >= 5（小編／管理員）例外：試閱未設範圍時仍可直接進入觀看完整內容，不視為無效試閱而攔截。
  const trialRangeEnd = Number(read_range_end);
  const isTrialRangeInvalid =
    isFreeOpen && !isBookPurchased && !isAdmin && Number.isFinite(trialRangeEnd) && trialRangeEnd <= 0;

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
    // 購買相關視窗一律顯示「主選單書名」main_menu_name；用 || 而非 ??，
    // 連空字串也擋掉（CMS 該語系列缺值時退回 storyName，源頭同為主選單書名）。
    const bookTitle = storyData?.main_menu_name || storyName;
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
        translate('coinsInsufficientMessage', {
          priceLabel: coinCountLabel(priceCoins),
          coinsLabel: coinCountLabel(coins),
        }),
        [
          { text: translate('cancel'), style: 'cancel' },
          {
            text: translate('goToShop'),
            onPress: () => navigation.navigate(routes.PURCHASE),
          },
        ]
      );
      return;
    }
    showAlert(
      translate('confirmPurchase'),
      translate('confirmPurchaseMessage', { price: priceCoins, name: bookTitle }),
      [
        { text: translate('cancel'), style: 'cancel' },
        {
          text: translate('confirmUnlockButton'),
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
                // 記下訂單↔書籍對照：金幣紀錄只拿得到 ORDER 編號，只有此刻知道它對應哪本書
                await recordCoinOrderBook(result.orderId, result.storyListId ?? storyId);
                onPurchaseSuccess?.();
                setShowPurchaseModal(false);
                showAlert(
                  translate('unlockSuccessTitle'),
                  translate('purchaseSuccessMessage', { name: bookTitle, coins: result.coinsSpent || priceCoins }),
                  [{ text: translate('startReading') }]
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
  }, [storyId, priceCoins, coins, storyName, storyData, navigation, refreshCoins, onPurchaseSuccess]);

  // (分)章節-防呆視窗（章節介紹彈窗）：標題/內文/兩顆按鈕的字級與顏色，來自 setup-chapter-foolproof
  // 參數表（toastConfig，已於 ChapterScreen 依語系挑列）。未設定的欄位會自動略過、沿用預設。
  // onConfirm 為使用者按右鍵「確認」後要執行的動作（進入章節或跳出解鎖列）。
  const showChapterIntro = useCallback((onConfirm) => {
    showAlert(
      window_title,
      chapter_infor,
      [
        {
          text: window_btn_left,
          cancelable: true,
          textStyle: toAlertTextStyle(
            toastConfig?.chapter_foolproof_stroy_item1_size,
            toastConfig?.chapter_foolproof_stroy_item1_weight,
            toastConfig?.chapter_foolproof_stroy_item1_color
          ),
        },
        {
          // 右按鈕字詞同樣來自後端章節欄位 window_btn_right，後台缺值時才退回內建 OK
          text: window_btn_right || translate('ok'),
          onPress: onConfirm,
          textStyle: toAlertTextStyle(
            toastConfig?.chapter_foolproof_stroy_item2_size,
            toastConfig?.chapter_foolproof_stroy_item2_weight,
            toastConfig?.chapter_foolproof_stroy_item2_color
          ),
        },
      ],
      { cancelable: true },
      {
        titleStyle: toAlertTextStyle(
          toastConfig?.chapter_foolproof_story_name_size,
          toastConfig?.chapter_foolproof_story_name_weight,
          toastConfig?.chapter_foolproof_story_name_color
        ),
        messageStyle: toAlertTextStyle(
          toastConfig?.chapter_foolproof_stroy_information_size,
          toastConfig?.chapter_foolproof_stroy_information_weight,
          toastConfig?.chapter_foolproof_stroy_information_color
        ),
      }
    );
  }, [window_title, chapter_infor, window_btn_left, window_btn_right, toastConfig]);

  const onPress = () => {
    if (canView) {
      // 試閱章節但後端未設定試閱範圍（試閱場次範圍尾為 0）：警告且不進入，避免進場後空白／彈回
      if (isTrialRangeInvalid) {
        showAlert(translate('genericErrorTitle'), translate('trialRangeNotSet'));
        return;
      }
      // 可讀章節（試閱或已購買/已解鎖）一律先出章節介紹彈窗，確認後才進入章節
      showChapterIntro(navigateToStory);
    } else {
      // 付費且未購買的章節：一樣先出章節介紹彈窗，使用者按確認後才跳出解鎖列（不再直接彈解鎖）
      showChapterIntro(() => setShowPurchaseModal(true));
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
            borderColor: toColor(uiConfig?.chapter_outer_color, '') || undefined,
          },
        ]}
        onPress={onPress}
      >
        <ImageBackground source={{ uri: imageUri }} style={styles.imgBg}>
          {showLock ? (
            <View style={styles.lock}>
              <Image
                style={[styles.lockIcon, { width: lockIconSize, height: lockIconSize }]}
                source={require('../../assets/lock.png')}
              />
            </View>
          ) : null}
          <AppText
          style={{
            fontSize: chapter_name_size || 20,
            fontWeight: toFontWeight(chapter_name_weight),
            alignSelf: index % 2 !== 0 ? 'flex-end' : 'flex-start',
            alignItems: 'flex-end',
            color: toColor(chapter_name_color),
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
    resizeMode: 'contain',
  },
  lock: {
    position: 'absolute',
    zIndex: 1,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
