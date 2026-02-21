import React, { useEffect } from 'react';
import { View, StyleSheet, Image, Pressable, Text, Platform } from 'react-native';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import routes from '../navigations/routes';
import AppText from './AppText';
import { useCoins } from '../store/coinContext';
import useResponsive from '../hook/useResponsive';

function AppHeader({ news, config, onNewsPress }) {
  const navigation = useNavigation();
  const { coins, refreshCoins } = useCoins();
  const { horizontalPadding, scale } = useResponsive();
  const iconSize = Math.round(32 * scale);
  const coinIconSize = Math.round(20 * scale);
  const headerHeight = Math.max(50, Math.round(50 * scale));

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

      {/* 中間新聞文字 */}
      {news ? (
        <Pressable 
          style={styles.newsContainer}
          onPress={onNewsPress}
        >
          <AppText
            style={{
              flex: 1,
              flexWrap: 'wrap',
              color: config?.[0]?.news_color ?? '#fff',
              fontSize: config?.[0]?.news_font_size ?? 20,
              ...(config?.[0]?.news_weight === '粗' && {
                fontWeight: Platform.OS === 'ios' ? 600 : 'bold',
              }),
            }}
          >
            {news}
          </AppText>
        </Pressable>
      ) : null}

      {/* 右邊 Profile + Coin */}
      <Pressable
        style={styles.rightContainer}
        onPress={() => navigation.navigate(routes.PROFILE)}
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
