// app/screens/ProfileScreen.tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TextInput,
  Pressable,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import routes from '../navigations/routes';
import { useCoins } from '../store/coinContext';
import { useAuth } from '../auth/AuthContext';
import {
  getUserProfile,
  updateUserProfile,
  deleteUserAccount,
  claimActivityReward,
  type GenderCode,
} from '../config/userApiClient';
import useResponsive from '../hook/useResponsive';
import { translate } from '../i18n/i18n';
import { HEADER_ICON_BASE_SIZE } from '../config/responsive';

import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { coins, refreshCoins } = useCoins();
  const { logoutLocalOnly } = useAuth();

  // ---- 狀態 ----
  const [name, setName] = useState<string>('');
  /** null 表示尚未帶入/設定生日，畫面顯示 yyyy/mm/dd 占位字串 */
  const [birthday, setBirthday] = useState<Date | null>(null);
  const [gender, setGender] = useState<GenderCode>(0);
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  /** iOS：性別以列顯示選中值，點擊後開 bottom sheet（Picker） */
  const [showGenderPicker, setShowGenderPicker] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  /** 個人資料未完成（生日或性別任一缺）時，顯示「完成並領取」任務獎勵按鈕；
   *  生日與性別皆齊全 → 視為已完成，顯示「更新個人資訊」 */
  const [showCompleteProfileClaimCta, setShowCompleteProfileClaimCta] = useState<boolean>(false);
  const { contentWidth, isTablet, maxContentWidth, horizontalPadding, scale } = useResponsive();
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const modalBoxMaxWidth = Math.min(340, windowWidth - 32);
  const titleFontSize = Math.round(20 * Math.min(scale, 1.12));
  const bodyFontSize = Math.round(17 * Math.min(scale, 1.08));
  const labelFontSize = Math.round(14 * Math.min(scale, 1.06));
  const submitFontSize = Math.round(16 * Math.min(scale, 1.08));
  const avatarSize = Math.min(Math.round(contentWidth / 3), 160);
  const iconSize = Math.round(HEADER_ICON_BASE_SIZE * scale);

  // ---- 載入用戶資料（換帳號後每次進入此畫面都重新拉取，避免顯示上一帳號名稱/生日/性別）----
  const loadUserProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      // 先清空顯示，避免在請求完成前短暫顯示上一帳號資料
      setName('');
      setBirthday(null);
      setGender(0);

      const userData = await getUserProfile();

      if (userData) {
        if (userData.name) setName(userData.name);
        if (userData.birthday) {
          const birthdayDate = new Date(userData.birthday);
          if (!isNaN(birthdayDate.getTime())) setBirthday(birthdayDate);
        }
        if (typeof userData.gender === 'number' && (userData.gender === 1 || userData.gender === 2)) {
          setGender(userData.gender);
        } else {
          setGender(0);
        }
        const hasBirthday = !!(userData.birthday && String(userData.birthday).trim());
        const hasGender = userData.gender === 1 || userData.gender === 2;
        // 生日 + 性別皆齊全 = 已完成個人資料；任一缺 → 仍顯示任務獎勵 CTA
        const profileComplete = hasBirthday && hasGender;
        setShowCompleteProfileClaimCta(!profileComplete);
        console.log('[ProfileScreen] ✓ 成功載入用戶資料:', userData);
      } else {
        console.warn('[ProfileScreen] 無法獲取用戶資料，使用預設值');
        setShowCompleteProfileClaimCta(false);
      }
    } catch (error) {
      console.error('[ProfileScreen] 載入用戶資料時發生錯誤:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 每次畫面取得焦點時重新載入（含登出換帳號後第一次進入）
  useFocusEffect(
    useCallback(() => {
      loadUserProfile();
    }, [loadUserProfile])
  );

  // ---- 事件：日期變更 ----
  const onChangeBirthday = (e: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) setBirthday(date);
  };

  /** 首次/未設定生日時的選擇器預設值（不會送出，僅供 picker 起始顯示） */
  const birthdayPickerValue = birthday ?? new Date(1995, 7, 5);
  const hasBirthday = !!birthday;
  const birthdayText = birthday
    ? `${birthday.getFullYear()}/${birthday.getMonth() + 1}/${birthday.getDate()}`
    : 'yyyy/mm/dd';

  const genderDisplayLabel = (g: GenderCode) => {
    if (g === 1) return '男性';
    if (g === 2) return '女性';
    return '請選擇';
  };

  const buildBirthdayPayload = () => (birthday ? birthday.toISOString().split('T')[0] : undefined);

  /** 僅更新個人資料（一般模式按鈕） */
  const handleUpdateProfileOnly = async () => {
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      const birthdayISO = buildBirthdayPayload();
      const result = await updateUserProfile({
        name,
        birthday: birthdayISO,
        gender,
      });

      if (result.success !== false) {
        Alert.alert(translate('profileUpdatedSuccessTitle'), translate('profileUpdatedSuccessMessage'), [
          { text: translate('ok'), onPress: () => {} },
        ]);
      } else {
        Alert.alert(translate('passwordUpdateErrorTitle'), result.message || translate('passwordUpdateErrorMessage'));
      }
    } catch (error: any) {
      console.error('更新用戶資料錯誤:', error);
      Alert.alert(translate('passwordUpdateErrorTitle'), error?.message || translate('passwordUpdateErrorMessage'));
    } finally {
      setIsSubmitting(false);
    }
  };

  /** 首次完成個人資料：更新後領取 PROFILE_COMPLETED 獎勵 */
  const handleCompleteProfileAndClaim = async () => {
    if (isSubmitting) return;

    if (gender !== 1 && gender !== 2) {
      Alert.alert(translate('passwordUpdateErrorTitle'), translate('profileSelectGenderForBonus'));
      return;
    }

    try {
      setIsSubmitting(true);
      const birthdayISO = buildBirthdayPayload();
      const result = await updateUserProfile({
        name,
        birthday: birthdayISO,
        gender,
      });

      if (result.success === false) {
        Alert.alert(translate('passwordUpdateErrorTitle'), result.message || translate('passwordUpdateErrorMessage'));
        return;
      }

      try {
        const claimResult = await claimActivityReward({ activityName: 'PROFILE_COMPLETED' });
        if (claimResult.success === false) {
          setShowCompleteProfileClaimCta(false);
          await refreshCoins(true);
          Alert.alert(
            translate('profileRewardClaimFailedTitle'),
            claimResult.message || translate('profileRewardClaimFailedMessage')
          );
          return;
        }
        setShowCompleteProfileClaimCta(false);
        await refreshCoins(true);
        Alert.alert(translate('profileUpdatedSuccessTitle'), translate('profileCompletedRewardSuccessMessage'), [
          { text: translate('ok'), onPress: () => {} },
        ]);
      } catch (claimErr: any) {
        setShowCompleteProfileClaimCta(false);
        await refreshCoins(true);
        console.error('[ProfileScreen] 領取獎勵錯誤:', claimErr);
        Alert.alert(
          translate('profileRewardClaimFailedTitle'),
          claimErr?.message || translate('profileRewardClaimFailedMessage')
        );
      }
    } catch (error: any) {
      console.error('更新用戶資料錯誤:', error);
      Alert.alert(translate('passwordUpdateErrorTitle'), error?.message || translate('passwordUpdateErrorMessage'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---- 事件：刪除帳號確認 ----
  const openDeleteModal = () => {
    setDeleteConfirmInput('');
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    if (!isDeleting) {
      setShowDeleteModal(false);
      setDeleteConfirmInput('');
    }
  };

  const handleDeleteAccountConfirm = async () => {
    const trimmed = deleteConfirmInput.trim();
    if (trimmed !== 'DELETE') {
      Alert.alert('輸入錯誤', '請輸入 \'DELETE\' 以確認刪除帳號。');
      return;
    }
    try {
      setIsDeleting(true);
      const result = await deleteUserAccount();
      if (result.success === true) {
        setShowDeleteModal(false);
        setDeleteConfirmInput('');
        await logoutLocalOnly();
      } else {
        Alert.alert('刪除失敗', result.message || '無法刪除帳號，請稍後再試。');
      }
    } catch (e: any) {
      Alert.alert('錯誤', e?.message || '刪除帳號時發生錯誤。');
    } finally {
      setIsDeleting(false);
    }
  };

  // 如果正在載入，顯示載入指示器
  if (isLoading) {
    return (
      <View style={styles.safe}>
        <View style={[styles.topBar, { paddingTop: 8, paddingHorizontal: horizontalPadding }]}>
          <Pressable onPress={() => navigation.navigate(routes.MAIN as never)} hitSlop={8}>
            <Image style={[styles.profileIconTop, { width: iconSize, height: iconSize, borderRadius: iconSize / 2 }]} source={require('../../assets/blueeye.png')} />
          </Pressable>
        </View>
        <View style={[styles.container, styles.loadingContainer, { paddingHorizontal: horizontalPadding }]}>
          <ActivityIndicator size="large" color="#00a99d" />
          <Text style={[styles.loadingText, { fontSize: bodyFontSize }]}>載入中...</Text>
        </View>
      </View>
    );
  }

  // 與 AppHeader（Android 主畫面）金幣 icon 一致：20 * scale
  const coinIconSmall = Math.round(20 * scale);
  const coinIconBtn = Math.round(20 * scale);
  /** 首次完成個人資料（生日 + 性別）尚未填妥 → 鎖定底部更新按鈕 */
  const isProfileIncomplete =
    showCompleteProfileClaimCta && (!birthday || (gender !== 1 && gender !== 2));
  const isSubmitDisabled = isSubmitting || isProfileIncomplete;

  return (
    <View style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        <ScrollView
          style={styles.scrollView}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
          {...(Platform.OS === 'ios' ? { contentInsetAdjustmentBehavior: 'automatic' as const } : {})}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={[styles.topBar, { paddingTop: 8, paddingHorizontal: horizontalPadding }]}>
            <Pressable onPress={() => navigation.navigate(routes.MAIN as never)} hitSlop={8}>
              <Image
                style={[styles.profileIconTop, { width: iconSize, height: iconSize, borderRadius: iconSize / 2 }]}
                source={require('../../assets/blueeye.png')}
              />
            </Pressable>
          </View>

          <View style={[styles.contentWrap, isTablet && { maxWidth: maxContentWidth, alignSelf: 'center', width: '100%' }]}>
            <View style={[styles.container, { paddingHorizontal: horizontalPadding }]}>
              {/* 頭像 */}
              <Image
                style={[
                  styles.avatar,
                  { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 },
                ]}
                source={require('../../assets/profile2.png')}
              />

              <Text style={[styles.title, { fontSize: titleFontSize }]}>我的資料</Text>

              {/* 餘額 + 操作列：iOS / Android 一致，皆為單行 —— 金幣 icon + 金額 後方
                  平行排列「加值」「查看紀錄」，不換行、不堆疊到下方 */}
              <View style={styles.balanceActionsRow}>
                <View style={styles.flexSpacer} />
                <View style={styles.balanceBox}>
                  <Image style={[styles.coin, { width: coinIconSmall, height: coinIconSmall }]} source={require('../../assets/coin.png')} />
                  <Text style={[styles.balanceText, { fontSize: bodyFontSize }]} numberOfLines={1}>{coins}</Text>
                </View>
                <View style={[styles.walletRow, styles.walletRowRight]}>
                  <Pressable style={styles.chargeBtn} onPress={() => navigation.navigate(routes.PURCHASE as never)}>
                    <Text style={[styles.chargeText, { fontSize: bodyFontSize }]} numberOfLines={1}>加值</Text>
                  </Pressable>
                  <Pressable onPress={() => navigation.navigate(routes.HISTORY as never)}>
                    <Text style={[styles.linkText, { fontSize: bodyFontSize }]} numberOfLines={1}>查看紀錄</Text>
                  </Pressable>
                </View>
              </View>

              {/* 暱稱 */}
              <View style={styles.inputRow}>
                <Text style={[styles.label, { fontSize: labelFontSize }]}>暱稱</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="請輸入暱稱"
                  placeholderTextColor="#9aa3ad"
                  style={[styles.input, { fontSize: bodyFontSize }]}
                />
              </View>

              {/* 生日 */}
              <Pressable style={styles.inputRow} onPress={() => setShowDatePicker(true)}>
                <Text style={[styles.label, { fontSize: labelFontSize }]}>生日</Text>
                <View style={styles.valueBox}>
                  <Text
                    style={[
                      styles.valueText,
                      { fontSize: bodyFontSize },
                      !hasBirthday && styles.valueTextPlaceholder,
                    ]}
                    numberOfLines={1}
                  >
                    {birthdayText}
                  </Text>
                  <Text style={[styles.arrow, { fontSize: bodyFontSize }]}>{'>'}</Text>
                </View>
              </Pressable>

              {/* 性別（0=未選，1=男，2=女）：iOS 固定列 + 底部選單；Android 維持內嵌 Picker */}
              {Platform.OS === 'ios' ? (
                <Pressable style={styles.inputRow} onPress={() => setShowGenderPicker(true)}>
                  <Text style={[styles.label, { fontSize: labelFontSize }]}>性別</Text>
                  <View style={styles.valueBox}>
                    <Text
                      style={[
                        styles.valueText,
                        { fontSize: bodyFontSize },
                        gender === 0 && styles.valueTextPlaceholder,
                      ]}
                      numberOfLines={1}
                    >
                      {genderDisplayLabel(gender)}
                    </Text>
                    <Text style={[styles.arrow, { fontSize: bodyFontSize }]}>{'>'}</Text>
                  </View>
                </Pressable>
              ) : (
                <View style={styles.inputRow}>
                  <Text style={[styles.label, { fontSize: labelFontSize }]}>性別</Text>
                  <View style={styles.pickerBox}>
                    <Picker
                      selectedValue={gender}
                      onValueChange={(v) => setGender(v as GenderCode)}
                      dropdownIconColor="#cdd4db"
                      style={styles.picker}
                      itemStyle={{ color: '#e7eef6', fontSize: bodyFontSize }}
                    >
                      <Picker.Item label="請選擇" value={0} />
                      <Picker.Item label="男性" value={1} />
                      <Picker.Item label="女性" value={2} />
                    </Picker>
                  </View>
                </View>
              )}

              {/* 更新鈕 + 刪除帳號：以 marginTop:'auto' 對齊至內容底部 */}
              <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
                {/* CTA：未完成個人資料（無生日且未選性別）→ 完成並領獎；否則 → 僅更新 */}
                <Pressable
                  style={[
                    styles.submitBtn,
                    isProfileIncomplete && styles.submitBtnLocked,
                    isSubmitting && styles.submitBtnDisabled,
                  ]}
                  onPress={showCompleteProfileClaimCta ? handleCompleteProfileAndClaim : handleUpdateProfileOnly}
                  disabled={isSubmitDisabled}
                >
                  <View style={styles.btnRow}>
                    {isSubmitting ? (
                      <ActivityIndicator color="#eafff9" size="small" />
                    ) : showCompleteProfileClaimCta ? (
                      <>
                        <Text
                          style={[
                            styles.submitText,
                            { fontSize: submitFontSize },
                            isProfileIncomplete && styles.submitTextLocked,
                          ]}
                          numberOfLines={2}
                          adjustsFontSizeToFit={Platform.OS === 'ios'}
                          minimumFontScale={0.82}
                        >
                          {translate('profileCompleteAndClaimCoins')}
                        </Text>
                        <Image style={[styles.coinIcon, { width: coinIconBtn, height: coinIconBtn }]} source={require('../../assets/coin.png')} />
                      </>
                    ) : (
                      <Text
                        style={[styles.submitText, { fontSize: submitFontSize }]}
                        numberOfLines={2}
                        adjustsFontSizeToFit={Platform.OS === 'ios'}
                        minimumFontScale={0.85}
                      >
                        {translate('profileUpdatePersonalInfo')}
                      </Text>
                    )}
                  </View>
                </Pressable>

                {/* 刪除帳號（防誤觸：需輸入 DELETE 確認） */}
                <Pressable style={styles.deleteAccountRow} onPress={openDeleteModal} disabled={isDeleting}>
                  <Text style={[styles.deleteAccountText, { fontSize: Math.round(14 * Math.min(scale, 1.06)) }]}>{routes.REMOVE}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 刪除帳號確認 Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={closeDeleteModal}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeDeleteModal}>
          <Pressable style={[styles.modalBox, { maxWidth: modalBoxMaxWidth, width: '100%' }]} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>刪除帳號</Text>
            <Text style={styles.modalMessage}>
              請輸入{' '}
              <Text style={styles.modalDeleteKeyword}>DELETE</Text>
              {' '}以確認刪除帳號，此操作無法復原。
            </Text>
            <TextInput
              style={styles.modalInput}
              value={deleteConfirmInput}
              onChangeText={setDeleteConfirmInput}
              placeholder="輸入 DELETE"
              placeholderTextColor="#9aa3ad"
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!isDeleting}
            />
            <View style={styles.modalButtons}>
              <Pressable style={styles.modalCancelBtn} onPress={closeDeleteModal} disabled={isDeleting}>
                <Text style={styles.modalCancelText}>取消</Text>
              </Pressable>
              <Pressable
                style={[styles.modalConfirmBtn, isDeleting && styles.modalConfirmBtnDisabled]}
                onPress={handleDeleteAccountConfirm}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>確定</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Android：系統日期選擇器 */}
      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={birthdayPickerValue}
          mode="date"
          display="default"
          onChange={onChangeBirthday}
          maximumDate={new Date()}
        />
      )}

      {/* iOS：底部 sheet，避免 spinner 內嵌撐破版面 */}
      {Platform.OS === 'ios' && (
        <Modal transparent animationType="slide" visible={showDatePicker} onRequestClose={() => setShowDatePicker(false)}>
          <Pressable style={styles.datePickerBackdrop} onPress={() => setShowDatePicker(false)}>
            <Pressable
              style={[styles.datePickerSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={[styles.datePickerToolbar, { paddingTop: Math.max(insets.top, 12) }]}>
                <View style={styles.datePickerToolbarSpacer} />
                <Pressable onPress={() => setShowDatePicker(false)} hitSlop={12}>
                  <Text style={styles.datePickerDoneText}>{translate('ok')}</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={birthdayPickerValue}
                mode="date"
                display="spinner"
                onChange={onChangeBirthday}
                maximumDate={new Date()}
                themeVariant="dark"
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* iOS：性別 — bottom sheet 滾輪選單，與生日列一致「先顯示值再點選」 */}
      {Platform.OS === 'ios' && (
        <Modal transparent animationType="slide" visible={showGenderPicker} onRequestClose={() => setShowGenderPicker(false)}>
          <Pressable style={styles.datePickerBackdrop} onPress={() => setShowGenderPicker(false)}>
            <Pressable
              style={[styles.datePickerSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
              onPress={(e) => e.stopPropagation()}
            >
              <View
                style={[
                  styles.datePickerToolbar,
                  styles.genderSheetToolbar,
                  { paddingTop: Math.max(insets.top, 12) },
                ]}
              >
                <Pressable onPress={() => setShowGenderPicker(false)} hitSlop={12}>
                  <Text style={styles.genderSheetCancelText}>{translate('cancel')}</Text>
                </Pressable>
                <View style={styles.datePickerToolbarSpacer} />
                <Pressable onPress={() => setShowGenderPicker(false)} hitSlop={12}>
                  <Text style={styles.datePickerDoneText}>{translate('ok')}</Text>
                </Pressable>
              </View>
              <View style={styles.genderPickerWrap}>
                <Picker
                  selectedValue={gender}
                  onValueChange={(v) => setGender(v as GenderCode)}
                  itemStyle={{ color: '#e7eef6', fontSize: bodyFontSize }}
                  style={styles.genderPickerIOS}
                >
                  <Picker.Item label="請選擇" value={0} />
                  <Picker.Item label="男性" value={1} />
                  <Picker.Item label="女性" value={2} />
                </Picker>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // ---- 全域底色 ----
  safe: { flex: 1, backgroundColor: '#2b2f33' },
  keyboardAvoid: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 28,
  },

  topBar: {
    width: '100%',
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  profileIconTop: {},
  title: { color: '#e7eef6', fontWeight: '700', marginBottom: 6, textAlign: 'center' },

  contentWrap: {
    flex: 1,
  },
  container: { flex: 1 },

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
  balanceText: { color: '#f0ad57', fontWeight: '700' },

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
  label: { color: '#9aa3ad', marginBottom: 6 },
  input: {
    color: '#e7eef6',
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
  valueText: { color: '#e7eef6', flexShrink: 1 },
  arrow: { color: '#cdd4db' },
  valueTextPlaceholder: { color: '#9aa3ad' },

  // ---- 性別選單 ----
  pickerBox: { backgroundColor: '#1f2226', borderRadius: 8 },
  picker: { color: '#e7eef6', minHeight: 44, paddingVertical: 0 },

  // ---- CTA ----
  submitBtn: {
    marginTop: 8,
    backgroundColor: '#00a99d',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  // 首次資料未填妥：白字灰底、不可按
  submitBtnLocked: {
    backgroundColor: '#6b7280',
  },
  submitTextLocked: {
    color: '#ffffff',
  },
  // 按鈕內橫向排列容器（文字 + 圖示）
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 6,
    maxWidth: '100%',
  },
  submitText: {
    color: '#eafff9',
    fontWeight: '800',
    letterSpacing: 0.3,
    textAlign: 'center',
    flexShrink: 1,
    paddingHorizontal: 4,
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
  },

  // ---- 底部對齊容器（更新鈕 + 刪除帳號）----
  footer: {
    marginTop: 'auto',
    paddingTop: 16,
  },

  // ---- 刪除帳號 ----
  deleteAccountRow: {
    marginTop: 24,
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteAccountText: {
    color: '#9aa3ad',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },

  // ---- iOS 生日選擇 bottom sheet ----
  datePickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  datePickerSheet: {
    backgroundColor: '#2c2f34',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    overflow: 'hidden',
  },
  datePickerToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#3a3f44',
  },
  /** 性別 sheet：左取消、右確定 */
  genderSheetToolbar: {
    justifyContent: 'flex-start',
    width: '100%',
  },
  datePickerToolbarSpacer: { flex: 1 },
  datePickerDoneText: {
    color: '#00a99d',
    fontSize: 17,
    fontWeight: '700',
  },
  genderSheetCancelText: {
    color: '#9aa3ad',
    fontSize: 17,
    fontWeight: '600',
  },
  genderPickerWrap: {
    width: '100%',
    alignItems: 'center',
  },
  /** iOS UIPicker 滾輪高度約 216px */
  genderPickerIOS: {
    width: '100%',
    height: 216,
  },

  // ---- 刪除帳號 Modal ----
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#2c2f34',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    color: '#e7eef6',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    color: '#e7eef6',
    fontSize: 15,
    marginBottom: 14,
    lineHeight: 22,
  },
  modalDeleteKeyword: {
    color: '#ff4444',
    fontWeight: '700',
    fontSize: 15,
  },
  modalInput: {
    color: '#e7eef6',
    fontSize: 16,
    backgroundColor: '#1f2226',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  modalCancelText: {
    color: '#9aa3ad',
    fontSize: 16,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    backgroundColor: '#ff3344',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 72,
    alignItems: 'center',
  },
  modalConfirmBtnDisabled: {
    opacity: 0.7,
  },
  modalConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
