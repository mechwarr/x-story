// app/screens/ProfileScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  Image,
  TextInput,
  Pressable,
  Platform,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import routes from '../navigations/routes';
import { useCoins } from '../store/coinContext';
import { getUserProfile, updateUserProfile } from '../config/userApiClient';

import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { coins, refreshCoins } = useCoins();

  // ---- 狀態 ----
  const [name, setName] = useState<string>('');
  const [birthday, setBirthday] = useState<Date>(new Date(1995, 7, 5));
  const [gender, setGender] = useState<'female' | 'male' | 'other'>('female');
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { width: screenWidth } = Dimensions.get('window');
  const avatarSize = Math.round(screenWidth / 4);

  // ---- 載入用戶資料 ----
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        setIsLoading(true);
        const userData = await getUserProfile();
        
        if (userData) {
          // 更新名稱
          if (userData.name) {
            setName(userData.name);
          }
          
          // 更新生日
          if (userData.birthday) {
            const birthdayDate = new Date(userData.birthday);
            if (!isNaN(birthdayDate.getTime())) {
              setBirthday(birthdayDate);
            }
          }
          
          // 更新性別
          if (userData.gender && ['female', 'male', 'other'].includes(userData.gender)) {
            setGender(userData.gender as 'female' | 'male' | 'other');
          }
          
          console.log('[ProfileScreen] ✓ 成功載入用戶資料:', userData);
        } else {
          console.warn('[ProfileScreen] 無法獲取用戶資料，使用預設值');
        }
      } catch (error) {
        console.error('[ProfileScreen] 載入用戶資料時發生錯誤:', error);
        // 不顯示錯誤提示，只使用預設值
      } finally {
        setIsLoading(false);
      }
    };

    loadUserProfile();
  }, []);

  // 當畫面獲得焦點時，刷新金幣餘額
  useFocusEffect(
    React.useCallback(() => {
      refreshCoins();
    }, [refreshCoins])
  );

  // ---- 事件：日期變更 ----
  const onChangeBirthday = (e: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) setBirthday(date);
  };

  const birthdayText = `${birthday.getFullYear()}/${birthday.getMonth() + 1}/${birthday.getDate()}`;

  // ---- 事件：提交表單 ----
  const handleSubmit = async () => {
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      
      // 將生日轉換為 ISO 8601 格式字串
      const birthdayISO = birthday.toISOString().split('T')[0]; // YYYY-MM-DD 格式
      
      const result = await updateUserProfile({ 
        name,
        birthday: birthdayISO,
        gender: gender
      });
      
      if (result.success !== false) {
        Alert.alert('成功', '個人資料已更新！', [
          { text: '確定', onPress: () => {} }
        ]);
      } else {
        Alert.alert('錯誤', result.message || '更新失敗，請稍後再試');
      }
    } catch (error: any) {
      console.error('更新用戶資料錯誤:', error);
      Alert.alert('錯誤', error?.message || '更新失敗，請稍後再試');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 如果正在載入，顯示載入指示器
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={[styles.topBar, { paddingTop: 8 }]}>
          <Pressable onPress={() => navigation.navigate(routes.MAIN as never)} hitSlop={8}>
            <Image style={styles.profileIconTop} source={require('../../assets/blueeye.png')} />
          </Pressable>
        </View>
        <View style={[styles.container, styles.loadingContainer]}>
          <ActivityIndicator size="large" color="#00a99d" />
          <Text style={styles.loadingText}>載入中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.topBar, { paddingTop: 8 }]}>
        <Pressable onPress={() => navigation.navigate(routes.MAIN as never)} hitSlop={8}>
          <Image style={styles.profileIconTop} source={require('../../assets/blueeye.png')} />
        </Pressable>
      </View>

      <View style={styles.container}>
        {/* 頭像 */}
        <Image
          style={[
            styles.avatar,
            { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 },
          ]}
          source={require('../../assets/profile2.png')}
        />

        <Text style={styles.title}>我的資料</Text>

        {/* 餘額 + 操作列（同一行顯示，從螢幕正中間開始往右排） */}
        <View style={styles.balanceActionsRow}>
          <View style={styles.flexSpacer} />  {/* 新增：左側彈性空間，確保中間對齊 */}

          <View style={styles.balanceBox}>
            <Image style={styles.coin} source={require('../../assets/coin.png')} />
            <Text style={styles.balanceText}>{coins}</Text>
          </View>

          <View style={[styles.walletRow, styles.walletRowRight]}>
            <Pressable
              style={styles.chargeBtn}
              onPress={() => navigation.navigate(routes.PURCHASE as never)}
            >
              <Text style={styles.chargeText}>加值</Text>
            </Pressable>

            <Pressable onPress={() => navigation.navigate(routes.HISTORY as never)}>
              <Text style={styles.linkText}>查看紀錄</Text>
            </Pressable>
          </View>
        </View>
        {/* 暱稱 */}
        <View style={styles.inputRow}>
          <Text style={styles.label}>暱稱</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="請輸入暱稱"
            placeholderTextColor="#9aa3ad"
            style={styles.input}
          />
        </View>

        {/* 生日 */}
        <Pressable style={styles.inputRow} onPress={() => setShowDatePicker(true)}>
          <Text style={styles.label}>生日</Text>
          <View style={styles.valueBox}>
            <Text style={styles.valueText}>{birthdayText}</Text>
            <Text style={styles.arrow}>{'>'}</Text>
          </View>
        </Pressable>

        {/* 性別 */}
        <View style={styles.inputRow}>
          <Text style={styles.label}>性別</Text>
          <View style={styles.pickerBox}>
            <Picker
              selectedValue={gender}
              onValueChange={(v) => setGender(v)}
              dropdownIconColor="#cdd4db"
              style={styles.picker}
              itemStyle={{ color: '#e7eef6' }}
            >
              <Picker.Item label="女性" value="female" />
              <Picker.Item label="男性" value="male" />
            </Picker>
          </View>
        </View>

        {/* CTA */}
        <Pressable 
          style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]} 
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <View style={styles.btnRow}>
            {isSubmitting ? (
              <ActivityIndicator color="#eafff9" size="small" />
            ) : (
              <>
                <Text style={styles.submitText}>完成並領取 50 金幣 </Text>
                <Image style={styles.coinIcon} source={require('../../assets/coin.png')} />
              </>
            )}
          </View>
        </Pressable>
      </View>

      {/* 日期選擇器 */}
      {showDatePicker && (
        <DateTimePicker
          value={birthday}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onChangeBirthday}
          maximumDate={new Date()}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ---- 全域底色 ----
  safe: { flex: 1, backgroundColor: '#2b2f33' },

  // ---- 左上角 TopBar ----
  topBar: {
    width: '100%',
    paddingHorizontal: 10,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  profileIconTop: { width: 42, height: 42, borderRadius: 16 },
  title: { color: '#e7eef6', fontWeight: '700', fontSize: 18, marginBottom: 6, textAlign: 'center' },

  // ---- 內容 ----
  container: { flex: 1, paddingHorizontal: 16 },

  // ---- 頭像 ----
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 8,
  },

  // ---- 餘額 + 操作列（同一行）----
  balanceActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    marginBottom: 16,
  },
  flexSpacer: { flex: 1 },
  walletRowRight: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-end', // 讓「查看紀錄」與「加值」的底部對齊
    marginLeft: 14,
  },

  // 餘額方塊（你指定的樣式）
  balanceBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  coin: { width: 16, height: 16, resizeMode: 'contain' },
  balanceText: { color: '#e7eef6', fontSize: 16, fontWeight: '700' },

  // 操作列（加值 / 查看紀錄）
  walletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chargeBtn: {
    backgroundColor: '#ff3344',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  chargeText: { color: '#fff', fontWeight: '700' },
  linkText: {
    color: '#f0ad57',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },

  // ---- 表單 ----
  inputRow: {
    backgroundColor: '#2c2f34',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  label: { color: '#9aa3ad', fontSize: 12, marginBottom: 6 },
  input: {
    color: '#e7eef6',
    fontSize: 16,
    backgroundColor: '#1f2226',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },

  // ---- 生日盒 ----
  valueBox: {
    backgroundColor: '#1f2226',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  valueText: { color: '#e7eef6', fontSize: 16 },
  arrow: { color: '#cdd4db', fontSize: 16 },

  // ---- 性別選單 ----
  pickerBox: { backgroundColor: '#1f2226', borderRadius: 8 },
  picker: { color: '#e7eef6', minHeight: 44, paddingVertical: 0 },

  // ---- CTA ----
  submitBtn: {
    marginTop: 8,
    backgroundColor: '#00a99d',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  // 按鈕內橫向排列容器（文字 + 圖示）
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    color: '#eafff9',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  // 金幣圖示（按鈕內）
  coinIcon: {
    width: 18,
    height: 18,
    marginLeft: 6,
    resizeMode: 'contain',
  },

  // ---- 載入狀態 ----
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#e7eef6',
    marginTop: 12,
    fontSize: 16,
  },
});
