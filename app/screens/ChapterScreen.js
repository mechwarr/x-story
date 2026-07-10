import { FlatList, SafeAreaView, View, StyleSheet } from 'react-native';
import React, { useCallback, useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import ChapterItem from '../components/ChapterItem';
import useResponsive from '../hook/useResponsive';
import StoryHeader from '../components/StoryHeader';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import apiclient from '../config/apiClient';
import { useCoins } from '../store/coinContext';
import { syncPurchasedStoryIds } from '../services/bookAccessService';
import { pickConfigByLang } from '../i18n/i18n';
import { toColor } from '../config/normalizeStyle';
import { useLanguage } from '../i18n/LanguageContext';

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
  // 目前語系；切換語系時重新抓取＋重挑相符語系的參數列（與 Books 的防禦式做法一致，
  // 即使日後 _layout 不再以 lang 為 key 重新掛載也不會失準）。
  const { lang } = useLanguage();
  const priceCoins = storyData?.priceCoins ?? 0;
  const isLocallyPurchased = localPurchasedIds.includes(Number(storyId));

  const onPurchaseSuccess = useCallback(() => {
    setLocalPurchasedIds((prev) =>
      prev.includes(Number(storyId)) ? prev : [...prev, Number(storyId)]
    );
  }, [storyId]);

  const refreshPurchasedIds = useCallback(async () => {
    const mergedIds = await syncPurchasedStoryIds();
    setLocalPurchasedIds(mergedIds);
  }, []);

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
        // 依目前 App 語系挑出相符的那一筆參數（取代原本寫死的 data[0]/data[1]），
        // 否則切換語系後樣式仍套用固定第一筆、不會跟著語系更新。
        setQueryInfo({
          listData: chapterList?.data ?? [],
          toastConfig: pickConfigByLang(toastConfig?.data) ?? {},
          uiConfig: pickConfigByLang(uiConfig?.data) ?? {},
          storyConfig: pickConfigByLang(storyConfig?.data) ?? {},
          config: pickConfigByLang(UIConfig?.data) ?? {},
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
  }, [lang]);

  useFocusEffect(
    useCallback(() => {
      refreshPurchasedIds();
    }, [refreshPurchasedIds])
  );

  const { isTablet, maxContentWidth } = useResponsive();

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: toColor(queryInfo?.config?.view_color),
      }}
    >
      <View style={[styles.contentWrap, isTablet && { maxWidth: maxContentWidth, alignSelf: 'center', width: '100%' }]}>
      <StoryHeader
        // 章節頁頂部書名：與 StoryScreen 一致，優先用 story-list 的 stroy_name
        //（CMS「故事內的故事名稱」欄位），舊資料無此欄時退回 main_menu_name，再退回導覽帶入的 name。
        storyName={storyData?.stroy_name ?? storyData?.main_menu_name ?? name}
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
