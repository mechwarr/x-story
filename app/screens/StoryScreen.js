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
  AppState,
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
import Storage, { DEFAULT_AUTO_PLAY_SECONDS } from '../auth/Storage';
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
    // 跨場次／跨章節跳轉的落點：由 onPressOption 透過 replace 帶入，
    // 待新章節/場次內容載入後，於 fetchData / 內容 effect 中定位。
    targetScreeningId = null,
    targetDialogId = null,
  } = router.params ?? {};

  // 如果 cachedIndex.story 是 null，初始改成0，避免 FlatList 空白
  const initialStoryIndex = cachedIndex?.story === null ? 0 : cachedIndex?.story ?? initStoryIdx;

  // 【診斷】進入畫面時收到的 cachedIndex（確認 path / scrollOffset 是否被帶進來）
  console.log('[紀錄診斷] 進入 cachedIndex =', cachedIndex == null ? null : {
    story: cachedIndex.story,
    screen: cachedIndex.screen,
    scrollOffset: cachedIndex.scrollOffset,
    pathLen: Array.isArray(cachedIndex.path) ? cachedIndex.path.length : '(無 path 欄位)',
  });

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
  // 換場次／換章後「待定位」的對話 order：因新內容尚未載入，無法立即換算成陣列 index，
  // 暫存於此，待 queryInfo.content 載入完成後於內容 effect 中消化。
  const pendingDialogRef = useRef(null);
  // 因目標章節/場次未解鎖而被擋下、待「購買成功」後才執行的跳轉目標
  // （{ chapterId, screeningId, dialogId }）。
  const pendingJumpRef = useRef(null);
  const hasRecordedReadRef = useRef(false);
  const prevStoryLength = useRef(0);
  const [showPurchaseOverlay, setShowPurchaseOverlay] = useState(false);
  const [isBookPurchased, setIsBookPurchased] = useState(false);
  const [purchaseChecked, setPurchaseChecked] = useState(false);
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  // 自動播放每段間隔秒數，可於「設定」頁調整（最低 1 秒），進入劇情時載入
  const [autoPlaySeconds, setAutoPlaySeconds] = useState(DEFAULT_AUTO_PLAY_SECONDS);
  useEffect(() => {
    let mounted = true;
    Storage.getAutoPlaySeconds().then((s) => { if (mounted) setAutoPlaySeconds(s); });
    return () => { mounted = false; };
  }, []);
  const { coins, refreshCoins } = useCoins();
  const priceCoins = storyData?.priceCoins ?? 0;

  // 場次快速切換器：取得使用者權限級別（role >= 9 才顯示）
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
      scrollOffsetRef.current = 0; // 換場次重置捲動基準，避免沿用上一場次的 offset
      setStory([]);
      setIndex({ story: initStoryIdx, screen: targetScreen });
    },
    [index.screen, screeningList.length]
  );

  // 以 replace 重掛 StoryScreen 跳到指定章節/場次/對話：帶入目標場次(.id)/對話(order)，
  // 由新一輪 fetchData / 內容 effect 的「落點定位」機制接手定位。
  // 跨章節與「購買解鎖後接續」皆共用此入口；目標章節若等於本章亦可（用於同章換場次後續）。
  const jumpTo = useCallback(
    ({ chapterId: targetChapterId, screeningId, dialogId }) => {
      const targetCh = chapterListRef.current.find(
        (c) => String(c?.id) === String(targetChapterId)
      );
      // 換章/換場次前清掉本章「繼續觀看」快取，避免下次回來停在舊位置。
      skipPersistRef.current = true; // 抑制離開保底存檔，避免把剛刪掉的進度又寫回
      storage.deleteStory({ storyId }, 'continueStory');
      rawNavigation.replace(routes.STORY, {
        storyId,
        chapterId: targetChapterId,
        name,
        author,
        storyData,
        nochapter,
        // 解鎖後重掛時，isBookPurchased 已為 true，fetchData 會取得未截斷的完整場次。
        read_range_end: targetCh?.read_range_end ?? read_range_end,
        free_open: targetCh?.free_open ?? free_open,
        targetScreeningId: screeningId,
        targetDialogId: dialogId,
      });
    },
    [storyId, name, author, storyData, nochapter, read_range_end, free_open, rawNavigation]
  );

  const cacheData = useMemo(
    () => ({
      storyId,
      chapterId,
      storyData,
      read_range_end,
      // 連同試閱旗標一起存檔：從「繼續觀看」回來時才能還原當時的試閱／購買閘門
      // （否則 free_open 遺失，章節型書籍恢復時會誤判試閱範圍）。
      free_open,
      nochapter,
      cachedIndex: {
        story: index.story,
        screen: index.screen,
      },
    }),
    [queryInfo.screenings, index, router.params]
  );

  // 目前的捲動位置（contentOffset.y）：由 FlatList onScroll 即時寫入 ref，
  // 避免高頻捲動觸發 re-render；存檔時一併寫入，回來可還原到當下捲動處。
  const scrollOffsetRef = useRef(cachedIndex?.scrollOffset ?? 0);
  // 本章已結束 / 已換章（這些流程會 deleteStory('continueStory')）→ 設為 true，
  // 避免「離開畫面 / 進背景」的保底存檔把剛刪掉的進度又寫回去。
  const skipPersistRef = useRef(false);
  // story 的鏡像 ref：讓存檔（含保底存檔）能讀到最新「造訪路徑」而不受 setState 非同步影響。
  const storyRef = useRef([]);

  // 進入畫面時的「待還原」資料：依存檔的造訪路徑（path＝使用者實際看過的對話 order 序列，
  // 含分歧選擇）＋捲動位置，於落點場次內容載入後一次性還原。只消費一次。
  const restoreRef = useRef(
    cachedIndex
      ? {
          path: Array.isArray(cachedIndex.path) ? cachedIndex.path : null,
          scrollOffset: cachedIndex.scrollOffset ?? 0,
        }
      : null
  );
  // 待還原的捲動位置：非 null 時，捲動 effect 會把列表定位到此 offset（還原劇情後的捲動落點）。
  const [pendingScrollOffset, setPendingScrollOffset] = useState(null);

  // 組出存檔 payload：一律帶上最新的 story / screen / scrollOffset，並把目前已造訪的
  // 對話 order 序列存成 path（含分歧選擇），回來才能重建使用者實際看過的劇情。
  const buildPayload = useCallback(
    () => ({
      ...cacheData,
      cachedIndex: {
        story: index.story,
        screen: index.screen,
        scrollOffset: scrollOffsetRef.current,
        path: storyRef.current.map((it) => it?.order).filter((o) => o != null),
      },
    }),
    [cacheData, index.story, index.screen]
  );

  // 統一的「繼續觀看」進度存檔。story 為 null（尚未讀任一段）時不存。
  const persistProgress = useCallback(() => {
    if (skipPersistRef.current) return;
    if (index.story === null) return;
    storage.storeStory(buildPayload(), 'continueStory');
  }, [buildPayload, index.story]);

  // 讓 AppState / 離開畫面的監聽器持有穩定參考，又能讀到最新的 persistProgress。
  const persistProgressRef = useRef(persistProgress);
  persistProgressRef.current = persistProgress;

  // 保底存檔：「翻頁即存」無法涵蓋「只捲動沒翻頁」「剛跨場次就離開」「被系統殺掉」等情形，
  // 故於 App 進背景與離開本畫面（返回鍵 / 卸載）時，各補一次以最新位置（含捲動）寫入。
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background' || next === 'inactive') {
        persistProgressRef.current();
      }
    });
    const unsubBeforeRemove = rawNavigation.addListener('beforeRemove', () => {
      persistProgressRef.current();
    });
    return () => {
      sub.remove();
      unsubBeforeRemove();
      persistProgressRef.current();
    };
  }, [rawNavigation]);

  // 在「目前已載入的內容」中，把對話 order 換算成陣列 index 並定位、鎖定選項。
  const goToDialog = (dialogId) => {
    if (!queryInfo.content?.length) return;
    let id = -1;
    queryInfo.content.some((e, i) => {
      if (+e.order === +dialogId) {
        id = i;
        return true; // 找到即停（取代舊版 find 當 forEach 用、不中斷的寫法）
      }
      return false;
    });
    if (id < 0) {
      console.warn('[onPressOption] 找不到對話 order：', dialogId);
      return;
    }
    setIndex((prev) => ({ ...prev, story: id }));
    choseRef.current = true;
  };

  // idx 可能是：
  //   "對話"            → 同章同場次，僅切換對話
  //   "場次:對話"        → 同章換場次，再定位對話
  //   "章節:場次:對話"   → 跨章節（replace 重掛），再定位場次/對話
  // 不帶 idx（null/空字串）→ 點畫面任意處推進到下一段
  const onPressOption = (idx) => {
    if (idx === null || idx === undefined || idx === '') {
      // 點畫面推進：若目前是「選項段」卻未點任何選項就點畫面 → 預設選第一個選項。
      const current = index.story != null ? queryInfo.content?.[index.story] : null;
      const firstNext = current?.choice1Content ? current?.choice1Next : null;
      if (firstNext != null && firstNext !== '') {
        onPressOption(firstNext); // 當作選擇第一個選項，走下方選項跳轉邏輯
        return;
      }
      setIndex((prev) => ({
        ...prev,
        story: prev.story === null ? 0 : prev.story + 1,
      }));
      return;
    }

    if (choseRef.current) return;

    const parts = String(idx).split(':').map((s) => s.trim());
    let chapterPart = null;
    let screeningPart = null;
    let dialogPart = null;
    if (parts.length >= 3) {
      [chapterPart, screeningPart, dialogPart] = parts;
    } else if (parts.length === 2) {
      [screeningPart, dialogPart] = parts;
    } else {
      [dialogPart] = parts;
    }

    // 1) 跨章節：以 replace 重掛 StoryScreen，並帶入目標場次/對話待新章載入後定位。
    if (chapterPart != null && String(chapterPart) !== String(chapterId)) {
      const target = chapterListRef.current.find(
        (c) => String(c?.id) === String(chapterPart)
      );
      if (!target) {
        console.warn('[onPressOption] 找不到章節 id：', chapterPart);
        return;
      }
      // 目標章節不可閱讀（試閱外且未購買）→ 暫存跳轉目標、跳購買提示；購買成功後再續。
      if (!canAccessChapter({ freeOpen: target.free_open, isBookPurchased })) {
        pendingJumpRef.current = {
          chapterId: target.id,
          screeningId: screeningPart,
          dialogId: dialogPart,
        };
        setShowPurchaseOverlay(true);
        return;
      }
      choseRef.current = true;
      jumpTo({ chapterId: target.id, screeningId: screeningPart, dialogId: dialogPart });
      return;
    }

    // 2) 同章換場次（含「章節:場次:對話」但章節為本章的情形）。
    if (screeningPart != null) {
      const targetScreen = screeningList.findIndex(
        (s) => String(s?.id) === String(screeningPart)
      );
      if (targetScreen < 0) {
        // 試閱未購買時，找不到多半是該場次被 read_range_end 截斷在試閱範圍外
        // → 暫存跳轉目標、跳購買提示；購買成功後重掛取得完整場次再續。
        if (free_open === '開放' && !isBookPurchased) {
          pendingJumpRef.current = {
            chapterId,
            screeningId: screeningPart,
            dialogId: dialogPart,
          };
          setShowPurchaseOverlay(true);
          return;
        }
        console.warn('[onPressOption] 找不到場次 id：', screeningPart);
        return;
      }
      if (targetScreen === index.screen) {
        // 已在目標場次 → 僅切換對話，毋須重抓內容。
        goToDialog(dialogPart);
        return;
      }
      pendingDialogRef.current = dialogPart; // 待新場次內容載入後定位
      choseRef.current = true;
      hasRecordedReadRef.current = false;    // 換場次重新計一次閱讀
      scrollOffsetRef.current = 0;            // 換場次重置捲動基準，避免沿用上一場次的 offset
      setStory([]);
      setIndex({ story: initStoryIdx, screen: targetScreen });
      return;
    }

    // 3) 同章同場次：僅切換對話。
    goToDialog(dialogPart);
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
              skipPersistRef.current = true; // 抑制離開保底存檔，避免把剛刪掉的進度又寫回
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
          skipPersistRef.current = true; // 抑制離開保底存檔，避免把剛刪掉的進度又寫回
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

  // 關閉購買覆蓋層：一併清掉「待購買後跳轉」目標，避免之後（如試閱播畢）再次購買時誤跳。
  const dismissPurchaseOverlay = useCallback(() => {
    pendingJumpRef.current = null;
    setShowPurchaseOverlay(false);
  }, []);

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
                        // 若購買是由選項跳轉被擋下觸發的 → 接續到原本要去的章節/場次/對話。
                        if (pendingJumpRef.current) {
                          const jump = pendingJumpRef.current;
                          pendingJumpRef.current = null;
                          jumpTo(jump);
                          return;
                        }
                        if (storyData?.chapter_type === '章節') {
                          navigation.navigate(routes.CHAPTER, { name, author, storyId, storyData });
                        } else {
                          skipPersistRef.current = true; // 抑制離開保底存檔，避免把剛刪掉的進度又寫回
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
  }, [storyId, priceCoins, coins, name, navigation, refreshCoins, storyData, author, nochapter, jumpTo]);

  // 進入場次、對話內容首次載入時寫入一次閱讀紀錄
  useEffect(() => {
    if (hasRecordedReadRef.current) return;
    if (!queryInfo.content?.length || !storyId) return;
    hasRecordedReadRef.current = true;
    recordBookRead(Number(storyId));
  }, [queryInfo.content, storyId]);

  // 內容或索引改變時，設定 story
  useEffect(() => {
    if (!queryInfo.content) return;

    // 換場次／換章後內容載入完成 → 消化「待定位」對話：把 order 換算成陣列 index。
    if (pendingDialogRef.current != null) {
      const dialogId = pendingDialogRef.current;
      pendingDialogRef.current = null;
      let id = -1;
      queryInfo.content.some((e, i) => {
        if (+e.order === +dialogId) {
          id = i;
          return true;
        }
        return false;
      });
      if (id >= 0) {
        choseRef.current = true;
        setIndex((prev) => ({ ...prev, story: id })); // 觸發本 effect 再跑一次走 append
      } else {
        console.warn('[onPressOption] 換場次後找不到對話 order：', dialogId);
      }
      return;
    }

    if (index.story === null) {
      if (restoreRef.current) {
        console.log('[紀錄診斷] 還原被擋：index.story 為 null（cachedIndex.story 無效），無法重建劇情');
      }
      return;
    }

    if (queryInfo.content[index.story]?.contentPresent === '結尾') {
      // 跨場次：補存「下一場起點」，避免剛推進到新場次、還沒點下一句就離開時退回上一場。
      // （此處 setIndex 會把 story 重設為 null，之後的「翻頁即存」要等使用者在新場次點一下才會觸發。）
      if (!skipPersistRef.current) {
        storage.storeStory(
          {
            ...cacheData,
            cachedIndex: {
              story: 0,
              screen: index.screen + 1,
              scrollOffset: 0,
              path: [], // 新場次尚未造訪任何對話，回來時退回線性還原至第一段
            },
          },
          'continueStory'
        );
      }
      scrollOffsetRef.current = 0; // 進入新場次從頂端起算，避免沿用上一場次的 offset
      setIndex((prev) => ({
        story: initStoryIdx,
        screen: prev.screen + 1,
      }));
      return;
    }

    // 還原：落點場次內容載入後，依存檔的造訪路徑（path）重建使用者實際看過的劇情（含分歧選擇），
    // 並標記待還原的捲動位置。restoreRef 只消費一次，避免重覆重建。
    if (restoreRef.current) {
      const r = restoreRef.current;
      restoreRef.current = null;

      let rebuilt;
      if (Array.isArray(r.path) && r.path.length) {
        const byOrder = new Map(queryInfo.content.map((c) => [String(c.order), c]));
        rebuilt = r.path.map((o) => byOrder.get(String(o))).filter(Boolean);
      }
      // 無造訪路徑（舊版存檔）→ 退回線性還原到 index.story
      if (!rebuilt || !rebuilt.length) {
        rebuilt = queryInfo.content.slice(0, (index.story ?? 0) + 1);
      }

      console.log('[紀錄診斷] 還原觸發 → 存檔pathLen=', Array.isArray(r.path) ? r.path.length : '(無)',
        'content.len=', queryInfo.content.length, '重建後story.len=', rebuilt.length,
        'index.story=', index.story, 'scrollOffset=', r.scrollOffset);

      setStory(rebuilt);
      storyRef.current = rebuilt;
      // 對齊 index.story 至最後造訪段落，後續點擊／選擇才能正確續看（若已相同則不更新，避免本 effect 重跑）
      const last = rebuilt[rebuilt.length - 1];
      const lastIdx = queryInfo.content.findIndex((c) => String(c.order) === String(last?.order));
      if (lastIdx >= 0 && lastIdx !== index.story) {
        setIndex((prev) => ({ ...prev, story: lastIdx }));
      }
      setPendingScrollOffset(r.scrollOffset ?? 0);
      return;
    }

    // 用戶點擊逐段加入（存檔交由下方「story 變更」effect 處理，以讀到最新造訪路徑）
    setStory((prev) => {
      const newItem = queryInfo.content[index.story];
      if (prev.length && prev[prev.length - 1]?.id === newItem?.id) return prev;
      return [...prev, newItem];
    });
  }, [index.story, queryInfo.content]);

  // 劇情序列（story）變更後存檔：在此存才讀得到最新的造訪路徑（含分歧選擇）。
  // 還原進行中（restoreRef 尚未消費或捲動尚未定位）不存，避免覆寫成中間狀態。
  useEffect(() => {
    storyRef.current = story; // 同步鏡像，供保底存檔讀取最新路徑
    if (restoreRef.current) {
      console.log('[紀錄診斷] 存檔略過：還原尚未完成 (restoreRef 仍在)，story.len=', story.length);
      return;
    }
    if (pendingScrollOffset != null) {
      console.log('[紀錄診斷] 存檔略過：捲動還原中 (pendingScrollOffset)，story.len=', story.length);
      return;
    }
    if (skipPersistRef.current) return;
    if (index.story === null || !story.length) return;
    const payload = buildPayload();
    console.log('[紀錄診斷] 存檔 → screen=', index.screen, 'story=', index.story,
      'pathLen=', payload.cachedIndex.path.length, 'scrollOffset=', payload.cachedIndex.scrollOffset);
    storage.storeStory(payload, 'continueStory');
  }, [story]);

  // 捲動控制：
  //  - 還原階段（pendingScrollOffset != null）：定位到離開當下的捲動位置（offset 為 0 則捲到最後一段）
  //  - 一般新增段落：自動捲到最新一段
  useEffect(() => {
    if (pendingScrollOffset != null) {
      const offset = pendingScrollOffset;
      prevStoryLength.current = story.length; // 先對齊，避免還原後誤判為「新增段落」又捲一次
      const t = setTimeout(() => {
        if (flatlistRef.current && story.length > 0) {
          if (offset > 0) {
            flatlistRef.current.scrollToOffset({ offset, animated: false });
          } else {
            flatlistRef.current.scrollToIndex({
              index: story.length - 1,
              animated: false,
              viewPosition: 0.5,
            });
          }
          scrollOffsetRef.current = offset;
          console.log('還原捲動位置 offset:', offset);
        }
        setPendingScrollOffset(null);
      }, 250);
      return () => clearTimeout(t);
    }

    if (story.length > prevStoryLength.current) {
      const t = setTimeout(() => {
        if (flatlistRef.current) {
          flatlistRef.current.scrollToIndex({
            index: story.length - 1,
            animated: true,
            viewPosition: 0.5,
          });
        }
      }, 200);
      prevStoryLength.current = story.length;
      return () => clearTimeout(t);
    }
    prevStoryLength.current = story.length;
  }, [story, pendingScrollOffset]);

  // 自動播放：開啟後每 autoPlaySeconds 秒推進一段（等同點一下畫面）。遇下列情形暫停：
  //  - 目前段落帶選項（choice1Content）→ 停下等使用者選；選完 index.story 變動、本 effect
  //    重跑即自動續播（故此處只 return、不關閉開關）。
  //  - 下一段為「結尾」（即將換場次）或本場次已無下一段 → 關閉自動播放，由使用者手動續看。
  //  - 顯示購買提示（試閱播畢／跳轉被擋）→ 關閉自動播放。
  useEffect(() => {
    if (!isAutoPlay) return;
    if (showPurchaseOverlay) {
      setIsAutoPlay(false);
      return;
    }
    if (index.story === null || !queryInfo.content?.length) return;
    const current = queryInfo.content[index.story];
    if (!current) return;
    if (current.choice1Content) return; // 有選項 → 暫停等待使用者
    const next = queryInfo.content[index.story + 1];
    if (!next || next.contentPresent === '結尾') {
      setIsAutoPlay(false); // 換場次前暫停
      return;
    }
    const timer = setTimeout(() => onPressOption(null), autoPlaySeconds * 1000);
    return () => clearTimeout(timer);
  }, [isAutoPlay, index.story, queryInfo.content, showPurchaseOverlay, autoPlaySeconds]);

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
        let landingScreen = screeningsList.length
          ? Math.min(Math.max(cachedIndex?.screen ?? 0, 0), screeningsList.length - 1)
          : 0;
        // 跨章節跳轉落點：以 targetScreeningId（場次 .id）覆蓋還原的場次索引，
        // 並把 targetDialogId（對話 order）交給「待定位」機制於內容載入後消化。
        if (targetScreeningId != null) {
          const ti = screeningsList.findIndex(
            (s) => String(s?.id) === String(targetScreeningId)
          );
          if (ti >= 0) landingScreen = ti;
        }
        if (targetDialogId != null) {
          pendingDialogRef.current = targetDialogId;
        }
        const screenData = screeningsList[landingScreen];

        setQueryInfo({
          config: config?.data?.[0] ?? {},
          screenings: screeningsList,
          role: role?.data ?? {},
          imageUrl: domain + screenData?.bg_view,
          roleConf: roleConf?.data?.[0],
        });

        setIndex({
          story: initialStoryIndex,
          screen: landingScreen,
        });
      } catch (error) {
        console.error('API 請求失敗：', error);
      }
    };

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
        <StoryHeader
          storyName={name}
          author={author}
          config={queryInfo.config}
          isAutoPlay={isAutoPlay}
          onToggleAutoPlay={() => setIsAutoPlay((v) => !v)}
        />
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
            scrollEventThrottle={16}
            onScroll={(e) => {
              // 即時記錄目前捲動位置，供翻頁即存與離開保底存檔寫入（不還原到舊位置覆蓋當下）
              scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
            }}
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
                  // 選項只在目前作用中的最後一段顯示；選完後對應段落 append、此段不再是最後一段
                  // → 選項自動消失。
                  isActive={index === story.length - 1}
                />
              )
            }
          />
        </Pressable>

        {/* 場次切換器（把手樣式）：渲染順序排在 FlatList 之後，確保 Android/iOS 都疊在內容最上層、
            可見且可點。預設 top:0，握把貼齊最頂端、位於 Auto 鈕上方。 */}
        {canSwitchScreening(roleLevel) && screeningList.length > 0 && (
          <ScreeningSwitcher
            sessions={screeningList}
            currentIndex={index.screen}
            onSelect={goToScreening}
          />
        )}

        <Modal
          visible={showPurchaseOverlay}
          transparent
          animationType="fade"
          onRequestClose={dismissPurchaseOverlay}
        >
          <Pressable
            style={styles.overlay}
            onPress={dismissPurchaseOverlay}
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
                onPress={dismissPurchaseOverlay}
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
