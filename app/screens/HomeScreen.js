import { useIsFocused, useNavigation } from '@react-navigation/native';
import axios from 'axios';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Content from './Content';
import Screen from './Screen';

import AppHeader from '../components/AppHeader';
import Books from '../components/Book/Books';
import storage from '../storage/storage';
import { bookDataBaseUrl } from '../config/apiClient';
import { getBookstoreList, getEffectiveRoleLevel } from '../config/userApiClient';
import { canViewUnlisted } from '../config/roles';
import { matchesCurrentStoryLang, pickConfigByLang } from '../i18n/i18n';
import { toColor } from '../config/normalizeStyle';
import { useLanguage } from '../i18n/LanguageContext';
import routes from '../navigations/routes';
import { consumePendingProfileRedirect } from '../auth/firstLoginRedirect';

// 書籍資料端點（menu / news / story-type / nochapter / story-list）統一使用 bookDataBaseUrl，
// 固定走正式站、不隨 __DEV__ 切換（原因與來源詳見 config/apiClient.ts 的 bookDataBaseUrl 註解）。
const url = bookDataBaseUrl;

function HomeScreen() {
  const isFocus = useIsFocused();
  const navigation = useNavigation();

  // 首次登入且個人資料未完成 → 進入主畫面後自動導向 ProfileScreen（僅觸發一次）
  useEffect(() => {
    if (consumePendingProfileRedirect()) {
      navigation.navigate(routes.PROFILE);
    }
  }, [navigation]);

  const [storyInfo, setStoryInfo] = useState({
    type: [],
    config: {},
    newsList: [],
    storyInfo: [],
    storyList: [],
  });

  const [storyCache, setStoryCache] = useState({
    finish: null,
    continue: null,
  });

  // 當前語系（zh-TW / zh-CN / en）。語系變更時重新計算要顯示的分類。
  const { lang } = useLanguage();

  // 只渲染「當前語系下實際有書」的分類。
  // 原本直接把後端全部分類（繁中5 + 简中5 + 英文5，共 15 個、且英文固定排在最後）丟給 FlatList，
  // 非當前語系的分類會渲染成高度 0 的空區塊。英語模式下前 10 個（全中文）都是空的，
  // 英文分類落在 initialNumToRender(預設 10) 之外而永遠不被掛載，導致英語書「資料正確卻畫不出來」。
  // 先濾掉沒有書的分類，當前語系的分類就會排在最前面、必定被渲染。
  const visibleTypes = useMemo(() => {
    const list = storyInfo?.storyList || [];
    return (storyInfo?.type || []).filter((t) =>
      list.some(
        (b) =>
          b?.story_type === t?.story_type && matchesCurrentStoryLang(b?.lang)
      )
    );
  }, [storyInfo?.type, storyInfo?.storyList, lang]);

  // 最新消息依語系顯示：後端 news API 回傳多語系多列，同一語系可能有「多則」訊息。
  // 這裡挑出「當前語系的全部訊息」組成陣列，交給跑馬燈逐則播放（播完一則接下一則、全部播完再循環）。
  // 找不到相符語系時退回第一筆，避免最新消息整個消失（與 pickConfigByLang 的退回策略一致）。
  const news = useMemo(() => {
    const list = storyInfo?.newsList || [];
    const matched = list.filter((row) => matchesCurrentStoryLang(row?.lang));
    const rows = matched.length ? matched : list.slice(0, 1);
    return rows
      .map((row) => row?.news_content)
      .filter((content) => typeof content === 'string' && content.trim().length > 0);
  }, [storyInfo?.newsList, lang]);

  const renderItem = ({ item }) => (
    <Books
      type={item}
      config={storyInfo.config}
      menuFoolproofConfig={storyInfo?.menuFoolproofConfig}
      nochapter={storyInfo?.nochapter}
      storyCache={storyCache}
      storyList={storyInfo?.storyList}
    />
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        const config = await axios.get(
          url + 'api/v1/admin/menu'
        );
        // 主選單-防呆視窗參數表：用於替 Book 開書時的簡介彈窗（main_menu_title/content/btn）套字樣。
        const menuFoolproof = await axios.get(
          url + 'api/v1/admin/menu-foolproof'
        );
        const newsData = await axios.get(
          url + 'api/v1/admin/news'
        );
        const type = await axios.get(
          url + 'api/v1/admin/story-type'
        );
        const nochapter = await axios.get(
          url + `api/v1/admin/nochapter`
        );

        // 可見性門檻：roleLevel >= 5（小編以上）可看見未上架/未開放書籍（門檻定義於 config/roles.ts）。
        // getEffectiveRoleLevel 會優先讀本地快取，避免每次聚焦都打 api/users/me。
        const roleLevel = await getEffectiveRoleLevel();
        const canSeeUnlisted = canViewUnlisted(roleLevel);

        // story-list（公開 API）本就回傳「全部書籍」（含未開放/未上架），先啟動並與書店清單並行抓取。
        const storyListPromise = axios
          .get(url + `api/v1/admin/story-list`)
          .catch(() => ({ data: [] }));

        // 書店清單一律走公開的 GET api/bookstorelist（僅上架書籍 + 價格資訊）：
        //  - 供價格/購買資訊合併到 story-list。
        //  - 供 role < 5 篩選為「只顯示上架書」。
        // role >= 5 的未上架可見性改由 story-list 直接提供（它本就含全部書籍），
        // 不再打管理員專用端點 GET api/admin/bookstores，故不需 Bearer token、
        // 也不會發生 401/403（原 admin API 分流與強制刷新退場邏輯已整段移除）。
        const bookstoreList = await getBookstoreList();

        const originalStoryList = await storyListPromise;
        
        // 保存原始的 bookstoreList 到 AsyncStorage（只保存必要欄位，避免過大）
        if (bookstoreList && bookstoreList.length > 0) {
          try {
            const minimalBookstoreData = bookstoreList.map(item => ({
              id: item.id,
              storyListId: item.storyListId,
              priceCoins: item.priceCoins,
              currency: item.currency,
              isActive: item.isActive,
            }));
            await AsyncStorage.setItem('bookstoreList', JSON.stringify(minimalBookstoreData));
            console.log('[HomeScreen] ✓ 書店列表已保存（精簡版），數量:', bookstoreList.length);
          } catch (storageError) {
            console.warn('[HomeScreen] 保存書店列表到 AsyncStorage 失敗（可能資料過大）:', storageError.message);
          }
        }
        
        // 創建 bookstoreList 的映射表（以 storyListId 為 key）
        const bookstoreMap = new Map();
        bookstoreList.forEach(item => {
          bookstoreMap.set(item.storyListId, item);
        });

        // 合併兩個 API 的資料：以 story-list 為主，補充 bookstorelist 的購買資訊。
        // 同時標記 inBookstore：該書是否存在於 GET /api/bookstorelist
        //（用來決定一般用戶能否看到；可見未上架者 role >= 5 不受此限）。
        const fullStoryList = (originalStoryList?.data || []).map((storyItem) => {
          const bookstoreItem = bookstoreMap.get(storyItem.id);

          // 如果有對應的 bookstore 資料，合併購買資訊
          if (bookstoreItem) {
            return {
              ...storyItem, // 保留原本 story-list 的所有屬性（包含 story_type, lang 等關鍵屬性）
              // 補充書店相關的購買資訊
              priceCoins: bookstoreItem.priceCoins,
              currency: bookstoreItem.currency,
              isActive: bookstoreItem.isActive,
              soldCount: bookstoreItem.soldCount,
              inBookstore: true,
            };
          }

          // 沒有對應的 bookstore 資料：保留原始資料，標記為「未上架」
          return { ...storyItem, inBookstore: false };
        });

        // 先把「完整書籍資料（無論是否公開/上架）」堆疊快取起來，供離線或其他流程使用
        try {
          await AsyncStorage.setItem('fullStoryListCache', JSON.stringify(fullStoryList));
        } catch (cacheError) {
          console.warn('[HomeScreen] 完整書籍資料快取失敗（可能資料過大）:', cacheError.message);
        }

        // 決定實際顯示的書籍：
        // - 可見未上架者（role >= 5）：全部顯示（含未上架/未開放書籍，資料來自 story-list）
        // - 一般用戶（role < 5）：僅顯示存在於 GET /api/bookstorelist 的書籍（上架書）
        const displayStoryList = canSeeUnlisted
          ? fullStoryList
          : fullStoryList.filter((item) => item.inBookstore);

        console.log(
          `[HomeScreen] roleLevel: ${roleLevel}, 可見未上架(canSeeUnlisted): ${canSeeUnlisted}, 書店清單筆數: ${bookstoreList.length}, 書籍數量 — 完整: ${fullStoryList.length}, 顯示: ${displayStoryList.length}`
        );

        // 驗證用：印出後端 lang 欄位實際出現的所有原始值，方便確認正規化是否涵蓋到位（可在問題確認後移除）
        if (__DEV__) {
          console.log(
            '[HomeScreen] 後端 lang 原始值分佈:',
            [...new Set(displayStoryList.map((b) => b?.lang))]
          );
        }

        // 安全網：書籍存在於 storyList、但其 story_type 不在 story-type 分類清單裡時，
        // 補一個「合成分類」，避免該書因為沒有對應分類區塊而整個消失。
        // （英語書曾全部不顯示，即因 App 端拿到的 story-type 缺少 Crime / Sci-Fi 等英語分類。）
        // 區塊樣式來自全域 menu config，不靠 type 物件，故合成分類只需 id + story_type。
        const fetchedTypes = type?.data ?? [];
        const knownStoryTypes = new Set(fetchedTypes.map((t) => t?.story_type));
        const orphanTypes = [
          ...new Set(
            displayStoryList
              .map((b) => b?.story_type)
              .filter((st) => st && !knownStoryTypes.has(st))
          ),
        ].map((st) => ({ id: `synthetic-${st}`, story_type: st, lang: null }));
        if (orphanTypes.length) {
          console.warn(
            '[HomeScreen] story-type 缺少對應分類，已補合成分類以免書籍消失:',
            orphanTypes.map((t) => t.story_type)
          );
        }

        setStoryInfo({
          type: [...fetchedTypes, ...orphanTypes],
          // 依目前語系挑出相符的 menu 參數列（取代 config[0] 固定索引），
          // 讓頁面底色／最新消息／分類標題樣式隨語系切換更新。
          config: pickConfigByLang(config?.data) ?? {},
          menuFoolproofConfig: pickConfigByLang(menuFoolproof?.data) ?? {},
          newsList: newsData?.data ?? [],
          nochapter: nochapter?.data ?? [],
          storyList: displayStoryList,
        });
      } catch (error) {
        console.error('API 請求失敗「HomeScreen」：', error.message);
    if (error.response) {
      console.error('「HomeScreen」Response data:', error.response.data);
      console.error('「HomeScreen」Response status:', error.response.status);
      console.error('「HomeScreen」Response headers:', error.response.headers);
    } else if (error.request) {
      console.error('「HomeScreen」Request made but no response:', error.request);
    } else {
      console.error('「HomeScreen」Error config:', error.config);
    }
      }
    };
    async function getStories() {
      const finishStory = await storage.getStorys('finishStory');
      const continueStory = await storage.getStorys('continueStory');
      setStoryCache({ finishStory, continueStory });
    }
    fetchData();
    getStories();
  }, [isFocus]);

  return (
    <Screen style={{ backgroundColor: toColor(storyInfo.config?.view_color, '') || undefined }}>
      <AppHeader
        news={news}
        config={storyInfo.config}
      />
      <Content>
        <FlatList
          data={visibleTypes}
          keyExtractor={(item) => item?.id?.toString()}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
        />
      </Content>
    </Screen>
  );
}

export default HomeScreen;
