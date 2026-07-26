import React, { useState, useEffect, useMemo } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

import AppHeader from '../components/AppHeader';
import AppText from '../components/AppText';

import Screen from './Screen';

import Content from './Content';
import colors from '../config/colors';
import storage from '../storage/storage';
import Book from '../components/Book/Book';
import { isEmpty } from 'lodash';
import { translate, matchesCurrentStoryLang } from '../i18n/i18n';
import { useLanguage } from '../i18n/LanguageContext';
import { getBookstoreList, getEffectiveRoleLevel } from '../config/userApiClient';
import { canViewUnlisted } from '../config/roles';
import { fetchStoryOrderMap, makeSavedStoryComparator } from '../utils/bookOrder';

// 「重新回味」：呈現已讀完（finishStory）的書。過濾規則與「繼續觀看」（ContinueScreen）一致：
//  - 語系：只顯示與目前 App 語系相符的書。
//  - 在架：role<5 的一般用戶僅顯示仍在架的書；role>=5 全部可見；在架清單尚未取得時不誤擋。
//  - 互斥：已在「繼續觀看」清單（重讀後又產生新進度）的書不再顯示於此，
//          兩頁不會同時出現同一本書（資料層 storage 亦已維護，此處為顯示層防呆兼清舊快取）。
function ReviewScreen() {
  const [storyCache, setStoryCache] = useState({ finishStory: null, continueStory: null });
  // 書籍可見性判定用：roleLevel（是否為 role>=5 可見未上架者）＋ 目前「在架書籍」ID 集合。
  // onShelfIds 為 null 代表尚未取得（抓取中／失敗）→ 不誤擋，以免整頁清空。
  const [shelf, setShelf] = useState({ roleLevel: null, onShelfIds: null });
  // 書籍 id → 現況 order 對照表（與 ContinueScreen 同一來源與理由：存檔快照的 order 可能缺漏或過時）。
  const [orderMap, setOrderMap] = useState(null);
  const isFocus = useIsFocused();
  // 目前語系：納入篩選依賴，切換語系時重新過濾清單（與首頁 Books／繼續觀看一致）。
  const { lang } = useLanguage();

  useEffect(() => {
    async function getStories() {
      const finishStory = await storage.getStorys('finishStory');
      const continueStory = await storage.getStorys('continueStory');
      setStoryCache({ finishStory, continueStory });
    }
    getStories();
  }, [isFocus]);

  // 取得角色權限與「在架書籍」清單（每次聚焦刷新）：與 ContinueScreen 同一來源與規則，
  // 後台書籍下架／刪除後，公開 GET api/bookstorelist 不再回傳（或回傳 isActive=false），據此隱藏。
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const roleLevel = await getEffectiveRoleLevel();
        const [list, map] = await Promise.all([
          getBookstoreList(),
          fetchStoryOrderMap(),
        ]);
        const onShelfIds = Array.isArray(list)
          ? new Set(
              list
                .filter((b) => b?.isActive !== false)
                .map((b) => Number(b?.storyListId))
            )
          : null;
        if (mounted) {
          setShelf({ roleLevel, onShelfIds });
          setOrderMap(map);
        }
      } catch (_e) {
        if (mounted) setShelf({ roleLevel: null, onShelfIds: null });
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isFocus]);

  const reviewStories = useMemo(() => {
    const list = storyCache?.finishStory ?? [];
    if (!Array.isArray(list)) return [];
    // 互斥：已有「繼續觀看」進度的書（storyId 命中）不顯示於回味頁。
    const continueIds = new Set(
      (Array.isArray(storyCache?.continueStory) ? storyCache.continueStory : [])
        .map((it) => Number(it?.storyId))
    );
    const canSeeUnlisted = canViewUnlisted(shelf.roleLevel);
    return list
      .filter((item) => {
        if (continueIds.has(Number(item?.storyId))) return false;
        if (!matchesCurrentStoryLang(item?.storyData?.lang ?? item?.lang)) return false;
        if (canSeeUnlisted) return true;
        if (!shelf.onShelfIds) return true;
        return shelf.onShelfIds.has(Number(item?.storyId));
      })
      // 依 order 排序（取代原本的 AsyncStorage 插入順序），與首頁一致。
      .sort(makeSavedStoryComparator(orderMap));
  }, [storyCache, lang, shelf, orderMap]);

  return (
    <Screen>
      <AppHeader />
      <Content>
        <View style={styles.books}>
          {isEmpty(reviewStories) ? (
            <AppText style={styles.noBooks}>{translate('noBooksFinished')}</AppText>
          ) : (
            <FlatList
              data={reviewStories}
              keyExtractor={(item) => item?.storyId?.toString()}
              numColumns={2}
              renderItem={({ item }) => <Book {...item} showReviewIcon={true} />}
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
    color: colors.leftChatBackground,
    fontSize: 20,
    fontWeight: 'bold',
  },
});

export default ReviewScreen;
