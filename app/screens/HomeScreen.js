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
import { getBookstoreList } from '../config/userApiClient';
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
        
        // 合併兩個 API 的資料：以 story-list 為主，補充 bookstorelist 的購買資訊
        const storyList = (originalStoryList?.data || []).map((storyItem) => {
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
            };
          }
          
          // 如果沒有對應的 bookstore 資料，返回原始資料
          return storyItem;
        });
        
        console.log('[HomeScreen] 合併後的書店列表數量:', storyList.length);

        setStoryInfo({
          type: type?.data ?? [],
          config: config?.data ?? [],
          news: newsData?.data?.[0]?.news_content ?? '',
          nochapter: nochapter?.data ?? [],
          storyList: storyList,
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
