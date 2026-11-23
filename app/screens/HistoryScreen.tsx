// app/screens/HistoryScreen.tsx
import React, { useCallback, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import CoinHistoryScreen from './CoinHistoryScreen';
import PurchaseHistoryScreen from './PurchaseHistoryScreen';
import routes from '../navigations/routes';
import navigateHome from '../navigations/navigateHome';
import { useCoins } from '../store/coinContext';
import useResponsive from '../hook/useResponsive';
import ScreenTopBar from '../components/ScreenTopBar';
import WalletChargeButton from '../components/WalletChargeButton';
import { translate } from '../i18n/i18n';
import { walletActionFontSize } from '../utils/walletFont';

type TabKey = 'coin' | 'purchase';

export default function HistoryScreen() {
  const [tab, setTab] = useState<TabKey>('coin');
  const navigation = useNavigation();
  const { isTablet, maxContentWidth, horizontalPadding, ms } = useResponsive();
  const { coins, refreshCoins } = useCoins();
  // 金幣餘額與「加值」鈕同字級
  const walletFontSize = walletActionFontSize(ms);

  // 金幣餘額列只在金幣紀錄分頁顯示，回到本頁（例如加值完）就刷新
  useFocusEffect(
    useCallback(() => {
      refreshCoins();
    }, [refreshCoins])
  );

  // 金幣餘額與加值：排在「金幣紀錄」標題下方（標題 → 金幣列），加值導向代幣商城。
  // 交給 CoinHistoryScreen 插在標題後；取不到紀錄的錯誤頁不顯示
  const chargeRow = (
    <View style={styles.chargeRow}>
      {/* 三欄：左右兩側等寬（flex:1）→ 中間的金幣餘額恆在正中央；加值鈕靠右欄起點緊貼金幣 */}
      <View style={styles.chargeSide} />
      <View style={styles.balanceBox}>
        <Image style={styles.coinIcon} source={require('../../assets/coin.png')} />
        <Text style={[styles.coinCount, { fontSize: walletFontSize }]} numberOfLines={1}>{coins}</Text>
      </View>
      <View style={[styles.chargeSide, styles.chargeSideRight]}>
        <WalletChargeButton onPress={() => navigation.navigate(routes.PURCHASE as never)} />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenTopBar
        onEyePress={() => navigateHome(navigation)}
        onProfilePress={() => navigation.navigate(routes.PROFILE as never)}
      />


      <View style={[styles.contentWrap, isTablet && { maxWidth: maxContentWidth, alignSelf: 'center', width: '100%', paddingHorizontal: horizontalPadding }]}>
      <View style={styles.segmentBar}>
        <SegmentButton
          label={translate('coinHistory')}
          active={tab === 'coin'}
          onPress={() => setTab('coin')}
        />
        <SegmentButton
          label={translate('transactionHistory')}
          active={tab === 'purchase'}
          onPress={() => setTab('purchase')}
        />
      </View>

      <View style={styles.content}>
        {tab === 'coin' ? (
          <CoinHistoryScreen embedded belowTitle={chargeRow} />
        ) : (
          <PurchaseHistoryScreen embedded />
        )}
      </View>
      </View>
    </SafeAreaView>
  );
}

function SegmentButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.segBtn,
        active && styles.segBtnActive,
        pressed && { opacity: 0.9 },
      ]}
    >
      <Text style={[styles.segText, active && styles.segTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#2b2f33' },

  contentWrap: {
    flex: 1,
  },
  segmentBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  segBtn: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4a4f55',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2f3338',
  },
  segBtnActive: {
    backgroundColor: '#00a99d',
    borderColor: '#00a99d',
  },
  segText: { color: '#cfd7df', fontWeight: '700' },
  segTextActive: { color: '#eafff9' },
  chargeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  // flexBasis:0 讓左右兩欄不受內容（加值鈕）寬度影響、嚴格等寬，金幣才會真的置中
  chargeSide: { flex: 1, flexBasis: 0, minWidth: 0 },
  chargeSideRight: { flexDirection: 'row', justifyContent: 'flex-start' },
  balanceBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  coinIcon: { width: 18, height: 18 },
  coinCount: { color: '#e7eef6', fontWeight: '700' },
  content: { flex: 1, paddingTop: 6 },
});
