import { useIsFocused } from '@react-navigation/native';
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import Content from './Content';
import Screen from './Screen';

import AppHeader from '../components/AppHeader';
import Books from '../components/Book/Books';
import storage from '../storage/storage';
import apiclient  from '../config/apiClient';

const url = apiclient.currentBaseUrl();

function HomeScreen() {
  const isFocus = useIsFocused();
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
        const storyList = await axios.get(
          url + `api/v1/admin/story-list`
        );

        setStoryInfo({
          type: type?.data ?? [],
          config: config?.data ?? [],
          news: newsData?.data?.[0]?.news_content ?? '',
          nochapter: nochapter?.data ?? [],
          storyList: storyList?.data ?? [],
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
