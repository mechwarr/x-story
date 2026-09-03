import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Image,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { showAlert } from '../CustomAlert';
import routes from '../../navigations/routes';
import AppText from '../AppText';
import colors from '../../config/colors';
import apiclient  from '../../config/apiClient';
import { isTabletWidth, getUiScale } from '../../config/responsive';
import { translate, coinCountLabel } from '../../i18n/i18n';
import { toColor, toFontWeight } from '../../config/normalizeStyle';
import { useGuardedNavigate } from '../../../hooks/useGuardedNavigate';
import { purchaseStoryWithCoins, getEffectiveRoleLevel } from '../../config/userApiClient';
import { canPreviewAll } from '../../config/roles';
import { resolveOwnedStoryIds } from '../../services/bookAccessService';
import { getOrCreateIdempotencyKey, clearIdempotencyKey } from '../../config/idempotencyKeyCache';
import { useCoins } from '../../store/coinContext';
import storage from '../../storage/storage';
import { recordCoinOrderBook } from '../../storage/coinOrderBooks';
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

  // 不分章節書籍的「是否開放免費試閱」旗標：nochapter 表的欄位名是 read_free
  //（分章節的 chapter 表才叫 free_open）。原本只讀 chapter?.free_open → 永遠 undefined，
  // 導致 StoryScreen 的 shouldTrim 恆為 false：非試閱內容完全沒被鎖、也不會跳解鎖列。
  // 兩個欄位名都收，避免後端日後統一欄位名時再壞一次。
  const noChapterFreeOpen = chapter?.read_free ?? chapter?.free_open;

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
    free_open: noChapterFreeOpen,
  };

  // 繼續觀看：以該書「最後一次的存檔」(continueStory item) 原樣回到原章節/場次/對話順序，
  // 一次到位。存檔本身即含 storyId / chapterId / read_range_end / free_open / storyData /
  // nochapter，以及 cachedIndex(screen＝場次, story＝對話索引, path＝造訪對話順序, scrollOffset)。
  // 這裡直接帶入這些欄位、不經 storyPayload 重新推導，避免覆蓋掉存檔的定位資訊
  // （storyPayload 會把 storyId 改成 storyData.id、並用 nochapter 重算 chapterId/read_range_end）。
  // record 不傳（繼續觀看頁：存檔 item 已由 ContinueScreen 展開成 props）時取 props；
  // 首頁防呆視窗走「本書已有讀到一半紀錄」時，傳入 storyCache 裡的該筆存檔。
  const goToContinue = (record) => {
    const saved = record ?? props;
    navigation.navigate(routes.HOME, {
      screen: routes.STORY,
      params: {
        name: main_menu_name,
        author,
        storyId: saved.storyId ?? props.storyId ?? id,
        chapterId: saved.chapterId ?? chapterId ?? chapter?.id,
        storyData: saved.storyData ?? storyData,
        nochapter: saved.nochapter ?? nochapter,
        // 章節/場次/對話順序的還原核心：一律以存檔為準。
        cachedIndex: saved.cachedIndex,
        read_range_end: saved.read_range_end ?? read_range_end ?? chapter?.read_range_end,
        // 優先用存檔保留的試閱旗標；舊版存檔沒有時退回 nochapter 推導。
        free_open: saved.free_open ?? noChapterFreeOpen,
      },
    });
  };

  // 存檔落點「現在」是否仍在免費試閱範圍內。一律以後端現況的章節設定判斷，不採信存檔裡的
  // free_open / read_range_end——那是存檔當下寫的，後台之後可能把該章關閉。
  // 為什麼非查不可：分章節書的付費保護全靠章節選單的鎖頭，故事頁的「整本上鎖」分支帶
  // !isChapterBook，對「已關閉試閱的章節」不會截斷也不會上鎖。若放行一筆指向已關閉章節的
  // 舊存檔，那一章就會整章免費讀完。
  // 取不到資料時回 false（保守擋下）：此處守的是付費內容，未知不可放行。
  const isSavedSpotStillFree = async (record) => {
    const savedChapterId = record?.chapterId;
    const savedScreen = Number(record?.cachedIndex?.screen);
    if (savedChapterId == null || !Number.isFinite(savedScreen)) return false;
    try {
      const res = await axios.get(
        `${apiclient.currentBaseUrl()}api/v1/admin/chapter/${props.storyId ?? id}`
      );
      const row = (Array.isArray(res?.data) ? res.data : []).find(
        (c) => Number(c?.id) === Number(savedChapterId)
      );
      if (!row) return false; // 章節已不存在
      if (row.free_open !== '開放') return false; // 該章現在不開放試閱
      const rangeEnd = Number(row.read_range_end);
      if (!Number.isFinite(rangeEnd) || rangeEnd <= 0) return false; // 沒設定試閱長度＝沒有免費範圍
      // 場次索引為 0 起算：read_range_end = 4 代表可讀 screen 0~3。
      const stillFree = savedScreen < rangeEnd;
      console.log('[Book] 試閱範圍比對 →', {
        chapterId: savedChapterId, savedScreen, free_open: row.free_open, read_range_end: row.read_range_end, stillFree,
      });
      return stillFree;
    } catch (e) {
      console.warn('[Book] 章節現況取不到，續讀保守擋下:', e?.message ?? e);
      return false;
    }
  };

  // 繼續觀看／再次回味的守門（需求 4、10）：
  //  4. 書籍下架／刪除 → 一律不能再看（堵住一般用戶用本地存檔繞過閘門續看的漏洞）。
  // 10. 付費書但已被移除書單（伺服器撤銷授權）→ 不能靠存檔續看「付費內容」；跳提示後走購買閘門。
  // role >= 5（小編／管理員）預覽者不受限，一律放行。
  // 回傳 true 表示可續看／回味；false 表示已擋下（本函式已負責提示或改導向）。
  // proceed：呼叫端「放行後要做的導向」。未持有時本函式會先跳提示，由「確認」接手執行
  //（不分章節書＝照常還原進度、由 StoryScreen 上鎖），故此時回傳 false、呼叫端不要再導一次。
  // savedRecord：這次要還原的存檔（繼續觀看＝props、首頁防呆右鍵＝storyCache 那筆、
  //   再次回味＝null，已讀完的書沒有落點）。用來判斷未持有時「落點是否仍在免費範圍內」。
  const canContinueOwned = async (proceed, savedRecord) => {
    const roleLevel = await getEffectiveRoleLevel();
    if (canPreviewAll(roleLevel)) return true; // 預覽者不受限

    const bookId = props.storyId ?? id;

    // 首頁快取的書店快照（含 isActive / priceCoins）：判斷是否仍在架。
    let snapshot = [];
    try {
      const raw = await AsyncStorage.getItem('bookstoreList');
      snapshot = raw ? JSON.parse(raw) : [];
    } catch (e) {
      snapshot = [];
    }
    // 快照為空＝狀態未知（尚未載入首頁）→ 不誤擋，放行。
    if (!Array.isArray(snapshot) || snapshot.length === 0) return true;

    const entry = snapshot.find((b) => Number(b?.storyListId) === Number(bookId));
    const onShelf = !!entry && entry.isActive !== false;
    if (!onShelf) {
      // 下架／刪除：不能再看
      showAlert(translate('noticeTitle'), translate('bookUnavailable'));
      return false;
    }

    // 付費書：以伺服器 entitlements 權威判斷持有；被移除書單者需重新購買。
    const isPaid = Number(entry.priceCoins) > 0;
    if (isPaid) {
      const { ids: ownedIds, authoritative } = await resolveOwnedStoryIds();
      const owned = ownedIds.map(Number).includes(Number(bookId));
      // 持有狀態「未知」（entitlements 取不到：離線／逾時／非 2xx）時不誤擋——與上方
      // 「在架快照為空即放行」同一原則。少了這道判斷，一次網路失敗就會讓所有付費書
      // 被當成未持有，「繼續觀看」永遠靜默導去章節選單、回不到最後的閱讀進度。
      if (!owned && !authoritative) {
        console.warn('[Book] 持有狀態未知（entitlements 取不到），放行續看：', bookId);
        return true;
      }
      if (!owned) {
        // 權威確認「確實未持有」。此時的判斷依據不是「有沒有買」，而是
        // 「要還原的那個位置，現在還在免費試閱範圍內嗎」——試閱讀者本來就讀得到那一段，
        // 沒有理由每次都被踢回章節選單重找。超出範圍（或該章已關閉試閱）才走購買閘門。
        if (hasChapter && (await isSavedSpotStillFree(savedRecord))) {
          console.log('[Book] 未持有但存檔落點仍在試閱範圍內 → 照常還原：', bookId);
          return true;
        }
        console.log('[Book] 付費書未持有且落點不在免費範圍 → 套用購買閘門：', bookId, '有章節:', hasChapter, '已持有清單:', ownedIds);
        // 先明講原因再導向：靜默轉場會讓使用者以為「閱讀紀錄壞了」（實際是尚未解鎖／授權失效）。
        showAlert(translate('noticeTitle'), translate('bookNeedsUnlock'), [
          {
            text: translate('ok'),
            onPress: () => {
              if (hasChapter) {
                goToStart(); // 章節選單本身就是購買閘門（每章顯示鎖頭），且不會動到存檔
                return;
              }
              // 不分章節書：goToStart 會進 StoryScreen 但不帶 cachedIndex ＝ 從第一場次重播，
              // 使用者只要點一下推進，翻頁即存就把 continueStory 覆寫成開頭、原進度永久消失。
              // 改為照常還原存檔位置，閘門交給 StoryScreen 施加（試閱截斷／整本上鎖／解鎖列），
              // 未持有者一樣看不到非試閱內容，但進度不會被摧毀。
              proceed?.();
            },
          },
        ]);
        return false; // 導向已由上方提示的「確認」接手，呼叫端不要再導一次
      }
    }
    return true;
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
          nochapter,
        },
      });
    } else {
      navigation.navigate(routes.HOME, {
        screen: routes.STORY,
        params: storyPayload,
      });
    }
  };

  // 主選單-防呆視窗（書籍簡介彈窗）：標題/內文/兩顆按鈕字樣來自 menu-foolproof 參數表
  // （menuFoolproofConfig，已於 HomeScreen 依語系挑列）。未設定的欄位自動略過、沿用預設。
  // 公開書的一般入口與 role >= 5 的未公開書預覽入口共用（入口禮儀一致，不因角色跳過簡介）。
  // - 重新閱讀（左）：goToStart，從頭開始（有章節會進章節選單頁）。
  // - 繼續閱讀（右）：本書已有「讀到一半」紀錄 → 比照繼續觀看，驗證在架/持有後
  //   直接回到存檔的章節/場次/對話狀態；沒有紀錄才前往繼續觀看清單頁（ContinueScreen）。
  const showMenuIntro = () => {
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
          onPress: async () => {
            const saved = storyStatus.read;
            if (saved?.cachedIndex) {
              // 與繼續觀看入口同一守門：下架不能看、付費書未解鎖則跳提示後走購買閘門。
              const proceed = () => goToContinue(saved);
              if (await canContinueOwned(proceed, saved)) proceed();
              return;
            }
            navigation.navigate(routes.CONTINUE);
          },
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
        translate('coinsInsufficientMessage', {
          priceLabel: coinCountLabel(priceCoins),
          coinsLabel: coinCountLabel(coins),
        }),
        [
          { text: translate('cancel'), style: 'cancel' },
          {
            text: translate('goToShop'),
            onPress: () => {
              navigation.navigate(routes.PURCHASE);
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
          text: translate('confirmUnlockButton'),
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
                // 記下訂單↔書籍對照：金幣紀錄只拿得到 ORDER 編號，只有此刻知道它對應哪本書
                await recordCoinOrderBook(result.orderId, result.storyListId ?? id);
                
                // 購買成功後強制刷新金幣餘額
                await refreshCoins(true);
                
                showAlert(
                  translate('unlockSuccessTitle'),
                  translate('purchaseSuccessMessage', { name: main_menu_name, coins: result.coinsSpent || priceCoins }),
                  [
                    {
                      text: translate('startReading'),
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
          //  - role >= 5（小編／管理員）：可點擊預覽，但入口禮儀與公開書一致——
          //    同樣先跳書籍簡介防呆視窗，按鈕行為相同（左：從頭開始；右：還原進度或繼續觀看頁）。
          //  - 其餘角色：跳出多語系 alert「即將上架／敬請期待！」，不進入。
          if (!isOpen && !showIcon && !showReviewIcon) {
            const roleLevel = await getEffectiveRoleLevel();
            if (!canPreviewAll(roleLevel)) {
              showAlert(translate('comingSoonTitle'), translate('comingSoon'));
              return;
            }
            showMenuIntro();
            return;
          }

          if (showIcon) {
            // 繼續觀看：先驗證仍在架＋（付費書）仍持有，再回到最後存檔的章節/場次/對話順序
            const proceed = () => goToContinue();
            // 繼續觀看頁：存檔 item 已由 ContinueScreen 展開成 props，props 本身就是那筆存檔。
            if (await canContinueOwned(proceed, props)) proceed();
          } else if (showReviewIcon) {
            // 再次回味：同樣先驗證仍在架＋仍持有
            const proceed = () => {
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
            // 再次回味＝已讀完的書，finishStory 不存落點 → 無免費範圍可比對，維持購買閘門。
            if (await canContinueOwned(proceed, null)) proceed();
          } else {
            // 一般選項：每次點擊都跳出簡介彈窗（showMenuIntro），讓使用者選擇。
            showMenuIntro();
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
                color: toColor(main_menu_name_color),
                fontWeight: toFontWeight(main_menu_name_weight),
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
