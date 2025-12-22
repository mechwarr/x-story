import React from 'react';
import { View, StyleSheet, Image, Pressable, Text, Platform } from 'react-native';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import routes from '../navigations/routes';
import AppText from './AppText';

function AppHeader({ news, config, onNewsPress }) {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      {/* 左邊 Drawer 開關 */}
      <Pressable
        onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        hitSlop={8}
      >
        <Image
          style={styles.leftIcon}
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
        <Image style={styles.profileIcon} source={require('../../assets/profile.png')} />
        <View style={styles.coinRow}>
          <Image style={styles.coinIcon} source={require('../../assets/coin.png')} />
          <Text style={styles.coinText}>999</Text>
        </View>
      </Pressable>
    </View>
  );
}

const HEADER_HEIGHT = 50;

const styles = StyleSheet.create({
  container: {
    width: '100%', // 撐滿整個螢幕
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', // 左右分散
    paddingHorizontal: 10,
  },
  leftIcon: { width: 32, height: 32 },
  newsContainer: {
    flex: 1,
    marginHorizontal: 10,
    justifyContent: 'center',
  },
  rightContainer: {
    alignItems: 'center',
  },
  profileIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginBottom: 2,
  },
  coinRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coinIcon: { width: 20, height: 20, marginRight: 4 },
  coinText: { fontSize: 16, fontWeight: 'bold', color: "#f0ad57", },
});

export default AppHeader;
