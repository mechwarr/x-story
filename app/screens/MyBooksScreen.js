import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, FlatList, View } from 'react-native';
import axios from 'axios';
import { useIsFocused } from '@react-navigation/native';
import { isEmpty } from 'lodash';

import AppHeader from '../components/AppHeader';
import Screen from './Screen';
import Content from './Content';
import AppText from '../components/AppText';
import Book from '../components/Book/Book';
import colors from '../config/colors';
import storage from '../storage/storage';
import { bookDataBaseUrl } from '../config/apiClient';
import { getAuthoritativeOwnedStoryIds } from '../services/bookAccessService';
import {
  translate,
  matchesCurrentStoryLang,
  pickConfigByLang,
} from '../i18n/i18n';
import { useLanguage } from '../i18n/LanguageContext';

// 書籍資料端點統一走 bookDataBaseUrl（與 HomeScreen 同源），固定走正式站、不隨 __DEV__ 切換。
const url = bookDataBaseUrl;

// 「我的書籍」：以伺服器 entitlements（getAuthoritativeOwnedStoryIds）為權威來源，
// 取出使用者實際持有的書，並與 story-list（含完整 storyData）交集後呈現。
// 排版與「繼續觀看」一致（2 欄 Book 網格）；點擊沿用 Book 一般變體邏輯，
// 開啟與大廳相同的簡介彈窗（樣式來自 menu-foolproof、字樣依語系挑列）。
function MyBooksScreen() {
  const isFocus = useIsFocused();
  // 目前語系：切換時重新過濾書單，只顯示與 App 語系相符的書（與大廳／繼續觀看一致）。
  const { lang } = useLanguage();

  const [ownedIds, setOwnedIds] = useState([]);
  const [storyList, setStoryList] = useState([]);
  const [menuFoolproofConfig, setMenuFoolproofConfig] = useState({});
  const [nochapter, setNochapter] = useState([]);
  const [storyCache, setStoryCache] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 權威持有清單（自動翻頁、bypassCache；線上失敗時退回本地快取）。
        const owned = await getAuthoritativeOwnedStoryIds();
        setOwnedIds(owned);

        // story-list 公開 API：含每本書完整 storyData（main_menu_* / open / chapter_type / lang），
        // 供簡介彈窗與排版，與大廳同源。
        const storyRes = await axios
          .get(url + 'api/v1/admin/story-list')
          .catch(() => ({ data: [] }));
        setStoryList(storyRes?.data ?? []);

        // 主選單-防呆視窗參數：簡介彈窗的標題／內文／按鈕字樣，依語系挑列（與 HomeScreen 一致）。
        const menuFoolproof = await axios
          .get(url + 'api/v1/admin/menu-foolproof')
          .catch(() => ({ data: [] }));
        setMenuFoolproofConfig(pickConfigByLang(menuFoolproof?.data) ?? {});

        // 無章節試閱參數：Book 的 goToStart / storyPayload 需要（無章節書的 read_range_end / free_open）。
        const nochapterRes = await axios
          .get(url + 'api/v1/admin/nochapter')
          .catch(() => ({ data: [] }));
        setNochapter(nochapterRes?.data ?? []);
      } catch (error) {
        console.error('API 請求失敗「MyBooksScreen」：', error.message);
      }
    };
    async function getStories() {
      // 供 Book 判斷 new/read/finish 狀態，避免持有書籍誤顯示「new」標記。
      const finishStory = await storage.getStorys('finishStory');
      const continueStory = await storage.getStorys('continueStory');
      setStoryCache({ finishStory, continueStory });
    }
    fetchData();
    getStories();
  }, [isFocus]);

  // 持有 ∩ 書單，並依目前語系過濾（避免同書多語版本重複顯示）。
  const myBooks = useMemo(() => {
    const ownedSet = new Set((ownedIds || []).map(Number));
    return (storyList || []).filter(
      (b) => ownedSet.has(Number(b?.id)) && matchesCurrentStoryLang(b?.lang)
    );
  }, [ownedIds, storyList, lang]);

  return (
    <Screen>
      <AppHeader />
      <Content>
        <View style={styles.books}>
          {isEmpty(myBooks) ? (
            <AppText style={styles.noBooks}>{translate('noMyBooks')}</AppText>
          ) : (
            <FlatList
              data={myBooks}
              keyExtractor={(item) => item?.id?.toString()}
              numColumns={2}
              renderItem={({ item }) => (
                <Book
                  storyData={item}
                  storyCache={storyCache}
                  nochapter={nochapter}
                  menuFoolproofConfig={menuFoolproofConfig}
                />
              )}
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
  },
});

export default MyBooksScreen;
