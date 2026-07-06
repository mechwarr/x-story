import React, { useEffect } from 'react';
import { View, StyleSheet, Image, Pressable, Text, Platform } from 'react-native';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import routes from '../navigations/routes';
import NewsMarquee from './NewsMarquee';
import { useCoins } from '../store/coinContext';
import useResponsive from '../hook/useResponsive';
import { HEADER_ICON_BASE_SIZE } from '../config/responsive';

function AppHeader({ news, config, onNewsPress }) {
  const navigation = useNavigation();
  const { coins, refreshCoins } = useCoins();
  const { horizontalPadding, ms } = useResponsive();
  const iconSize = ms(HEADER_ICON_BASE_SIZE);
  const coinIconSize = ms(20);
  const headerHeight = Math.max(50, ms(50));

  // 組件掛載時刷新金幣餘額
  useEffect(() => {
    refreshCoins();
  }, [refreshCoins]);

  return (
    <View style={[styles.container, { height: headerHeight, paddingHorizontal: horizontalPadding }]}>
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

      {/* 中間新聞文字（跑馬燈：由右進、往左出、輪迴播放） */}
      {news ? (
        <Pressable
          style={styles.newsContainer}
          onPress={onNewsPress}
        >
          <NewsMarquee
            text={news}
            textStyle={{
              color: config?.news_color ?? '#fff',
              fontSize: config?.news_font_size ?? 20,
              ...(config?.news_weight === '粗' && {
                fontWeight: Platform.OS === 'ios' ? 600 : 'bold',
              }),
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
