import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { StyleSheet, FlatList, View, Pressable } from 'react-native';
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
import { resolveOwnedStoryIds } from '../services/bookAccessService';
import { translate, pickConfigByLang } from '../i18n/i18n';
import { compareBookByOrder } from '../utils/bookOrder';

// 書籍資料端點統一走 bookDataBaseUrl（與 HomeScreen 同源），固定走正式站、不隨 __DEV__ 切換。
const url = bookDataBaseUrl;

// 「我的書籍」：以伺服器 entitlements（resolveOwnedStoryIds）為權威來源，
// 取出使用者實際持有的書，並與 story-list（含完整 storyData）交集後呈現。
// 呈現「所有購買過的書」，不依語系過濾——各語言版本皆會顯示，方便用戶查找。
// 排版與「繼續觀看」一致（2 欄 Book 網格）；點擊沿用 Book 一般變體邏輯，
// 開啟與大廳相同的簡介彈窗（樣式來自 menu-foolproof、字樣依語系挑列）。
function MyBooksScreen() {
  const isFocus = useIsFocused();

  const [ownedIds, setOwnedIds] = useState([]);
  // 持有清單「取不到」（離線／逾時／非 2xx）時為 true：此時的 ownedIds 只是本地樂觀快取，
  // 空清單不代表「沒買過書」。用來把「真的沒解鎖任何書」與「這次查不到」分開呈現，
  // 避免一次網路失敗就顯示成空書櫃（使用者會以為購買紀錄消失）。
  const [ownedUnknown, setOwnedUnknown] = useState(false);
  // 重試計數：使用者按「重試」時 +1，觸發下方的資料 effect 重跑。
  const [reloadTick, setReloadTick] = useState(0);
  const [storyList, setStoryList] = useState([]);
  const [menuFoolproofConfig, setMenuFoolproofConfig] = useState({});
  const [nochapter, setNochapter] = useState([]);
  const [storyCache, setStoryCache] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 權威持有清單（自動翻頁、bypassCache；線上失敗時退回本地快取並標記為「未知」）。
        const { ids: owned, authoritative } = await resolveOwnedStoryIds();
        setOwnedIds(owned);
        setOwnedUnknown(!authoritative);

        // story-list 公開 API：含每本書完整 storyData（main_menu_* / open / chapter_type / lang），
        // 供簡介彈窗與排版，與大廳同源。取不到時同樣標記為「未知」——持有清單查得到、
        // 但書單查不到，交集一樣是空的，此時仍不可說「尚未解鎖任何書籍」。
        const storyRes = await axios
          .get(url + 'api/v1/admin/story-list')
          .catch(() => null);
        if (!storyRes) setOwnedUnknown(true);
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
  }, [isFocus, reloadTick]);

  const retry = useCallback(() => setReloadTick((n) => n + 1), []);

  // 持有 ∩ 書單。書櫃需呈現「所有購買過的書」（含各語言版本），不依語系過濾，
  // 方便用戶查找所有購買過的語言版本（各語言版本為各自獨立的 story，非重複資料）。
  // 排序依後端 order（"001"、"002"…）；本頁不依語系過濾，同一 order 必然撞號
  //（001繁 / 001简 / 001En），故次要排序為 繁體 → 簡體 → 英文，讓同一本書的各語言版本相鄰。
  const myBooks = useMemo(() => {
    const ownedSet = new Set((ownedIds || []).map(Number));
    return (storyList || [])
      .filter((b) => ownedSet.has(Number(b?.id)))
      .sort(compareBookByOrder);
  }, [ownedIds, storyList]);

  return (
    <Screen>
      <AppHeader />
      <Content>
        <View style={styles.books}>
          {isEmpty(myBooks) && ownedUnknown ? (
            // 查不到持有清單且沒有任何可顯示的書：明講「載入失敗」並提供重試，
            // 不可沿用「尚未解鎖任何書籍」——那會把網路異常誤說成使用者沒買過書。
            <View>
              <AppText style={styles.noBooks}>{translate('myBooksLoadFailed')}</AppText>
              <Pressable onPress={retry} hitSlop={12}>
                <AppText style={styles.retry}>{translate('retry')}</AppText>
              </Pressable>
            </View>
          ) : isEmpty(myBooks) ? (
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
  retry: {
    color: colors.white,
    fontSize: 20,
    marginTop: 12,
    textDecorationLine: 'underline',
  },
});

export default MyBooksScreen;
