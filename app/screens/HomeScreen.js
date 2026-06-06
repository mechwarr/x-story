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
import apiclient  from '../config/apiClient';
import { getBookstoreList, getUserProfile } from '../config/userApiClient';
import tokenStorage from '../auth/Storage';
import routes from '../navigations/routes';
import { consumePendingProfileRedirect } from '../auth/firstLoginRedirect';

const url = apiclient.currentBaseUrl();

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
        // 並行獲取兩個 API 的資料
        const [bookstoreList, originalStoryList] = await Promise.all([
          getBookstoreList(),
          axios.get(url + `api/v1/admin/story-list`).catch(() => ({ data: [] }))
        ]);
        
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
        //（用來決定一般用戶能否看到；管理員不受此限）。
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

        // 判斷是否為管理員（roleLevel >= 9）：優先讀本地快取，避免每次聚焦都打 api/users/me
        let isAdmin = false;
        try {
          const token = await tokenStorage.getToken();
          if (token) {
            let roleLevel = await tokenStorage.getUserRoleLevel();
            // 本地無快取（例如此功能上線前已登入的用戶）→ 回退查詢一次並補寫快取
            if (roleLevel === null) {
              const profile = await getUserProfile();
              roleLevel = Number(profile?.roleLevel) || 0;
              await tokenStorage.setUserRoleLevel(roleLevel);
            }
            isAdmin = Number(roleLevel) >= 9;
          }
        } catch (roleError) {
          console.warn('[HomeScreen] 取得用戶權限失敗，預設為一般用戶:', roleError.message);
        }

        // 決定實際顯示的書籍：
        // - 管理員（role >= 9）：全部顯示（含未上架書籍）
        // - 一般用戶：僅顯示存在於 GET /api/bookstorelist 的書籍
        const displayStoryList = isAdmin
          ? fullStoryList
          : fullStoryList.filter((item) => item.inBookstore);

        console.log(
          `[HomeScreen] 書籍數量 — 完整: ${fullStoryList.length}, 顯示: ${displayStoryList.length}, 管理員: ${isAdmin}`
        );

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
