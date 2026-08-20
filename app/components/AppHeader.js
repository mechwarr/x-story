import React, { useEffect } from 'react';
import { View, StyleSheet, Image, Pressable, Text } from 'react-native';
import { toColor, toFontWeight } from '../config/normalizeStyle';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import routes from '../navigations/routes';
import NewsMarquee from './NewsMarquee';
import { useCoins } from '../store/coinContext';
import useResponsive from '../hook/useResponsive';
import useHeaderMetrics from '../hook/useHeaderMetrics';

function AppHeader({ news, config, onNewsPress }) {
  const navigation = useNavigation();
  const { coins, refreshCoins } = useCoins();
  const { ms } = useResponsive();
  // 首頁頂欄＝全站藍眼位置的基準，尺寸／留白統一由 useHeaderMetrics 提供
  //（內頁 ScreenTopBar、左側 Drawer、登入頁 HeaderEyeLogo 都讀同一份數值）。
  const { iconSize, rowHeight: headerHeight, rowPaddingHorizontal } = useHeaderMetrics();
  const coinIconSize = ms(20);

  // 組件掛載時刷新金幣餘額
  useEffect(() => {
    refreshCoins();
  }, [refreshCoins]);

  return (
    <View style={[styles.container, { height: headerHeight, paddingHorizontal: rowPaddingHorizontal }]}>
      {/* 左邊 Drawer 開關 */}
      <Pressable
        onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        hitSlop={8}
      >
        <Image
          style={[styles.leftIcon, { width: iconSize, height: iconSize }]}
          source={require('../../assets/blueeye.png')}
        />
      </Pressable>

      {/* 中間新聞文字（跑馬燈：多則訊息逐則由右進、往左出，全部播完再循環） */}
      {news?.length ? (
        <Pressable
          style={styles.newsContainer}
          onPress={onNewsPress}
        >
          <NewsMarquee
            text={news}
            textStyle={{
              color: toColor(config?.news_color),
              fontSize: config?.news_font_size ?? 20,
              fontWeight: toFontWeight(config?.news_weight),
            }}
          />
        </Pressable>
      ) : null}

      {/* 右邊 Profile + Coin */}
      {/* PROFILE 只註冊在 HOME 內層的 StoryNavigator；AppHeader 也會被掛在 drawer 層
          的畫面（如語系設定頁）使用，若直接 navigate(PROFILE) 會因不在同一導覽樹而失效。
          統一改用巢狀目標導向 HOME 內的 PROFILE，確保各頁右上角 Profile 行為與首頁一致。 */}
      <Pressable
        style={styles.rightContainer}
        onPress={() => navigation.navigate(routes.HOME, { screen: routes.PROFILE })}
        hitSlop={8}
      >
        <Image style={[styles.profileIcon, { width: iconSize, height: iconSize, borderRadius: iconSize / 2 }]} source={require('../../assets/profile.png')} />
        <View style={styles.coinRow}>
          <Image style={[styles.coinIcon, { width: coinIconSize, height: coinIconSize }]} source={require('../../assets/coin.png')} />
          <Text style={styles.coinText}>{coins}</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftIcon: {},
  newsContainer: {
    flex: 1,
    marginHorizontal: 10,
    justifyContent: 'center',
  },
  rightContainer: {
    alignItems: 'center',
  },
  profileIcon: {
    marginBottom: 2,
  },
  coinRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coinIcon: { marginRight: 4 },
  coinText: { fontSize: 16, fontWeight: 'bold', color: "#f0ad57", },
});

export default AppHeader;
