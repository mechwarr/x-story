import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Image,
  Dimensions,
  Alert,
  Platform,
} from 'react-native';
import routes from '../../navigations/routes';
import AppText from '../AppText';
import colors from '../../config/colors';
import apiclient  from '../../config/apiClient';
import { isTabletWidth } from '../../config/responsive';
import { useGuardedNavigate } from '../../../hooks/useGuardedNavigate';
import { purchaseStoryWithCoins } from '../../config/userApiClient';
import { getOrCreateIdempotencyKey, clearIdempotencyKey } from '../../config/idempotencyKeyCache';
import { useCoins } from '../../store/coinContext';
import storage from '../../storage/storage';

const screenWidth = Dimensions.get('window').width;
const isTablet = isTabletWidth(screenWidth);

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

  const padImgStyle = isTablet ? { width: 225, height: 330 } : {};

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
  };

  // 處理購買故事
  const handlePurchaseStory = async () => {
    if (!id) {
      Alert.alert('錯誤', '找不到故事 ID');
      return;
    }

    // 檢查是否有價格資訊
    if (!priceCoins || priceCoins <= 0) {
      Alert.alert('提示', '此故事無法購買');
      return;
    }

    // 檢查金幣餘額
    if (coins < priceCoins) {
      Alert.alert(
        '金幣不足',
        `此故事需要 ${priceCoins} 金幣，您目前有 ${coins} 金幣。\n請前往商城購買更多金幣。`,
        [
          { text: '取消', style: 'cancel' },
          {
            text: '前往商城',
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
    Alert.alert(
      '確認購買',
      `確定要使用 ${priceCoins} 金幣購買「${main_menu_name}」嗎？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '確認購買',
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
                
                Alert.alert(
                  '購買成功',
                  `您已成功購買「${main_menu_name}」！\n\n花費 ${result.coinsSpent || priceCoins} 金幣`,
                  [
                    {
                      text: '確定',
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
                Alert.alert('購買失敗', '請稍後再試');
              }
            } catch (error) {
              // 發生錯誤，保留 idempotencyKey 緩存，以便重試時使用同一個 key
              console.error('[Book] ❌ 購買失敗:', error);
              console.log('[Book] ⚠️ 發生錯誤，保留 idempotencyKey 緩存以便重試');
              Alert.alert('購買失敗', error?.message || '發生錯誤，請稍後再試');
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
        onPress={() => {
          // 未擁有（鎖頭）：僅允許有章節的書進入章節列表（顯示購買按鈕），無章節則不反應
          if (!isOpen) {
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
            }
            return;
          }

          if (showIcon) {
            // 繼續觀看
            navigation.navigate(routes.HOME, {
              screen: routes.STORY,
              params: {
                ...props,
                ...storyPayload,
              },
            });
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
            // 一般 Alert 選項
            Alert.alert(
              main_menu_title,
              main_menu_content,
              [
                {
                  text: main_menu_btn_left,
                  onPress: () => {
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
                  },
                },
                {
                  text: main_menu_btn_right,
                  onPress: () => {
                    navigation.navigate(routes.CONTINUE);
                  },
                },
              ],
              {
                cancelable: true,
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
              style={[styles.img, padImgStyle]}
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
              style={[styles.img, padImgStyle]}
              source={{ uri: imageUri }}
            />
          </View>
        ) : (
          // 一般畫面
          <View>
            {!isOpen ? (
              <View style={styles.lock}>
                <Image
                  style={styles.lockIcon}
                  source={require('../../../assets/lock.png')}
                />
              </View>
            ) : null}

            <Image
              style={[styles.img, padImgStyle]}
              source={{ uri: imageUri }}
            />
            {index === 0 && storyStatus?.isNew ? (
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
        <View style={styles.nameContainer}>
          <AppText
            numberOfLines={1}
            style={[
              styles.name,
              {
                fontSize: main_menu_name_size || 15,
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
    fontSize: 20,
    color: colors.leftChatBackground,
    width: 150,
    textAlign: 'center',
  },
  img: {
    width: 150,
    height: 220,
  },
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
