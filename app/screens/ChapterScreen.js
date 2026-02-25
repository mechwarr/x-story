import { FlatList, SafeAreaView, View, StyleSheet } from 'react-native';
import React, { useCallback, useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import ChapterItem from '../components/ChapterItem';
import useResponsive from '../hook/useResponsive';
import StoryHeader from '../components/StoryHeader';
import { useRoute } from '@react-navigation/native';
import apiclient from '../config/apiClient';
import { useCoins } from '../store/coinContext';
import storage from '../storage/storage';

const ChapterScreen = () => {
  const [queryInfo, setQueryInfo] = useState({
    listData: [],
    toastConfig: {},
  });
  const [localPurchasedIds, setLocalPurchasedIds] = useState([]);
  const route = useRoute();

  const url = apiclient.currentBaseUrl();

  const { name, author, storyId, storyData, nochapter } = useMemo(
    () => route.params ?? { name: '', author: '', storyId: 1 },
    [route.params]
  );

  const { coins, refreshCoins } = useCoins();
  const priceCoins = storyData?.priceCoins ?? 0;
  const isLocallyPurchased = localPurchasedIds.includes(Number(storyId));

  const onPurchaseSuccess = useCallback(() => {
    setLocalPurchasedIds((prev) =>
      prev.includes(Number(storyId)) ? prev : [...prev, Number(storyId)]
    );
  }, [storyId]);

  const renderItem = ({ item, index }) => (
    <ChapterItem
      {...item}
      toastConfig={queryInfo?.toastConfig}
      index={index}
      storyId={storyId}
      author={author}
      storyData={storyData}
      nochapter={nochapter}
      uiConfig={queryInfo?.uiConfig}
      storyName={name}
      priceCoins={priceCoins}
      coins={coins}
      refreshCoins={refreshCoins}
      isBookPurchased={isLocallyPurchased}
      onPurchaseSuccess={onPurchaseSuccess}
    />
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        const UIConfig = await axios.get(
          url + 'api/v1/admin/menu'
        );
        const chapterList = await axios.get(
          url + `api/v1/admin/chapter/${storyId}`
        );
        const toastConfig = await axios.get(
          url + 'api/v1/admin/setup-chapter-foolproof'
        );
        const uiConfig = await axios.get(
          url + 'api/v1/admin/setup-chapter'
        );
        const storyConfig = await axios.get(
          url + `api/v1/admin/setup-story-list`
        );
        setQueryInfo({
          listData: chapterList?.data ?? [],
          toastConfig: toastConfig?.data?.[1] ?? {},
          uiConfig: uiConfig?.data?.[0] ?? {},
          storyConfig: storyConfig?.data[0] ?? [],
          config: UIConfig?.data,
        });
        // if (response?.data && Array.isArray(response.data)) {
        //   // const storyTypes = response.data[0];
        //   // setStoryList(response?.data ?? []);
        // } else {
        //   throw new Error('API 請求成功，但未返回預期的數據');
        // }
      } catch (error) {
        console.error('API 請求失敗「ChapterScreen」：', error);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    let mounted = true;
    storage.getLocalPurchasedStoryIds().then((ids) => {
      if (mounted) setLocalPurchasedIds(ids);
    });
    return () => { mounted = false; };
  }, []);

  const { isTablet, maxContentWidth } = useResponsive();

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: queryInfo?.config?.[0]?.view_color ?? '#fff',
      }}
    >
      <View style={[styles.contentWrap, isTablet && { maxWidth: maxContentWidth, alignSelf: 'center', width: '100%' }]}>
      <StoryHeader
        storyName={name}
        author={author}
        config={queryInfo?.storyConfig}
      />

      <FlatList
        data={queryInfo?.listData}
        keyExtractor={(item) => item?.id?.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ flexDirection: 'column', padding: 20 }}
      />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  contentWrap: {
    flex: 1,
  },
});

export default ChapterScreen;
