import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import { showAlert } from '../CustomAlert';
import routes from '../../navigations/routes';
import AppText from '../AppText';
import colors from '../../config/colors';
import apiclient  from '../../config/apiClient';
import { isTabletWidth, getUiScale } from '../../config/responsive';
import { translate } from '../../i18n/i18n';
import { useGuardedNavigate } from '../../../hooks/useGuardedNavigate';
import { purchaseStoryWithCoins, getEffectiveRoleLevel } from '../../config/userApiClient';
import { isAdmin } from '../../config/roles';
import { getOrCreateIdempotencyKey, clearIdempotencyKey } from '../../config/idempotencyKeyCache';
import { useCoins } from '../../store/coinContext';
import storage from '../../storage/storage';
import { toAlertTextStyle } from '../../config/foolproofStyle';

const screenWidth = Dimensions.get('window').width;
const isTablet = isTabletWidth(screenWidth);

// 平板統一放大係數（與全站一致：手機 1、平板 TABLET_UI_SCALE）。
// 書名字級以此縮放，lineHeight / 保留高度皆由字級推導，平板自動跟著放大。
const uiScale = getUiScale(screenWidth);
const ms = (size) => Math.round(size * uiScale);

// 解鎖鎖頭 icon：平板 RWD 放大 1/3，手機維持原尺寸
const LOCK_ICON_BASE_SIZE = 40;
const LOCK_ICON_SIZE = isTablet
  ? Math.round(LOCK_ICON_BASE_SIZE * (4 / 3))
  : LOCK_ICON_BASE_SIZE;

// 書封尺寸（手機 / 平板各一份，書名寬度一律跟隨書封寬度，避免各處寫死 150 / 225）。
const COVER_SIZE = isTablet ? { width: 225, height: 330 } : { width: 150, height: 220 };

// 書名排版常數（單一可調來源）
const NAME_MAX_LINES = 2; // 最多兩行：同時決定 numberOfLines 與保留高度
const NAME_LINE_HEIGHT_RATIO = 1.4; // 行高／字級比例
const NAME_FONT_SIZE_DEFAULT = 15; // CMS 未設定字級時的預設

function Book(props) {
  const {
    storyData = {},
    storyCache,
    nochapter,
    showIcon = false,
    showReviewIcon,
    index,
    chapterId,
    read_range_end,
    menuFoolproofConfig,
  } = props;
  const {
    main_menu_name,
    main_menu_name_size = '',
    main_menu_name_color = '',
    main_menu_image = '',
    main_menu_name_weight = '',
    main_menu_btn_left,
    main_menu_btn_right,
    main_menu_content = '',
    main_menu_title = '',
    open = '',
    chapter_type = '',
    author = '',
    id,
    lang,
    priceCoins, // 從 HomeScreen 傳入的價格資訊
  } = storyData;
  const navigation = useGuardedNavigate();
  const { coins, refreshCoins } = useCoins();
  const imageUri =
    apiclient.currentBaseUrl() + 'images/update/' + main_menu_image;
  const hasChapter = chapter_type === '章節';
  const isOpen = open === '公開';

  // 書名排版：以 CMS 字級為唯一輸入，經 ms() 吃平板縮放後，
  // lineHeight 與「兩行保留高度」全部推導；單行於此高度中垂直置中、兩行自然填滿。
  const nameFontSize = ms(Number(main_menu_name_size) || NAME_FONT_SIZE_DEFAULT);
  const lineHeight = Math.round(nameFontSize * NAME_LINE_HEIGHT_RATIO);
  const nameBoxHeight = lineHeight * NAME_MAX_LINES;

  const chapter = useMemo(() => {
    return nochapter?.find((e) => e.storyid === id);
  }, [nochapter]);

  const storyStatus = useMemo(() => {
    const read = storyCache?.continueStory?.find((e) => +e.storyId === +id);
    const finish = storyCache?.finishStory?.find((e) => +e.storyId === +id);
    const isNew = !(read || finish);
    return { read, finish, isNew };
  }, [storyCache]);

  const storyPayload = {
    name: main_menu_name,
    author,
    storyId: id,
    chapterId: chapterId ?? chapter?.id,
    storyData,
    nochapter,
    read_range_end: read_range_end ?? chapter?.read_range_end,
    // 無章節書籍的試閱旗標：與 read_range_end 同源（無章節對應的 chapter 記錄）。
    // 少了它，StoryScreen 讀完試閱時 free_open !== '開放' → 不會跳購買視窗、直接彈回首頁。
    free_open: chapter?.free_open,
  };

  // 繼續觀看：以該書「最後一次的存檔」(continueStory item) 原樣回到原章節/場次/對話順序，
  // 一次到位。存檔本身即含 storyId / chapterId / read_range_end / free_open / storyData /
  // nochapter，以及 cachedIndex(screen＝場次, story＝對話索引, path＝造訪對話順序, scrollOffset)。
  // 這裡直接帶入這些欄位、不經 storyPayload 重新推導，避免覆蓋掉存檔的定位資訊
  // （storyPayload 會把 storyId 改成 storyData.id、並用 nochapter 重算 chapterId/read_range_end）。
  const goToContinue = () => {
    navigation.navigate(routes.HOME, {
      screen: routes.STORY,
      params: {
        name: main_menu_name,
        author,
        storyId: props.storyId ?? id,
        chapterId: chapterId ?? chapter?.id,
        storyData,
        nochapter,
        // 章節/場次/對話順序的還原核心：一律以存檔為準。
        cachedIndex: props.cachedIndex,
        read_range_end: read_range_end ?? chapter?.read_range_end,
        // 優先用存檔保留的試閱旗標；舊版存檔沒有時退回 nochapter 推導。
        free_open: props.free_open ?? chapter?.free_open,
      },
    });
  };

  // 從頭開始（重新閱讀）：有章節進章節列表，否則進故事頁
  const goToStart = () => {
    if (hasChapter) {
      navigation.navigate(routes.HOME, {
        screen: routes.CHAPTER,
        params: {
          name: main_menu_name,
          author,
          storyId: id,
          storyData,
        },
      });
    } else {
      navigation.navigate(routes.HOME, {
        screen: routes.STORY,
        params: storyPayload,
      });
    }
  };

  // 處理購買故事
  const handlePurchaseStory = async () => {
    if (!id) {
      showAlert(translate('genericErrorTitle'), translate('storyIdNotFound'));
      return;
    }

    // 檢查是否有價格資訊
    if (!priceCoins || priceCoins <= 0) {
      showAlert(translate('noticeTitle'), translate('storyNotPurchasable'));
      return;
    }

    // 檢查金幣餘額
    if (coins < priceCoins) {
      showAlert(
        translate('coinsInsufficientTitle'),
        translate('coinsInsufficientMessage', { price: priceCoins, coins }),
        [
          { text: translate('cancel'), style: 'cancel' },
          {
            text: translate('goToShop'),
            onPress: () => {
              navigation.navigate(routes.HOME, {
                screen: routes.SHOP,
              });
            },
          },
        ]
      );
      return;
    }

    // 確認購買
    showAlert(
      translate('confirmPurchase'),
      translate('confirmPurchaseMessage', { price: priceCoins, name: main_menu_name }),
      [
        { text: translate('cancel'), style: 'cancel' },
        {
          text: translate('confirmPurchase'),
          onPress: async () => {
            try {
              // 獲取或創建 idempotencyKey（如果緩存中存在，使用緩存的；否則創建新的）
              const idempotencyKey = await getOrCreateIdempotencyKey(id);
              
              console.log('[Book] ========== 開始購買故事 ==========');
              console.log('[Book] storyListId:', id);
              console.log('[Book] idempotencyKey (使用緩存或新建):', idempotencyKey);
              console.log('[Book] 價格:', priceCoins, '金幣');
              
              // 調用購買 API
              const result = await purchaseStoryWithCoins({
                storyListId: id,
                idempotencyKey,
              });

              if (result) {
                console.log('[Book] ✓ 購買成功');
                
                // 購買成功後，清除 idempotencyKey 緩存
                await clearIdempotencyKey(id);
                console.log('[Book] ✓ 已清除 idempotencyKey 緩存');
                // 本地記錄已購買，章節頁可據此隱藏購買按鈕
                await storage.addLocalPurchasedStoryId(id);
                
                // 購買成功後強制刷新金幣餘額
                await refreshCoins(true);
                
                showAlert(
                  translate('purchaseSuccessTitle'),
                  translate('purchaseSuccessMessage', { name: main_menu_name, coins: result.coinsSpent || priceCoins }),
                  [
                    {
                      text: translate('ok'),
                      onPress: () => {
                        // 購買成功後，導航到故事頁面
                        if (hasChapter) {
                          navigation.navigate(routes.HOME, {
                            screen: routes.CHAPTER,
                            params: {
                              name: main_menu_name,
                              author,
                              storyId: id,
                              storyData: { ...storyData, open: '公開' },
                            },
                          });
                        } else {
                          navigation.navigate(routes.HOME, {
                            screen: routes.STORY,
                            params: { ...storyPayload, storyData: { ...storyData, open: '公開' } },
                          });
                        }
                      },
                    },
                  ]
                );
              } else {
                // 購買失敗，保留 idempotencyKey 緩存，以便重試時使用同一個 key
                console.log('[Book] ⚠️ 購買失敗，保留 idempotencyKey 緩存以便重試');
                showAlert(translate('purchaseFailedTitle'), translate('purchaseFailedRetry'));
              }
            } catch (error) {
              // 發生錯誤，保留 idempotencyKey 緩存，以便重試時使用同一個 key
              console.error('[Book] ❌ 購買失敗:', error);
              console.log('[Book] ⚠️ 發生錯誤，保留 idempotencyKey 緩存以便重試');
              showAlert(translate('purchaseFailedTitle'), error?.message || translate('purchaseErrorGeneric'));
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container]}>

      <Pressable
        style={styles.container}
        onPress={async () => {
          // 未公開（鎖頭）：僅「一般入口」受限。「繼續觀看 / 再次回味」是已在書櫃中的書，
          // 永遠可進入、不受此閘門限制。
          //  - role >= 9（Admin）：可點擊預覽，有章節進章節列表、無章節進故事頁。
          //  - 其餘角色：跳出多語系 alert「敬請期待」，不進入。
          if (!isOpen && !showIcon && !showReviewIcon) {
            const roleLevel = await getEffectiveRoleLevel();
            if (!isAdmin(roleLevel)) {
              showAlert(translate('noticeTitle'), translate('comingSoon'));
              return;
            }
            if (hasChapter) {
              navigation.navigate(routes.HOME, {
                screen: routes.CHAPTER,
                params: {
                  name: main_menu_name,
                  author,
                  storyId: id,
                  storyData,
                  nochapter,
                },
              });
            } else {
              navigation.navigate(routes.HOME, {
                screen: routes.STORY,
                params: storyPayload,
              });
            }
            return;
          }

          if (showIcon) {
            // 繼續觀看：回到最後存檔的章節/場次/對話順序
            goToContinue();
          } else if (showReviewIcon) {
            // 再次回味
            if (hasChapter) {
              navigation.navigate(routes.HOME, {
                screen: routes.CHAPTER,
                params: {
                  name: main_menu_name,
                  author,
                  storyId: id,
                  storyData,
                },
              });
            } else {
              navigation.navigate(routes.HOME, {
                screen: routes.STORY,
                params: storyPayload,
              });
            }
          } else {
            // 一般選項：每次點擊都跳出簡介彈窗，讓使用者選擇。
            // - 重新閱讀（左）：goToStart，從頭開始（有章節會進章節選單頁）。
            // - 繼續閱讀（右）：前往繼續觀看清單頁（ContinueScreen）。
            // 主選單-防呆視窗：標題/內文/兩顆按鈕字樣來自 menu-foolproof 參數表
            // （menuFoolproofConfig，已於 HomeScreen 依語系挑列）。未設定的欄位自動略過、沿用預設。
            showAlert(
              main_menu_title,
              main_menu_content,
              [
                {
                  text: main_menu_btn_left,
                  onPress: goToStart,
                  textStyle: toAlertTextStyle(
                    menuFoolproofConfig?.menu_foolproof_stroy_item1_size,
                    menuFoolproofConfig?.menu_foolproof_stroy_item1_weight,
                    menuFoolproofConfig?.menu_foolproof_stroy_item1_color
                  ),
                },
                {
                  text: main_menu_btn_right || translate('ok'),
                  onPress: () => navigation.navigate(routes.CONTINUE),
                  textStyle: toAlertTextStyle(
                    menuFoolproofConfig?.menu_foolproof_stroy_item2_size,
                    menuFoolproofConfig?.menu_foolproof_stroy_item2_weight,
                    menuFoolproofConfig?.menu_foolproof_stroy_item2_color
                  ),
                },
              ],
              { cancelable: true },
              {
                titleStyle: toAlertTextStyle(
                  menuFoolproofConfig?.menu_foolproof_story_name_size,
                  menuFoolproofConfig?.menu_foolproof_story_name_weight,
                  menuFoolproofConfig?.menu_foolproof_story_name_color
                ),
                messageStyle: toAlertTextStyle(
                  menuFoolproofConfig?.menu_foolproof_stroy_information_size,
                  menuFoolproofConfig?.menu_foolproof_stroy_information_weight,
                  menuFoolproofConfig?.menu_foolproof_stroy_information_color
                ),
              }
            );
          }
        }}
      >
        {/* 以下保持原本 JSX */}
        {showIcon ? (
          // 繼續觀看
          <View>
            <Image
              style={styles.coverIcon}
              source={require('../../../assets/continue.png')}
            />
            <Image
              style={[styles.img, COVER_SIZE]}
              source={{
                uri: imageUri,
              }}
            />
          </View>
        ) : showReviewIcon ? (
          // 重新回味
          <View>
            <Image
              style={styles.coverIcon}
              source={require('../../../assets/reload.png')}
            />
            <Image
              style={[styles.img, COVER_SIZE]}
              source={{ uri: imageUri }}
            />
          </View>
        ) : (
          // 一般畫面
          <View>
            {!isOpen ? (
              <View style={styles.lock}>
                <Image
                  style={[styles.lockIcon, { width: LOCK_ICON_SIZE, height: LOCK_ICON_SIZE }]}
                  source={require('../../../assets/lock.png')}
                />
              </View>
            ) : null}

            <Image
              style={[styles.img, COVER_SIZE]}
              source={{ uri: imageUri }}
            />
            {storyStatus?.isNew ? (
              <Image
                style={[
                  styles.newIcon,
                  { position: 'absolute', top: -15, right: -10 },
                ]}
                source={require('../../../assets/new.png')}
              />
            ) : null}
          </View>
        )}
        <View style={[styles.nameContainer, { minHeight: nameBoxHeight, justifyContent: 'center' }]}>
          <AppText
            numberOfLines={NAME_MAX_LINES}
            style={[
              styles.name,
              {
                width: COVER_SIZE.width,
                fontSize: nameFontSize,
                lineHeight,
                includeFontPadding: false,
                textAlignVertical: 'center',
                color: main_menu_name_color || '#fff',
                ...(main_menu_name_weight === '粗' && {
                  fontWeight: Platform.OS === 'ios' ? 600 : 'bold',
                }),
              },
            ]}
          >
            {main_menu_name}
          </AppText>
        </View>
      </Pressable>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 5,
    marginVertical: 10,
  },
  nameContainer: {
    marginTop: 5,
    alignItems: 'center',
  },
  name: {
    color: colors.leftChatBackground,
    textAlign: 'center',
  },
  // 尺寸由 COVER_SIZE 決定（手機 / 平板），此處僅保留非尺寸樣式
  img: {},
  coverIcon: {
    position: 'absolute',
    zIndex: 1,
    marginLeft: 55,
    marginTop: 95,
    width: 35,
    height: 35,
  },
  lockIcon: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
  newIcon: {
    width: 30,
    height: 30,
  },
  lock: {
    position: 'absolute',
    zIndex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default Book;
