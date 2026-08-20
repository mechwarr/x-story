// app/components/DatePickerSheet.tsx
// 全站共用的日期選擇 bottom sheet（年 / 月 / 日 三欄滾輪），iOS 與 Android 共用同一份實作。
//
// 取代原本的 @react-native-community/datetimepicker：該套件的 locale 屬性只有 iOS 生效，
// Android 一律跟隨「裝置」語系，導致 App 切成簡中／英文時選擇器仍顯示裝置語言。
// 這裡所有文字（年月日單位、月份名、取消／確定）都由 translate() 與本檔案組出，三語完全受控。
//
// 欄位順序依語系調整：中文 年→月→日；英文 月→日→年（英語慣用序）。
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { translate, getCurrentLang } from '../i18n/i18n';
import useResponsive from '../hook/useResponsive';
import WheelPicker, { type WheelItem } from './WheelPicker';

/** 年份下限（沒給 minimumDate 時，往前推的年數） */
const DEFAULT_YEAR_SPAN = 120;

const EN_MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

type Props = {
  visible: boolean;
  /** 目前值；null 表示尚未設定，開啟時以 defaultValue 定位 */
  value: Date | null;
  /** 未設定時滾輪的起始定位 */
  defaultValue: Date;
  minimumDate?: Date;
  maximumDate?: Date;
  onCancel: () => void;
  onConfirm: (date: Date) => void;
};

/** 該年月的天數（用第 0 天取上個月最後一天的技巧） */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let i = from; i <= to; i += 1) out.push(i);
  return out;
}

export default function DatePickerSheet({
  visible,
  value,
  defaultValue,
  minimumDate,
  maximumDate,
  onCancel,
  onConfirm,
}: Props) {
  const insets = useSafeAreaInsets();
  const { ms } = useResponsive();
  const isEn = getCurrentLang() === 'en';

  const itemHeight = ms(40);
  const wheelFontSize = ms(18);

  const maxYear = maximumDate ? maximumDate.getFullYear() : new Date().getFullYear();
  const minYear = minimumDate ? minimumDate.getFullYear() : maxYear - DEFAULT_YEAR_SPAN;

  const [year, setYear] = useState<number>(maxYear);
  const [month, setMonth] = useState<number>(1);
  const [day, setDay] = useState<number>(1);

  // 每次開啟都以現有值（或預設值）重新定位，避免沿用上一次未確定的暫存
  useEffect(() => {
    if (!visible) return;
    const base = value ?? defaultValue;
    setYear(base.getFullYear());
    setMonth(base.getMonth() + 1);
    setDay(base.getDate());
  }, [visible, value, defaultValue]);

  // 可選月份：碰到上下界那一年時要收斂，才不會選出超過 maximumDate 的日期
  const monthFrom = minimumDate && year === minYear ? minimumDate.getMonth() + 1 : 1;
  const monthTo = maximumDate && year === maxYear ? maximumDate.getMonth() + 1 : 12;

  const dayFrom =
    minimumDate && year === minYear && month === minimumDate.getMonth() + 1
      ? minimumDate.getDate()
      : 1;
  const dayTo =
    maximumDate && year === maxYear && month === maximumDate.getMonth() + 1
      ? maximumDate.getDate()
      : daysInMonth(year, month);

  // 年／月變動後把月、日夾回合法區間（例如 3/31 切到 2 月 → 2/28）
  useEffect(() => {
    if (month < monthFrom) setMonth(monthFrom);
    else if (month > monthTo) setMonth(monthTo);
  }, [month, monthFrom, monthTo]);

  useEffect(() => {
    if (day < dayFrom) setDay(dayFrom);
    else if (day > dayTo) setDay(dayTo);
  }, [day, dayFrom, dayTo]);

  const yearItems: WheelItem[] = useMemo(
    () => range(minYear, maxYear).map((y) => ({ value: y, label: isEn ? `${y}` : `${y}年` })),
    [minYear, maxYear, isEn]
  );
  const monthItems: WheelItem[] = useMemo(
    () =>
      range(monthFrom, monthTo).map((m) => ({
        value: m,
        label: isEn ? EN_MONTH_LABELS[m - 1] : `${m}月`,
      })),
    [monthFrom, monthTo, isEn]
  );
  const dayItems: WheelItem[] = useMemo(
    () => range(dayFrom, dayTo).map((d) => ({ value: d, label: isEn ? `${d}` : `${d}日` })),
    [dayFrom, dayTo, isEn]
  );

  const columns = [
    { key: 'year', items: yearItems, selected: year, onChange: setYear },
    { key: 'month', items: monthItems, selected: month, onChange: setMonth },
    { key: 'day', items: dayItems, selected: day, onChange: setDay },
  ];
  // 英文慣用「月 日 年」；中文為「年 月 日」
  const orderedColumns = isEn ? [columns[1], columns[2], columns[0]] : columns;

  const handleConfirm = () => {
    onConfirm(new Date(year, month - 1, day));
  };

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.toolbar}>
            <Pressable onPress={onCancel} hitSlop={12}>
              <Text style={styles.cancelText}>{translate('cancel')}</Text>
            </Pressable>
            <View style={styles.toolbarSpacer} />
            <Pressable onPress={handleConfirm} hitSlop={12}>
              <Text style={styles.confirmText}>{translate('confirm')}</Text>
            </Pressable>
          </View>

          <View style={styles.wheels}>
            {orderedColumns.map((col) => (
              <WheelPicker
                key={col.key}
                items={col.items}
                selectedValue={col.selected}
                onChange={col.onChange}
                itemHeight={itemHeight}
                fontSize={wheelFontSize}
              />
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#2c2f34',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    overflow: 'hidden',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#3a3f44',
  },
  toolbarSpacer: { flex: 1 },
  cancelText: { color: '#9aa3ad', fontSize: 17, fontWeight: '600' },
  confirmText: { color: '#00a99d', fontSize: 17, fontWeight: '700' },
  wheels: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
});
