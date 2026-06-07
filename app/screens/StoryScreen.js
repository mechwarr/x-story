import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  FlatList,
  Pressable,
  ImageBackground,
  Platform,
  SafeAreaView,
  Modal,
  View,
  Text,
  Image,
  Alert,
} from 'react-native';
import axios from 'axios';
import colors from '../config/colors';
import routes from '../navigations/routes';
import Narrator from '../components/narrator/Narrator';
import StoryHeader from '../components/StoryHeader';
import Chat from '../components/chat/Chat';
import storage from '../storage/storage';
import { useRoute } from '@react-navigation/native';
import _ from 'lodash';
import apiclient from '../config/apiClient';
import { useGuardedNavigate } from '../../hooks/useGuardedNavigate';
import { purchaseStoryWithCoins, recordBookRead } from '../config/userApiClient';
import { getOrCreateIdempotencyKey, clearIdempotencyKey } from '../config/idempotencyKeyCache';
import { useCoins } from '../store/coinContext';
import { translate } from '../i18n/i18n';
import { syncPurchasedStoryIds } from '../services/bookAccessService';

const domain = apiclient.currentBaseUrl() + 'images/update/';
const initStoryIdx = null;

function StoryScreen({ route }) {
  const navigation = useGuardedNavigate();
  const router = useRoute();
  const {
    storyId = 1,
    chapterId,
    author = '',
    name = '',
    storyData,
    nochapter = [],
    cachedIndex = null,
    read_range_end,
    free_open,
  } = router.params ?? {};

  // 如果 cachedIndex.story 是 null，初始改成0，避免 FlatList 空白
  const initialStoryIndex = cachedIndex?.story === null ? 0 : cachedIndex?.story ?? initStoryIdx;

  const [index, setIndex] = useState({
    story: initialStoryIndex,
    screen: cachedIndex?.screen ?? 0,
  });

  const [story, setStory] = useState([]);
  const [queryInfo, setQueryInfo] = useState({
    config: [],
    screenings: {},
    content: null,
    role: {},
    imageUrl: '',
  });

  const flatlistRef = useRef(null);
  const choseRef = useRef(false);
  const hasRecordedReadRef = useRef(false);
  const [shouldScrollInit, setShouldScrollInit] = useState(false);
  const prevStoryLength = useRef(0);
  const [showPurchaseOverlay, setShowPurchaseOverlay] = useState(false);
  const [isBookPurchased, setIsBookPurchased] = useState(false);
  const { coins, refreshCoins } = useCoins();
  const priceCoins = storyData?.priceCoins ?? 0;

  const cacheData = useMemo(
    () => ({
      storyId,
      chapterId,
      storyData,
      read_range_end,
      nochapter,
      cachedIndex: {
        story: index.story,
        screen: index.screen,
      },
    }),
    [queryInfo.screenings, index, router.params]
  );

  const onPressOption = (idx) => {
    if (idx) {
      if (choseRef.current) return;

      let id = 0;
      queryInfo.content?.find((e, i) => {
        if (+e.order === +idx) id = i;
      });
      setIndex((prev) => ({
        ...prev,
        story: id,
      }));
      choseRef.current = true;
    } else {
      setIndex((prev) => ({
        ...prev,
        story: index.story === null ? 0 : index.story + 1,
      }));
    }
  };

  useEffect(() => {
    // 取得篩選內容
    const fetchStories = async () => {
      try {
        const _id = queryInfo.screenings?.[index.screen]?.id;
        if (_id) {
          const content = await axios.get(apiclient.currentBaseUrl() + `api/v1/admin/content/${storyId}/${chapterId}/${_id}`
          );
          if (content?.data?.length) {
            const storyContent = content.data.slice().sort((a, b) => a.order - b.order);
            setQueryInfo((prev) => ({
              ...prev,
              content: storyContent,
              imageUrl: domain + queryInfo.screenings?.[index.screen]?.bg_view,
            }));
            setStory([]); // 先清空舊資料
          }
        } else if (!_id && index.screen >= queryInfo.screenings.length) {
          // 免費章節滑到底：若未持有本書則顯示購買按鈕
          if (free_open === '開放' && !isBookPurchased) {
            setShowPurchaseOverlay(true);
            return;
          }
          if (storyData?.chapter_type === '章節') {
            navigation.navigate(routes.CHAPTER, { name, author, storyId, storyData });
          } else {
            storage.deleteStory({ storyId }, 'continueStory');
            storage.storeStory({ storyId, storyData, nochapter }, 'finishStory');
            navigation.navigate(routes.MAIN);
          }
        }
      } catch (error) {
        console.error('API 請求失敗：', error);
      }
    };

    if (queryInfo.screenings) fetchStories();
  }, [index.screen, queryInfo.screenings, free_open, isBookPurchased]);

  useEffect(() => {
    let mounted = true;
    syncPurchasedStoryIds().then((ids) => {
      if (mounted) setIsBookPurchased(ids.includes(Number(storyId)));
    });
    return () => { mounted = false; };
  }, [storyId]);

  const handlePurchaseStory = useCallback(() => {
    if (!storyId) {
      Alert.alert(translate('genericErrorTitle'), translate('storyIdNotFound'));
      return;
    }
    if (!priceCoins || priceCoins <= 0) {
      Alert.alert(translate('noticeTitle'), translate('storyNotPurchasable'));
      return;
    }
    if (coins < priceCoins) {
      Alert.alert(
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
    Alert.alert(
      translate('confirmPurchase'),
      translate('confirmPurchaseMessage', { price: priceCoins, name }),
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
                await syncPurchasedStoryIds();
                setIsBookPurchased(true);
                setShowPurchaseOverlay(false);
                Alert.alert(
                  translate('purchaseSuccessTitle'),
                  translate('purchaseSuccessMessage', { name, coins: result.coinsSpent || priceCoins }),
                  [
                    {
                      text: translate('ok'),
                      onPress: () => {
                        if (storyData?.chapter_type === '章節') {
                          navigation.navigate(routes.CHAPTER, { name, author, storyId, storyData });
                        } else {
                          storage.deleteStory({ storyId }, 'continueStory');
                          storage.storeStory({ storyId, storyData, nochapter }, 'finishStory');
                          navigation.navigate(routes.MAIN);
                        }
                      },
                    },
                  ]
                );
              } else {
                Alert.alert(translate('purchaseFailedTitle'), translate('purchaseFailedRetry'));
              }
            } catch (error) {
              console.error('[StoryScreen] 購買失敗:', error);
              Alert.alert(translate('purchaseFailedTitle'), error?.message || translate('purchaseErrorGeneric'));
            }
          },
        },
      ]
    );
  }, [storyId, priceCoins, coins, name, navigation, refreshCoins, storyData, author, nochapter]);

  // 進入場次、對話內容首次載入時寫入一次閱讀紀錄
  useEffect(() => {
    if (hasRecordedReadRef.current) return;
    if (!queryInfo.content?.length || !storyId) return;
    hasRecordedReadRef.current = true;
    recordBookRead(Number(storyId));
  }, [queryInfo.content, storyId]);

  // 內容或索引改變時，設定 story
  useEffect(() => {
    if (!queryInfo.content || index.story === null) return;

    if (queryInfo.content[index.story]?.contentPresent === '結尾') {
      setIndex((prev) => ({
        story: initStoryIdx,
        screen: prev.screen + 1,
      }));
      return;
    }

    if (shouldScrollInit) {
      // 初始化滾動：一次設定整段
      setStory(queryInfo.content.slice(0, index.story + 1));
      setShouldScrollInit(false);
    } else {
      // 用戶點擊逐段加入
      setStory((prev) => {
        const newItem = queryInfo.content[index.story];
        if (prev.length && prev[prev.length - 1]?.id === newItem?.id) return prev;
        return [...prev, newItem];
      });

      storage.storeStory(
        {
          ...cacheData,
          cachedIndex: {
            story: index.story,
            screen: index.screen,
          },
        },
        'continueStory'
      );
    }
  }, [index.story, queryInfo.content, cachedIndex?.story, shouldScrollInit]);

  // 滾動控制：初始化或用戶新增故事後滾動
  useEffect(() => {
    if (shouldScrollInit) {
      setTimeout(() => {
        if (flatlistRef.current && story.length > 0) {
          flatlistRef.current.scrollToIndex({
            index: index.story >= 0 ? index.story : 0,
            animated: true,
            viewPosition: 0,
          });
          console.log('初始化滾動到 index:', index.story);
        }
        setShouldScrollInit(false);
      }, 200);
    } else if (story.length > prevStoryLength.current) {
      setTimeout(() => {
        if (flatlistRef.current) {
          flatlistRef.current.scrollToIndex({
            index: story.length - 1,
            animated: true,
            viewPosition: 0.5,
          });
          console.log('用戶點擊新增，自動滾動到 index:', story.length - 1);
        }
      }, 200);
    }
    prevStoryLength.current = story.length;
  }, [story, shouldScrollInit]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const URL = apiclient.currentBaseUrl();
        const config = await axios.get(URL + `api/v1/admin/setup-story-list`);
        const screenings = await axios.get(URL + `api/v1/admin/screenings/${storyId}/${chapterId}`);
        const role = await axios.get(URL + `api/v1/admin/role`);
        const roleConf = await axios.get(URL + `api/v1/admin/setup-story-role`);

        const screenData = screenings?.data?.[cachedIndex?.screen ?? 0];

        setQueryInfo({
          config: config?.data[0] ?? {},
          screenings: read_range_end ? screenings?.data.slice(0, +read_range_end) : screenings?.data ?? [],
          role: role?.data ?? {},
          imageUrl: domain + screenData?.bg_view,
          roleConf: roleConf?.data?.[0],
        });
      } catch (error) {
        console.error('API 請求失敗：', error);
      }
    };

    if (cachedIndex) setShouldScrollInit(true);
    fetchData();

    setIndex({
      story: initialStoryIndex,
      screen: cachedIndex?.screen ?? 0,
    });
  }, [read_range_end]);

  return (
    <ImageBackground
      fadeDuration={2000}
      style={[styles.container]}
      resizeMode="cover"
      source={
        queryInfo?.imageUrl
          ? {
              uri: queryInfo.imageUrl,
            }
          : null
      }
    >
      <SafeAreaView style={{ flex: 1, position: 'relative' }}>
        <StoryHeader storyName={name} author={author} config={queryInfo.config} />
        <Pressable
          onPress={_.debounce(() => onPressOption(null), 200)}
          style={{ flex: 1 }}
        >
          <FlatList
            data={story}
            ref={flatlistRef}
            keyExtractor={(item, index) => index.toString()}
            scrollEnabled
            showsVerticalScrollIndicator={false}
            onScrollToIndexFailed={({ index }) => {
              setTimeout(() => {
                flatlistRef.current?.scrollToIndex({
                  index,
                  animated: true,
                  viewPosition: 0.5,
                });
              }, 0);
            }}
            renderItem={({ item, index }) =>
              item?.contentPresent === '對話' ? (
                <Chat
                  {...item}
                  textMsg={item.textContent}
                  imgMsg={item.graphy}
                  soundMsg={item.voice}
                  videoMsg={item.video}
                  roleList={queryInfo.role}
                  onPressOption={onPressOption}
                  index={index}
                  roleConf={queryInfo.roleConf}
                />
              ) : (
                <Narrator
                  {...item}
                  textMsg={item.textContent}
                  imgMsg={item.graphy}
                  soundMsg={item.voice}
                  videoMsg={item.video}
                  videoDirection={item.videoFormat}
                  index={index}
                  onPressOption={onPressOption}
                  choseRef={choseRef}
                />
              )
            }
          />
        </Pressable>

        <Modal
          visible={showPurchaseOverlay}
          transparent
          animationType="fade"
          onRequestClose={() => setShowPurchaseOverlay(false)}
        >
          <Pressable
            style={styles.overlay}
            onPress={() => setShowPurchaseOverlay(false)}
          >
            <Pressable style={styles.overlayContent} onPress={(e) => e.stopPropagation()}>
              <View style={styles.purchaseButtonWrap}>
                <Pressable style={styles.purchaseButton} onPress={handlePurchaseStory}>
                  <View style={styles.purchaseButtonRow}>
                    <Text style={styles.purchaseButtonText}>
                      {translate('purchase')}
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
                onPress={() => setShowPurchaseOverlay(false)}
              >
                <Text style={styles.closeOverlayButtonText}>關閉</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 10 : 20,
    paddingBottom: 20,
    backgroundColor: colors.dark,
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

export default StoryScreen;
