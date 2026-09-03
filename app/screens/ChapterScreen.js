import { FlatList, SafeAreaView, View, StyleSheet, AppState } from 'react-native';
import React, { useCallback, useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import ChapterItem from '../components/ChapterItem';
import useResponsive from '../hook/useResponsive';
import StoryHeader from '../components/StoryHeader';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import apiclient from '../config/apiClient';
import { useCoins } from '../store/coinContext';
import { resolveOwnedStoryIds } from '../services/bookAccessService';
import { getEffectiveRoleLevel } from '../config/userApiClient';
import { canPreviewAll } from '../config/roles';
import { pickConfigByLang } from '../i18n/i18n';
import { toColor } from '../config/normalizeStyle';
import { useLanguage } from '../i18n/LanguageContext';

const ChapterScreen = () => {
  const [queryInfo, setQueryInfo] = useState({
    listData: [],
    toastConfig: {},
  });
  const [localPurchasedIds, setLocalPurchasedIds] = useState([]);
  // role >= 5（小編／管理員）：可完整預覽、不需購買、不受試閱設定限制（需求 5/6）。
  const [isAdminUser, setIsAdminUser] = useState(false);
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
    // 以伺服器 entitlements 為權威來源：被移除書單（撤銷授權）的付費書會回到鎖定、需重新購買（需求 10）。
    // 線上失敗時退回本地快取，避免誤擋合法持有者。
    const { ids: ownedIds, authoritative } = await resolveOwnedStoryIds();
    // 診斷用：isAdminUser=true（role>=5）代表預覽者、章節刻意不上鎖；owned=true 代表後端仍回傳此書。
    console.log('[ChapterScreen] 持有權確認 →', {
      storyId: Number(storyId), owned: ownedIds.includes(Number(storyId)), authoritative, isAdminUser, ownedIds,
    });
    setLocalPurchasedIds((prev) => {
      // 權威結果 → 直接採用（才反映得出「被移除書單」的撤銷）。
      if (authoritative) return ownedIds;
      // 未知（entitlements 取不到：離線／逾時／非 2xx）→ 只補、不降級：ownedIds 此時僅是本地
      // 樂觀快取，「不在清單內」不代表未持有。若直接覆寫，一次網路失敗就會把已購買者的章節
      // 全部鎖上，看起來像「買過的書要求重買」。刻意不做成「未知即全部解鎖」——那會讓未購買者
      // 離線就能繞過閘門（且 StoryScreen 仍會擋，反而變成點進去又被彈回）。
      const merged = new Set(prev.map(Number));
      ownedIds.forEach((id) => merged.add(Number(id)));
      return Array.from(merged);
    });
  }, [storyId, isAdminUser]);

  // 解析目前使用者是否可完整預覽（role >= 5，小編／管理員）；於此統一取一次並下傳給各章節項，
  // 避免每個 ChapterItem 各自查詢。
  useEffect(() => {
    let mounted = true;
    getEffectiveRoleLevel().then((lv) => { if (mounted) setIsAdminUser(canPreviewAll(lv)); });
    return () => { mounted = false; };
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
      isAdmin={isAdminUser}
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
    // storyId 必須在依賴內：章節清單是 api/v1/admin/chapter/{storyId}。
    // Drawer 未設 unmountOnBlur，本畫面切走後仍留在 HOME 這個 Stack，之後 navigate 進來會回到
    // 這個既有實例、只更新 route.params——只依賴 lang 的話，換一本書進來會沿用上一本的章節清單
    //（點下去就是錯書錯章）。同一次掛載內 storyId 不變，不會造成多餘的重抓。
  }, [lang, storyId]);

  useFocusEffect(
    useCallback(() => {
      refreshPurchasedIds();
    }, [refreshPurchasedIds])
  );

  // App 由背景回前景時，重新以權威來源確認持有：期間被移除書單的付費書會回到鎖定、
  // 點該章即跳購買（需求 10 / 外部回來聚焦刷新）。
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refreshPurchasedIds();
    });
    return () => sub.remove();
  }, [refreshPurchasedIds]);

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
