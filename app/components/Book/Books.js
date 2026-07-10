import React, { useMemo } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import colors from '../../config/colors';
import AppText from '../AppText';
import { toColor, toFontWeight } from '../../config/normalizeStyle';
import Book from './Book';
import { matchesCurrentStoryLang } from '../../i18n/i18n';
import { useLanguage } from '../../i18n/LanguageContext';

function Books({ type, config, storyList, storyCache, nochapter, menuFoolproofConfig }) {
  const {
    story_type_size = 20,
    story_type_color = '#fff',
    story_type_weight = '',
  } = config;

  const renderItem = ({ item,index }) => (
    <Book
      storyData={item}
      storyCache={storyCache}
      nochapter={nochapter}
      index={index}
      menuFoolproofConfig={menuFoolproofConfig}
    />
  );

  // 目前語系（zh-TW / zh-CN / en）。納入 useMemo 依賴，確保切換語系時重新篩選，
  // 不再只依賴 LanguageGate 的整棵重新掛載（若日後改為保留畫面不卸載也不會失準）。
  const { lang } = useLanguage();

  // 依「分類」與「使用者語系」篩選：避免同一本書的多語版本同時出現（重複顯示），
  // 並只顯示與 App 啟動語系相符的書籍。
  const listData = useMemo(() => {
    return storyList.filter(
      (e) =>
        e?.story_type === type?.story_type && matchesCurrentStoryLang(e?.lang)
    );
  }, [storyList, type?.story_type, lang]);

  if (!listData?.length) return null;

  return (
    <View style={styles.container}>
      {!storyList?.length ? null : (
        <>
          <AppText
            style={{
              fontSize: story_type_size ?? 20,
              color: toColor(story_type_color, colors.leftChatBackground),
              fontWeight: toFontWeight(story_type_weight),
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
