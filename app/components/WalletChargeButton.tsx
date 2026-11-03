// app/components/WalletChargeButton.tsx
// 錢包「加值 / Refill」鈕：個人資料頁與紀錄頁共用，外框與文字排版只在這裡定義。
//
// 文字刻意沿用 RN 預設排版（與登入鍵等其他按鈕相同），不加 includeFontPadding:false /
// lineHeight / numberOfLines：Android 的字型留白是用來容納中文等後備字型的字形，
// 拿掉或改由 lineHeight 控制高度時，部分機型中文字底部會被文字框切掉。
// 垂直置中交給外框的 alignItems / justifyContent；外框只設下限，文字較寬或系統字級放大時依內容撐開。
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import useResponsive from '../hook/useResponsive';
import { translate } from '../i18n/i18n';
import { walletActionFontSize } from '../utils/walletFont';

const MIN_WIDTH = 76;
const MIN_HEIGHT = 38;

type Props = {
  onPress: () => void;
};

export default function WalletChargeButton({ onPress }: Props) {
  const { ms } = useResponsive();

  return (
    <Pressable
      style={[styles.button, { minWidth: ms(MIN_WIDTH), minHeight: ms(MIN_HEIGHT) }]}
      onPress={onPress}
    >
      <Text style={[styles.text, { fontSize: walletActionFontSize(ms) }]}>
        {translate('profileTopUp')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#ff3344',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    // 不收縮：flexShrink:1 會把外框壓得比文字窄而切字
    flexShrink: 0,
  },
  text: { color: '#fff', fontWeight: '700' },
});
