// app/screens/HistoryScreen.tsx
import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import CoinHistoryScreen from './CoinHistoryScreen';
import PurchaseHistoryScreen from './PurchaseHistoryScreen';
import routes from '../navigations/routes';
import useResponsive from '../hook/useResponsive';
import ScreenTopBar from '../components/ScreenTopBar';
import { translate } from '../i18n/i18n';
import { walletActionFontSize } from '../utils/walletFont';

type TabKey = 'coin' | 'purchase';

export default function HistoryScreen() {
  const [tab, setTab] = useState<TabKey>('coin');
  const navigation = useNavigation();
  const { isTablet, maxContentWidth, horizontalPadding, ms } = useResponsive();
  // 與 ProfileScreen 的「加值」鈕字級一致（英文 Refill 不再沿用 RN 預設 14）
  const walletFontSize = walletActionFontSize(ms);

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenTopBar
        onEyePress={() => navigation.navigate(routes.MAIN as never)}
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

      {tab === 'purchase' && (
        <View style={styles.chargeRow}>
          <Image style={styles.coinIcon} source={require('../../assets/coin.png')} />
          <Pressable
            style={styles.chargeBtn}
            onPress={() => navigation.navigate(routes.PURCHASE as never)}
          >
            <Text
              style={[styles.chargeText, { fontSize: walletFontSize }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {translate('profileTopUp')}
            </Text>
          </Pressable>
        </View>
      )}

      <View style={styles.content}>
        {tab === 'coin' ? (
          <CoinHistoryScreen embedded />
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
    paddingVertical: 8,
  },
  coinIcon: { width: 18, height: 18 },
  chargeBtn: {
    backgroundColor: '#ff3344',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  chargeText: { color: '#fff', fontWeight: '700' },
  content: { flex: 1, paddingTop: 6 },
});
