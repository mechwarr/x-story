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
import { getBookstoreList, getEffectiveRoleLevel } from '../config/userApiClient';
import { canViewUnlisted } from '../config/roles';
import { fetchStoryOrderMap, makeSavedStoryComparator } from '../utils/bookOrder';

function ContinueScreen() {
  const [storyCache, setStoryCache] = useState(null);
  // 書籍 id → 現況 order 對照表。本頁資料來自本機存檔（快照可能沒有 order、或 order 已被後台改過），
  // 故每次聚焦另外查一次 story-list 取得現況 order；取不到時（null）退回存檔快照裡的 order。
  const [orderMap, setOrderMap] = useState(null);
  // 書籍可見性判定用：roleLevel（是否為 role>=5 可見未上架者）＋ 目前「在架書籍」ID 集合。
  // onShelfIds 為 null 代表尚未取得（抓取中／失敗）→ 不誤擋，以免整頁清空。
  const [shelf, setShelf] = useState({ roleLevel: null, onShelfIds: null });
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

  // 取得角色權限與「在架書籍」清單（每次聚焦刷新）：
  // 後台書籍「下架／刪除」後，公開 GET api/bookstorelist 便不再回傳該書（或回傳 isActive=false），
  // 據此把已不在架的書從「繼續觀看」清單隱藏——role>=5（小編／管理員）預覽者不受限、仍全部可見。
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

  // 依目前語系與「在架狀態」過濾：
  //  - 語系：書籍 lang 取自存檔的 storyData（與首頁同一來源欄位），舊存檔無 storyData.lang 時退回 item.lang。
  //  - 在架：role<5 的一般用戶僅顯示仍在架的書（隱藏已下架／刪除者）；role>=5 全部可見；
  //          在架清單尚未取得（onShelfIds 為 null）時不誤擋，一律顯示（Book 點擊時仍有 canContinueOwned 二次守門）。
  const continueStories = useMemo(() => {
    const list = storyCache?.continueStory ?? [];
    if (!Array.isArray(list)) return [];
    const canSeeUnlisted = canViewUnlisted(shelf.roleLevel);
    return list
      .filter((item) => {
        if (!matchesCurrentStoryLang(item?.storyData?.lang ?? item?.lang)) return false;
        if (canSeeUnlisted) return true;
        if (!shelf.onShelfIds) return true;
        return shelf.onShelfIds.has(Number(item?.storyId));
      })
      // 依 order 排序（取代原本的 AsyncStorage 插入順序），與首頁一致。
      // filter 已產生新陣列，sort 不會改動 storyCache 內的原始清單。
      .sort(makeSavedStoryComparator(orderMap));
  }, [storyCache, lang, shelf, orderMap]);

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
