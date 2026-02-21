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

type TabKey = 'coin' | 'purchase';

export default function HistoryScreen() {
  const [tab, setTab] = useState<TabKey>('coin');
  const navigation = useNavigation();
  const { isTablet, maxContentWidth, horizontalPadding, scale } = useResponsive();
  const iconSize = Math.round(36 * scale);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.topBar, { paddingTop: 8, paddingHorizontal: horizontalPadding }]}>
        <Pressable onPress={() => navigation.navigate(routes.MAIN as never)} hitSlop={8}>
          <Image style={[styles.eyeIcon, { width: iconSize, height: iconSize }]} source={require('../../assets/blueeye.png')} />
        </Pressable>
        <Pressable onPress={() => navigation.navigate(routes.PROFILE as never)} hitSlop={8}>
          <Image style={[styles.profileIcon, { width: iconSize * 0.9, height: iconSize * 0.9, borderRadius: (iconSize * 0.9) / 2 }]} source={require('../../assets/profile.png')} />
        </Pressable>
      </View>


      <View style={[styles.contentWrap, isTablet && { maxWidth: maxContentWidth, alignSelf: 'center', width: '100%', paddingHorizontal: horizontalPadding }]}>
      <View style={styles.segmentBar}>
        <SegmentButton
          label="金幣紀錄"
          active={tab === 'coin'}
          onPress={() => setTab('coin')}
        />
        <SegmentButton
          label="購買記錄"
          active={tab === 'purchase'}
          onPress={() => setTab('purchase')}
        />
      </View>

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

  topBar: {
    width: '100%',
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  eyeIcon: {},
  profileIcon: {},

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
  content: { flex: 1, paddingTop: 6 },
});
