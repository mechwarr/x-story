import { FlatList, SafeAreaView, View, StyleSheet, Pressable, Image, Alert } from 'react-native';
import React, { useCallback, useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { widthPercentageToDP as wp } from 'react-native-responsive-screen';
import ChapterItem from '../components/ChapterItem';
import StoryHeader from '../components/StoryHeader';
import AppText from '../components/AppText';
import { useRoute, useNavigation } from '@react-navigation/native';
import apiclient from '../config/apiClient';
import { purchaseStoryWithCoins } from '../config/userApiClient';
import { getOrCreateIdempotencyKey, clearIdempotencyKey } from '../config/idempotencyKeyCache';
import { useCoins } from '../store/coinContext';
import { translate } from '../i18n/i18n';
import routes from '../navigations/routes';
import colors from '../config/colors';
import storage from '../storage/storage';

const ChapterScreen = () => {
  const [queryInfo, setQueryInfo] = useState({
    listData: [],
    toastConfig: {},
  });
  const [localPurchasedIds, setLocalPurchasedIds] = useState([]);
  const route = useRoute();
  const navigation = useNavigation();

  const url = apiclient.currentBaseUrl();

  const { name, author, storyId, storyData, nochapter } = useMemo(
    () => route.params ?? { name: '', author: '', storyId: 1 },
    [route.params]
  );

  const { coins, refreshCoins } = useCoins();
  const priceCoins = storyData?.priceCoins ?? 0;
  // 有鎖頭 icon 的書（open !== '公開'）不顯示購買鍵；其餘顯示，但若已本地購買則隱藏
  const hasLockIcon = storyData?.open !== '公開';
  const isLocallyPurchased = localPurchasedIds.includes(Number(storyId));
  const showPurchaseButton = !hasLockIcon && !isLocallyPurchased;

  const handlePurchaseStory = useCallback(() => {
    if (!storyId) {
      Alert.alert('錯誤', '找不到故事 ID');
      return;
    }
    if (!priceCoins || priceCoins <= 0) {
      Alert.alert('提示', '此故事無法購買');
      return;
    }
    if (coins < priceCoins) {
      Alert.alert(
        '金幣不足',
        `此故事需要 ${priceCoins} 金幣，您目前有 ${coins} 金幣。\n請前往商城購買更多金幣。`,
        [
          { text: translate('cancel') || '取消', style: 'cancel' },
          {
            text: '前往商城',
            onPress: () => navigation.navigate(routes.HOME, { screen: routes.SHOP }),
          },
        ]
      );
      return;
    }
    Alert.alert(
      '確認購買',
      `確定要使用 ${priceCoins} 金幣購買「${name}」嗎？`,
      [
        { text: translate('cancel') || '取消', style: 'cancel' },
        {
          text: '確認購買',
          onPress: async () => {
            try {
              const idempotencyKey = await getOrCreateIdempotencyKey(storyId);
              const result = await purchaseStoryWithCoins({
                storyListId: storyId,
                idempotencyKey,
              });
              if (result) {
                await clearIdempotencyKey(storyId);
                await refreshCoins();
                await storage.addLocalPurchasedStoryId(storyId);
                setLocalPurchasedIds((prev) =>
                  prev.includes(Number(storyId)) ? prev : [...prev, Number(storyId)]
                );
                Alert.alert(
                  '購買成功',
                  `您已成功購買「${name}」！\n\n花費 ${result.coinsSpent || priceCoins} 金幣`,
                  [{ text: translate('ok') || '確定' }]
                );
              } else {
                Alert.alert('購買失敗', '請稍後再試');
              }
            } catch (error) {
              console.error('[ChapterScreen] 購買失敗:', error);
              Alert.alert('購買失敗', error?.message || '發生錯誤，請稍後再試');
            }
          },
        },
      ]
    );
  }, [storyId, priceCoins, coins, name, navigation, refreshCoins]);

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

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: queryInfo?.config?.[0]?.view_color ?? '#fff',
      }}
    >
      <StoryHeader
        storyName={name}
        author={author}
        config={queryInfo?.storyConfig}
      />

      {showPurchaseButton && (
        <View style={styles.purchaseButtonWrap}>
          <Pressable
            style={styles.purchaseButton}
            onPress={handlePurchaseStory}
          >
            <View style={styles.purchaseButtonRow}>
              <AppText style={styles.purchaseButtonText}>
                {translate('purchase')}
              </AppText>
              <Image
                style={styles.purchaseButtonCoin}
                source={require('../../assets/coin.png')}
              />
              <AppText style={styles.purchaseButtonText}>{priceCoins}</AppText>
            </View>
          </Pressable>
        </View>
      )}

      <FlatList
        data={queryInfo?.listData}
        keyExtractor={(item) => item?.id?.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ flexDirection: 'column', padding: 20 }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  purchaseButtonWrap: {
    width: wp('90%'),
    alignSelf: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  purchaseButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: colors.primary,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  purchaseButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  purchaseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  purchaseButtonCoin: {
    width: 18,
    height: 18,
  },
});

export default ChapterScreen;
