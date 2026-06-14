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
} from 'react-native';
import { showAlert } from "../components/CustomAlert";
import axios from 'axios';
import colors from '../config/colors';
import routes from '../navigations/routes';
import Narrator from '../components/narrator/Narrator';
import StoryHeader from '../components/StoryHeader';
import ScreeningSwitcher from '../components/ScreeningSwitcher';
import Chat from '../components/chat/Chat';
import storage from '../storage/storage';
import { useRoute, useNavigation } from '@react-navigation/native';
import _ from 'lodash';
import apiclient from '../config/apiClient';
import { useGuardedNavigate } from '../../hooks/useGuardedNavigate';
import { purchaseStoryWithCoins, recordBookRead, getEffectiveRoleLevel } from '../config/userApiClient';
import { canSwitchScreening } from '../config/roles';
import { getOrCreateIdempotencyKey, clearIdempotencyKey } from '../config/idempotencyKeyCache';
import { useCoins } from '../store/coinContext';
import { translate, matchesCurrentStoryLang } from '../i18n/i18n';
import { syncPurchasedStoryIds, canAccessChapter } from '../services/bookAccessService';
import useResponsive from '../hook/useResponsive';

const domain = apiclient.currentBaseUrl() + 'images/update/';
const initStoryIdx = null;

function StoryScreen({ route }) {
  const navigation = useGuardedNavigate();
  // 自動續章用：useGuardedNavigate 只提供 navigate，章節接續需要 replace（原地重掛
  // StoryScreen、不堆疊返回鍵），因此另取原生 navigation 物件。
  const rawNavigation = useNavigation();
  const router = useRoute();
  const { ms } = useResponsive();
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
    screenings: null, // null = 尚未載入；[] = 載入後確實沒有場次（兩者需區分，避免誤判為「已播完」而彈回章節）
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
  const [purchaseChecked, setPurchaseChecked] = useState(false);
  const { coins, refreshCoins } = useCoins();
  const priceCoins = storyData?.priceCoins ?? 0;

  // 場次快速切換器：取得使用者權限級別（role >= 6 才顯示）
  const [roleLevel, setRoleLevel] = useState(0);
  useEffect(() => {
    let mounted = true;
    getEffectiveRoleLevel().then((lv) => { if (mounted) setRoleLevel(lv); });
    return () => { mounted = false; };
  }, []);

  const screeningList = Array.isArray(queryInfo.screenings) ? queryInfo.screenings : [];

  // 章節清單（與章節選單同一來源、同樣以目前語系過濾並維持相同排序），
  // 供「本章播畢自動接續下一章」判斷下一章 id 與其試閱設定使用。
  // 用 ref 保存最新清單：避免把它列入「播畢判斷 effect」的依賴，否則清單於閱讀途中
  // 載入完成會觸發 effect 重跑、重抓當前場次並清空畫面（setStory([])）造成閃動。
  const chapterListRef = useRef([]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await axios.get(
          apiclient.currentBaseUrl() + `api/v1/admin/chapter/${storyId}`
        );
        const list = (Array.isArray(res?.data) ? res.data : []).filter((c) =>
          matchesCurrentStoryLang(c?.lang)
        );
        if (mounted) chapterListRef.current = list;
      } catch (error) {
        console.error('章節清單載入失敗：', error);
      }
    })();
    return () => { mounted = false; };
  }, [storyId]);

  // 依目前 chapterId 在（語系過濾後的）章節清單中找出下一章；沒有則回傳 null（代表整本已讀完）。
  const getNextChapter = useCallback(() => {
    const list = chapterListRef.current;
    if (!list.length) return null;
    const idx = list.findIndex((c) => String(c?.id) === String(chapterId));
    if (idx < 0 || idx + 1 >= list.length) return null;
    return list[idx + 1];
  }, [chapterId]);

  // 跳到指定場次（複用既有「story:null → 重抓內容」機制）
  const goToScreening = useCallback(
    (targetScreen) => {
      if (targetScreen < 0 || targetScreen >= screeningList.length) return;
      if (targetScreen === index.screen) return;
      choseRef.current = false;
      hasRecordedReadRef.current = false; // 換場次重新計一次閱讀
      setStory([]);
      setIndex({ story: initStoryIdx, screen: targetScreen });
    },
    [index.screen, screeningList.length]
  );

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
        const screenings = Array.isArray(queryInfo.screenings) ? queryInfo.screenings : [];
        const _id = screenings[index.screen]?.id;
        if (_id) {
          const content = await axios.get(apiclient.currentBaseUrl() + `api/v1/admin/content/${storyId}/${chapterId}/${_id}`
          );
          if (content?.data?.length) {
            const storyContent = content.data.slice().sort((a, b) => a.order - b.order);
            setQueryInfo((prev) => ({
              ...prev,
              content: storyContent,
              imageUrl: domain + screenings[index.screen]?.bg_view,
            }));
            setStory([]); // 先清空舊資料
          }
        } else if (screenings.length > 0 && index.screen >= screenings.length) {
          // 場次清單已載入且確實播完（screen 超過尾端）才返回；
          // 空清單（length === 0，可能是設定問題）不在此彈回，避免一進章節就被踢出

          // 1) 試閱播畢：未持有本書且為試閱（開放）章節 → 此處場次已被 read_range_end 截斷，
          //    代表已到「試閱的最後內容」，跳出購買提示（優先於自動續章）。
          if (free_open === '開放' && !isBookPurchased) {
            setShowPurchaseOverlay(true);
            return;
          }

          // 2) 章節型書籍：本章播畢後若仍有「可閱讀」的下一章，原地接續到下一章第一場次。
          if (storyData?.chapter_type === '章節') {
            const nextChapter = getNextChapter();
            const nextAccessible =
              nextChapter &&
              canAccessChapter({
                freeOpen: nextChapter.free_open,
                isBookPurchased,
              });
            if (nextAccessible) {
              // 換章前清掉本章的「繼續觀看」快取，避免下次回來停在舊章節尾端。
              storage.deleteStory({ storyId }, 'continueStory');
              // replace：原地重掛 StoryScreen（不帶 cachedIndex → 從新章第一場次開始），
              // 並帶入下一章自己的試閱設定（free_open / read_range_end）。
              rawNavigation.replace(routes.STORY, {
                storyId,
                chapterId: nextChapter.id,
                name,
                author,
                storyData,
                nochapter,
                read_range_end: nextChapter.read_range_end,
                free_open: nextChapter.free_open,
              });
              return;
            }
          }

          // 3) 整本書已讀完（非章節型書籍，或章節型已無下一章）→ 標記完成並回首頁（HomeScreen）。
          storage.deleteStory({ storyId }, 'continueStory');
          storage.storeStory({ storyId, storyData, nochapter }, 'finishStory');
          navigation.navigate(routes.MAIN);
        }
      } catch (error) {
        console.error('API 請求失敗：', error);
      }
    };

    if (Array.isArray(queryInfo.screenings)) fetchStories();
  }, [index.screen, queryInfo.screenings, free_open, isBookPurchased]);

  useEffect(() => {
    let mounted = true;
    syncPurchasedStoryIds().then((ids) => {
      if (mounted) {
        setIsBookPurchased(ids.includes(Number(storyId)));
        setPurchaseChecked(true);
      }
    });
    return () => { mounted = false; };
  }, [storyId]);

  // 安全網：非章節選單入口（如「繼續觀看」）進入試閱章節時，
  // 若後端「試閱場次範圍(尾)」(read_range_end) 為 0／非正數，代表沒有設定試閱長度 → 警告並返回。
  // 章節選單入口已在 ChapterItem 先攔截，購買後則為完整內容、不受此限。
  useEffect(() => {
    if (!purchaseChecked) return;
    if (free_open !== '開放' || isBookPurchased) return;
    const n = Number(read_range_end);
    if (!Number.isFinite(n) || n > 0) return;
    showAlert(translate('noticeTitle'), translate('trialRangeNotSet'), [
      {
        text: translate('ok'),
        onPress: () => {
          if (storyData?.chapter_type === '章節') {
            navigation.navigate(routes.CHAPTER, { name, author, storyId, storyData });
          } else {
            navigation.navigate(routes.MAIN);
          }
        },
      },
    ]);
  }, [purchaseChecked, isBookPurchased, free_open, read_range_end]);

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
                showAlert(
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
                showAlert(translate('purchaseFailedTitle'), translate('purchaseFailedRetry'));
              }
            } catch (error) {
              console.error('[StoryScreen] 購買失敗:', error);
              showAlert(translate('purchaseFailedTitle'), error?.message || translate('purchaseErrorGeneric'));
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
          // 夾住索引，避免 cachedIndex.story 大於實際內容數時 scrollToIndex 越界、無限重試卡死
          const safeIndex = Math.min(Math.max(index.story ?? 0, 0), story.length - 1);
          flatlistRef.current.scrollToIndex({
            index: safeIndex,
            animated: true,
            viewPosition: 0,
          });
          console.log('初始化滾動到 index:', safeIndex);
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
    // 等購買狀態確認(purchaseChecked)後再抓場次：否則會先以「未購買」截斷試閱長度，
    // 待購買狀態回來再重抓並重設索引，造成已購買者畫面閃動／被截斷。
    if (!purchaseChecked) return;

    const fetchData = async () => {
      try {
        const URL = apiclient.currentBaseUrl();
        const config = await axios.get(URL + `api/v1/admin/setup-story-list`);
        const screenings = await axios.get(URL + `api/v1/admin/screenings/${storyId}/${chapterId}`);
        const role = await axios.get(URL + `api/v1/admin/role`);
        const roleConf = await axios.get(URL + `api/v1/admin/setup-story-role`);

        const rawScreenings = Array.isArray(screenings?.data) ? screenings.data : [];
        // 僅「試閱中且未購買」才依 read_range_end（試閱場次範圍尾）截斷；
        // 已購買或非試閱書應看到完整場次。先確保是陣列再 slice，避免 undefined.slice() 例外。
        // 註：isBookPurchased/free_open 刻意改由 closure 讀取、不列入 deps，避免使用者於覆蓋層
        //     購買後 isBookPurchased 變動觸發本 effect 重抓、把閱讀索引重設回開頭。
        const shouldTrim = read_range_end && free_open === '開放' && !isBookPurchased;
        const screeningsList = shouldTrim
          ? rawScreenings.slice(0, +read_range_end)
          : rawScreenings;
        // 夾住還原的場次索引，避免快取 screen 超過（伺服器更新或試閱截斷後）現有場次數而立即彈回
        const safeScreen = screeningsList.length
          ? Math.min(Math.max(cachedIndex?.screen ?? 0, 0), screeningsList.length - 1)
          : 0;
        const screenData = screeningsList[safeScreen];

        setQueryInfo({
          config: config?.data?.[0] ?? {},
          screenings: screeningsList,
          role: role?.data ?? {},
          imageUrl: domain + screenData?.bg_view,
          roleConf: roleConf?.data?.[0],
        });

        setIndex({
          story: initialStoryIndex,
          screen: safeScreen,
        });
      } catch (error) {
        console.error('API 請求失敗：', error);
      }
    };

    if (cachedIndex) setShouldScrollInit(true);
    fetchData();
  }, [read_range_end, purchaseChecked]);

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
        {canSwitchScreening(roleLevel) && screeningList.length > 0 && (
          <ScreeningSwitcher
            sessions={screeningList}
            currentIndex={index.screen}
            onSelect={goToScreening}
          />
        )}
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
              // 夾住到目前資料範圍內，避免用越界索引一再重試而卡死
              const safeIndex = Math.min(Math.max(index, 0), story.length - 1);
              if (safeIndex < 0) return;
              setTimeout(() => {
                flatlistRef.current?.scrollToIndex({
                  index: safeIndex,
                  animated: true,
                  viewPosition: 0.5,
                });
              }, 50);
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
                    <Text style={[styles.purchaseButtonText, { fontSize: ms(24) }]}>
                      {translate('unlock')}
                    </Text>
                    <Image
                      style={[styles.purchaseButtonCoin, { width: ms(27), height: ms(27) }]}
                      source={require('../../assets/coin.png')}
                    />
                    <Text style={[styles.purchaseButtonText, { fontSize: ms(24) }]}>{priceCoins}</Text>
                  </View>
                </Pressable>
              </View>
              <Pressable
                style={styles.closeOverlayButton}
                onPress={() => setShowPurchaseOverlay(false)}
              >
                <Text style={[styles.closeOverlayButtonText, { fontSize: ms(16) }]}>{translate('close')}</Text>
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
