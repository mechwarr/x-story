import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, FlatList, View } from 'react-native';

import AppHeader from '../components/AppHeader';
import Screen from './Screen';
import { useIsFocused } from '@react-navigation/native';

import Content from './Content';
import AppText from '../components/AppText';
import storage from '../storage/storage';
import Book from '../components/Book/Book';
import colors from '../config/colors';
import { isEmpty } from 'lodash';
import { translate, matchesCurrentStoryLang } from '../i18n/i18n';
import { useLanguage } from '../i18n/LanguageContext';

function ContinueScreen() {
  const [storyCache, setStoryCache] = useState(null);
  const isFocus = useIsFocused();
  // 目前語系：納入篩選依賴，切換語系時重新過濾「繼續觀看」清單，
  // 只顯示與目前 App 語系相符的書籍（與首頁 Books 的篩選邏輯一致）。
  const { lang } = useLanguage();

  useEffect(() => {
    async function getStories() {
      const continueStory = await storage.getStorys('continueStory');
      setStoryCache({ continueStory });
    }
    getStories(!storyCache?.continueStory);
  }, [isFocus]);

  // 依目前語系過濾：書籍 lang 取自存檔的 storyData（與首頁同一來源欄位），
  // 舊存檔可能無 storyData.lang 時退回 item.lang。
  const continueStories = useMemo(() => {
    const list = storyCache?.continueStory ?? [];
    if (!Array.isArray(list)) return [];
    return list.filter((item) =>
      matchesCurrentStoryLang(item?.storyData?.lang ?? item?.lang)
    );
  }, [storyCache, lang]);

  return (
    <Screen>
      <AppHeader />
      <Content>
        <View style={styles.books}>
          {isEmpty(continueStories) ? (
            <AppText style={styles.noBooks}>{translate('noBooksViewed')}</AppText>
          ) : (
            <FlatList
              data={continueStories}
              keyExtractor={(item) => item?.storyId?.toString()}
              numColumns={2}
              renderItem={({ item }) => <Book {...item} showIcon={true} />}
            />
          )}
        </View>
      </Content>
    </Screen>
  );
}

const styles = StyleSheet.create({
  books: {
    alignItems: 'flex-start',
  },
  noBooks: {
    color: colors.white,
    fontSize: 20,
    // fontWeight: 'bold',
  },
});

export default ContinueScreen;
