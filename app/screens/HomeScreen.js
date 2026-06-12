import { useIsFocused, useNavigation } from '@react-navigation/native';
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { FlatList } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Content from './Content';
import Screen from './Screen';

import AppHeader from '../components/AppHeader';
import Books from '../components/Book/Books';
import storage from '../storage/storage';
import { bookDataBaseUrl } from '../config/apiClient';
import { getBookstoreList, getAllAdminBookstores, getEffectiveRoleLevel, refreshRoleLevelCache } from '../config/userApiClient';
import { canViewUnlisted } from '../config/roles';
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
    news: '',
    storyInfo: [],
    storyList: [],
  });

  const [storyCache, setStoryCache] = useState({
    finish: null,
    continue: null,
  });

  const renderItem = ({ item }) => (
    <Books
      type={item}
      config={storyInfo.config[0]}
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
        const newsData = await axios.get(
          url + 'api/v1/admin/news'
        );
        const type = await axios.get(
          url + 'api/v1/admin/story-type'
        );
        const nochapter = await axios.get(
          url + `api/v1/admin/nochapter`
        );

        // 判斷可見性權限：roleLevel >= 6 可檢視未上架書籍（門檻定義於 config/roles.ts）。
        // getEffectiveRoleLevel 會優先讀本地快取，避免每次聚焦都打 api/users/me。
        // 需在抓書店清單前確定身分，才能決定要打哪一支 API。
        const roleLevel = await getEffectiveRoleLevel();
        let canSeeUnlisted = canViewUnlisted(roleLevel);

        // story-list 先啟動，與下方書店清單並行抓取（不阻塞權限分流）。
        const storyListPromise = axios
          .get(url + `api/v1/admin/story-list`)
          .catch(() => ({ data: [] }));

        // 取得書店清單：
        // - 可見未上架（role >= 6）：打 GET api/admin/bookstores（含所有狀態，需 Bearer token）
        // - 一般用戶：維持公開的 GET api/bookstorelist（僅上架書籍）
        let bookstoreList = [];
        if (canSeeUnlisted) {
          const adminResult = await getAllAdminBookstores();
          if (adminResult.authError) {
            // 後端拒絕（token 過期或角色被降級，與本地快取不符）→ 修正權限快取並退回公開清單，
            // 避免畫面一片空白或停留在過期的管理員視圖。
            console.warn('[HomeScreen] 後台書店權限驗證失敗，退回公開書店清單並更新權限快取');
            await refreshRoleLevelCache();
            canSeeUnlisted = false;
            bookstoreList = await getBookstoreList();
          } else {
            bookstoreList = adminResult.items;
          }
        } else {
          bookstoreList = await getBookstoreList();
        }

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
        //（用來決定一般用戶能否看到；可見未上架者 role >= 6 不受此限）。
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
        // - 可見未上架者（role >= 6）：全部顯示（含未上架書籍）
        // - 一般用戶：僅顯示存在於 GET /api/bookstorelist 的書籍
        const displayStoryList = canSeeUnlisted
          ? fullStoryList
          : fullStoryList.filter((item) => item.inBookstore);

        console.log(
          `[HomeScreen] 書籍數量 — 完整: ${fullStoryList.length}, 顯示: ${displayStoryList.length}, 可見未上架: ${canSeeUnlisted}`
        );

        // 驗證用：印出後端 lang 欄位實際出現的所有原始值，方便確認正規化是否涵蓋到位（可在問題確認後移除）
        if (__DEV__) {
          console.log(
            '[HomeScreen] 後端 lang 原始值分佈:',
            [...new Set(displayStoryList.map((b) => b?.lang))]
          );
        }

        setStoryInfo({
          type: type?.data ?? [],
          config: config?.data ?? [],
          news: newsData?.data?.[0]?.news_content ?? '',
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
    <Screen style={{ backgroundColor: storyInfo.config?.[0]?.view_color }}>
      <AppHeader 
        news={storyInfo.news}
        config={storyInfo.config}
        onNewsPress={() => storage.deleteAllStorage()}
      />
      <Content>
        <FlatList
          data={storyInfo.type}
          keyExtractor={(item) => item?.id?.toString()}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
        />
      </Content>
    </Screen>
  );
}

export default HomeScreen;
