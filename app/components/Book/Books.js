import React, { useMemo } from 'react';
import { View, StyleSheet, FlatList, Platform } from 'react-native';
import colors from '../../config/colors';
import AppText from '../AppText';
import Book from './Book';
import { getCurrentStoryLang } from '../../i18n/i18n';

function Books({ type, config, storyList, storyCache, nochapter }) {
  const {
    story_type_size = 20,
    story_type_color = '#fff',
    story_type_weight = '',
  } = config;
  
  const renderItem = ({ item,index }) => <Book storyData={item} storyCache={storyCache} nochapter={nochapter} index={index}/>;

  // 依「分類」與「使用者語系」篩選：避免同一本書的多語版本同時出現（重複顯示），
  // 並只顯示與 App 啟動語系相符的書籍。
  const listData = useMemo(() => {
    const currentStoryLang = getCurrentStoryLang();
    return storyList.filter(
      (e) =>
        e?.story_type === type?.story_type && e?.lang === currentStoryLang
    );
  }, [storyList, type?.story_type]);

  if (!listData?.length) return;
  
  return (
    <View style={styles.container}>
      {!storyList?.length ? null : (
        <>
          <AppText
            style={{
              fontSize: story_type_size ?? 20,
              color: story_type_color ?? colors.leftChatBackground,
              ...(story_type_weight === '粗' && {
                fontWeight: Platform.OS === 'ios' ? 600 : 'bold',
              }),
            }}
          >
            {type?.story_type}
          </AppText>
          <FlatList
            data={listData}
            keyExtractor={(item) => item?.id?.toString()}
            horizontal={true}
            renderItem={renderItem}
            showsHorizontalScrollIndicator={false}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 15,
  },
  type: {
    fontSize: 21,
    fontWeight: 'bold',
    color: colors.leftChatBackground,
  },
  name: {
    fontSize: 21,
  },
});

export default Books;
