// app/components/NoDataRetryView.tsx
// 「沒有資料」共用整頁狀態：頂欄只留藍眼，畫面正中一行說明 + 綠色「重試」膠囊鈕。
// 取不到資料時一律用這個取代頁面原本的完整版面（不顯示標題、餘額、表單、診斷文字等），
// 各頁只需依問題種類傳入對應的 message。
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import ScreenTopBar from './ScreenTopBar';
import useResponsive from '../hook/useResponsive';
import { translate } from '../i18n/i18n';

type Props = {
  message: string;
  onRetry: () => void;
  onEyePress?: () => void;
};

export default function NoDataRetryView({ message, onRetry, onEyePress }: Props) {
  const { horizontalPadding, ms } = useResponsive();

  return (
    <View style={styles.safe}>
      <ScreenTopBar onEyePress={onEyePress} />
      <View style={[styles.body, { paddingHorizontal: horizontalPadding }]}>
        <Text style={[styles.message, { fontSize: ms(17) }]}>{message}</Text>
        <Pressable style={styles.retryBtn} onPress={onRetry}>
          <Text style={[styles.retryBtnText, { fontSize: ms(16) }]}>{translate('retry')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#2b2f33' },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    color: '#e7eef6',
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 16,
    backgroundColor: '#00a99d',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  retryBtnText: {
    color: '#eafff9',
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
