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
  ActivityIndicator,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  useWindowDimensions,
} from 'react-native';
import { showAlert } from "../components/CustomAlert";
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
import { translate, getCurrentLang } from '../i18n/i18n';
import { HEADER_ICON_BASE_SIZE } from '../config/responsive';
import { peekPendingSocialName, clearPendingSocialName } from '../auth/pendingSocialName';

import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';

/**
 * 容錯解析後端生日 → 本地 Date（解析不出來回 null）。
 * Hermes 的 new Date() 只吃嚴格 ISO，後端若回 "YYYY-MM-DD HH:mm:ss"（空格）、
 * "YYYY/MM/DD"、含時區位移（+08:00 / Z）、Unix 時間戳等格式都要能還原，
 * 故優先用正則從字串中擷取年月日，並以本地時間 new Date(y, m-1, d) 建構，
 * 避免 UTC 午夜在不同時區造成差一天。
 */
function parseBirthdayString(raw?: string | number | null): Date | null {
  if (raw === null || raw === undefined) return null;

  // Unix 時間戳（數字或純數字字串）：10 位視為秒、13 位視為毫秒
  if (typeof raw === 'number' || /^\d{10,13}$/.test(String(raw).trim())) {
    const n = Number(raw);
    const dt = new Date(n < 1e12 ? n * 1000 : n);
    return isNaN(dt.getTime()) ? null : dt;
  }

  const s = String(raw).trim();
  if (!s) return null;

  // 從字串任意位置擷取第一段 YYYY-MM-DD / YYYY/MM/DD（涵蓋帶時間、時區、空格分隔等）
  const m = s.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) {
    const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (!isNaN(dt.getTime())) return dt;
  }

  const fallback = new Date(s); // 退路：完整 ISO 交給原生解析
  return isNaN(fallback.getTime()) ? null : fallback;
}

/** Date → "YYYY-MM-DD"（以本地日期欄位輸出，避免 toISOString 的時區位移） */
function formatDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { coins, refreshCoins } = useCoins();
  const { logoutLocalOnly } = useAuth();

  // ---- 狀態 ----
  const [name, setName] = useState<string>('');
  /** null 表示尚未帶入/設定生日，畫面顯示 yyyy/mm/dd 占位字串 */
  const [birthday, setBirthday] = useState<Date | null>(null);
  /** iOS bottom sheet 暫存的生日：開啟即帶入預設值，按「確定」才寫回 birthday。
   *  解決 iOS spinner 未轉動就不觸發 onChange，導致 birthday 仍為 null、送出時被略過的問題。 */
  const [draftBirthday, setDraftBirthday] = useState<Date | null>(null);
  const [gender, setGender] = useState<GenderCode>(0);
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  /** iOS：性別以列顯示選中值，點擊後開 bottom sheet（Picker） */
  const [showGenderPicker, setShowGenderPicker] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  /** 後端資料抓取失敗（null 或例外）：不猜按鈕樣式，改顯示載入失敗 + 重試 */
  const [loadFailed, setLoadFailed] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  /** 個人資料未完成（生日或性別任一缺）時，顯示「完成並領取」任務獎勵按鈕；
   *  生日與性別皆齊全 → 視為已完成，顯示「更新個人資訊」 */
  const [showCompleteProfileClaimCta, setShowCompleteProfileClaimCta] = useState<boolean>(false);
  const { contentWidth, isTablet, maxContentWidth, horizontalPadding, ms } = useResponsive();
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const modalBoxMaxWidth = Math.min(340, windowWidth - 32);
  const titleFontSize = ms(20);
  const bodyFontSize = ms(17);
  const labelFontSize = ms(14);
  const submitFontSize = ms(16);
  // 頭像維持 1:1 圓形比例，寬度 RWD：手機為螢幕寬 30%、平板為 25%。
  const avatarSize = Math.round(windowWidth * (isTablet ? 0.25 : 0.3));
  const iconSize = ms(HEADER_ICON_BASE_SIZE);
  // 頂欄眼睛比照 AppHeader（首頁工具列）：同尺寸、同列高、垂直置中
  const headerHeight = Math.max(50, ms(50));
  const isEn = getCurrentLang() === 'en';
  // 英文詞較長（Refill / Coin History），加值與紀錄鈕字級放大一點
  const walletFontSize = ms(isEn ? 18 : 17);

  // ---- 載入用戶資料（換帳號後每次進入此畫面都重新拉取，避免顯示上一帳號名稱/生日/性別）----
  const loadUserProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadFailed(false);
      // 先清空顯示，避免在請求完成前短暫顯示上一帳號資料
      setName('');
      setBirthday(null);
      setGender(0);

      const userData = await getUserProfile();

      if (userData) {
        if (userData.name && String(userData.name).trim()) {
          setName(userData.name);
        } else {
          // 後端暱稱為空 → 以社群登入 best-effort 暱稱預填（僅顯示於輸入框，按「更新」才存回後端）
          const socialName = peekPendingSocialName();
          if (socialName) setName(socialName);
        }
        // 後端欄位名為 birthDate（非 birthday）
        if (userData.birthDate) {
          const birthdayDate = parseBirthdayString(userData.birthDate);
          if (birthdayDate) {
            setBirthday(birthdayDate);
          } else {
            // 後端有回生日但格式無法解析 → 留意 log 中的原始值，避免誤判為「無資料」
            console.warn('[ProfileScreen] 生日資料無法解析，暫顯示占位字串。原始值:', userData.birthDate);
          }
        }
        if (typeof userData.gender === 'number' && (userData.gender === 1 || userData.gender === 2)) {
          setGender(userData.gender);
        } else {
          setGender(0);
        }
        const hasBirthday = !!(userData.birthDate && String(userData.birthDate).trim());
        const hasGender = userData.gender === 1 || userData.gender === 2;
        // 生日 + 性別皆齊全 = 已完成個人資料；任一缺 → 仍顯示任務獎勵 CTA
        const profileComplete = hasBirthday && hasGender;
        setShowCompleteProfileClaimCta(!profileComplete);
        console.log('[ProfileScreen] ✓ 成功載入用戶資料:', userData);
      } else {
        // 抓取失敗（回傳 null）→ 不猜樣式，標記載入失敗以顯示重試
        console.warn('[ProfileScreen] 無法獲取用戶資料，顯示載入失敗');
        setLoadFailed(true);
      }
    } catch (error) {
      console.error('[ProfileScreen] 載入用戶資料時發生錯誤:', error);
      setLoadFailed(true);
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

  /** 首次/未設定生日時的選擇器預設值（不會送出，僅供 picker 起始顯示） */
  const birthdayPickerValue = birthday ?? new Date(1995, 7, 5);

  // ---- 事件：日期變更 ----
  // Android：原生對話框「確定」時即帶回所選日期 → 直接寫回 birthday。
  const onChangeBirthday = (e: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) setBirthday(date);
  };

  /** iOS：開啟生日 sheet → 先把目前值（或預設）放進 draft，確保未轉動也有值可確定 */
  const openBirthdayPicker = () => {
    setDraftBirthday(birthday ?? birthdayPickerValue);
    setShowDatePicker(true);
  };

  /** iOS：sheet 內滾動只更新 draft，不直接動 birthday */
  const onChangeDraftBirthday = (e: DateTimePickerEvent, date?: Date) => {
    if (date) setDraftBirthday(date);
  };

  /** iOS：按「確定」才把 draft 寫回 birthday（未轉動時即帶入預設值）*/
  const confirmBirthday = () => {
    if (draftBirthday) setBirthday(draftBirthday);
    setShowDatePicker(false);
  };
  const hasBirthday = !!birthday;
  const birthdayText = birthday
    ? `${birthday.getFullYear()}/${birthday.getMonth() + 1}/${birthday.getDate()}`
    : 'yyyy/mm/dd';

  const genderDisplayLabel = (g: GenderCode) => {
    if (g === 1) return translate('genderMale');
    if (g === 2) return translate('genderFemale');
    return translate('genderPleaseSelect');
  };

  const buildBirthdayPayload = () => (birthday ? formatDateLocal(birthday) : undefined);

  /** 僅更新個人資料（一般模式按鈕） */
  const handleUpdateProfileOnly = async () => {
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      const birthdayISO = buildBirthdayPayload();
      const result = await updateUserProfile({
        name,
        birthDate: birthdayISO,
        gender,
      });

      if (result.success !== false) {
        // 已存回後端 → 清除社群暱稱暫存，避免下次載入殘留
        clearPendingSocialName();
        showAlert(translate('profileUpdatedSuccessTitle'), translate('profileUpdatedSuccessMessage'), [
          { text: translate('ok'), onPress: () => {} },
        ]);
      } else {
        showAlert(translate('passwordUpdateErrorTitle'), result.message || translate('passwordUpdateErrorMessage'));
      }
    } catch (error: any) {
      console.error('更新用戶資料錯誤:', error);
      showAlert(translate('passwordUpdateErrorTitle'), error?.message || translate('passwordUpdateErrorMessage'));
    } finally {
      setIsSubmitting(false);
    }
  };

  /** 首次完成個人資料：更新後領取 PROFILE_COMPLETED 獎勵 */
  const handleCompleteProfileAndClaim = async () => {
    if (isSubmitting) return;

    if (gender !== 1 && gender !== 2) {
      // 非真正錯誤（輸入提示）→ 標題用 "Alert"，與 server 回傳錯誤的「發生錯誤」區隔
      showAlert(translate('commonAlertTitle'), translate('profileSelectGenderForBonus'));
      return;
    }

    try {
      setIsSubmitting(true);
      const birthdayISO = buildBirthdayPayload();
      const result = await updateUserProfile({
        name,
        birthDate: birthdayISO,
        gender,
      });

      if (result.success === false) {
        showAlert(translate('passwordUpdateErrorTitle'), result.message || translate('passwordUpdateErrorMessage'));
        return;
      }
      // 已存回後端 → 清除社群暱稱暫存，避免下次載入殘留
      clearPendingSocialName();

      try {
        const claimResult = await claimActivityReward({ activityName: 'PROFILE_COMPLETED' });
        if (claimResult.success === false) {
          setShowCompleteProfileClaimCta(false);
          await refreshCoins(true);
          showAlert(
            translate('profileRewardClaimFailedTitle'),
            claimResult.message || translate('profileRewardClaimFailedMessage')
          );
          return;
        }
        setShowCompleteProfileClaimCta(false);
        await refreshCoins(true);
        showAlert(translate('profileSubmittedSuccessTitle'), translate('profileCompletedRewardSuccessMessage'), [
          { text: translate('ok'), onPress: () => {} },
        ]);
      } catch (claimErr: any) {
        setShowCompleteProfileClaimCta(false);
        await refreshCoins(true);
        console.error('[ProfileScreen] 領取獎勵錯誤:', claimErr);
        showAlert(
          translate('profileRewardClaimFailedTitle'),
          claimErr?.message || translate('profileRewardClaimFailedMessage')
        );
      }
    } catch (error: any) {
      console.error('更新用戶資料錯誤:', error);
      showAlert(translate('passwordUpdateErrorTitle'), error?.message || translate('passwordUpdateErrorMessage'));
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
      showAlert(translate('deleteAccountInputErrorTitle'), translate('deleteAccountInputErrorMessage'));
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
        showAlert(translate('deleteAccountFailedTitle'), result.message || translate('deleteAccountFailedMessage'));
      }
    } catch (e: any) {
      showAlert(translate('deleteAccountErrorTitle'), e?.message || translate('deleteAccountErrorMessage'));
    } finally {
      setIsDeleting(false);
    }
  };

  // 如果正在載入，顯示載入指示器
  if (isLoading) {
    return (
      <View style={styles.safe}>
        <View style={[styles.topBar, { height: headerHeight, paddingHorizontal: horizontalPadding }]}>
          <Pressable onPress={() => navigation.navigate(routes.MAIN as never)} hitSlop={8}>
            <Image style={[styles.profileIconTop, { width: iconSize, height: iconSize, borderRadius: iconSize / 2 }]} source={require('../../assets/blueeye.png')} />
          </Pressable>
        </View>
        <View style={[styles.container, styles.loadingContainer, { paddingHorizontal: horizontalPadding }]}>
          <ActivityIndicator size="large" color="#00a99d" />
          <Text style={[styles.loadingText, { fontSize: bodyFontSize }]}>{translate('profileLoading')}</Text>
        </View>
      </View>
    );
  }

  // 抓取失敗：不猜按鈕樣式，顯示錯誤訊息與重試
  if (loadFailed) {
    return (
      <View style={styles.safe}>
        <View style={[styles.topBar, { height: headerHeight, paddingHorizontal: horizontalPadding }]}>
          <Pressable onPress={() => navigation.navigate(routes.MAIN as never)} hitSlop={8}>
            <Image style={[styles.profileIconTop, { width: iconSize, height: iconSize, borderRadius: iconSize / 2 }]} source={require('../../assets/blueeye.png')} />
          </Pressable>
        </View>
        <View style={[styles.container, styles.loadingContainer, { paddingHorizontal: horizontalPadding }]}>
          <Text style={[styles.loadingText, { fontSize: bodyFontSize, textAlign: 'center', marginTop: 0 }]}>
            {translate('profileLoadFailedMessage')}
          </Text>
          <Pressable style={styles.retryBtn} onPress={loadUserProfile}>
            <Text style={[styles.retryBtnText, { fontSize: submitFontSize }]}>{translate('retry')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // 與 AppHeader（Android 主畫面）金幣 icon 一致：ms(20)
  const coinIconSmall = ms(20);
  const coinIconBtn = ms(20);
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
          <View style={[styles.topBar, { height: headerHeight, paddingHorizontal: horizontalPadding }]}>
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

              <Text style={[styles.title, { fontSize: titleFontSize }]}>{translate('profileMyInfoTitle')}</Text>

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
                    <Text
                      style={[styles.chargeText, { fontSize: walletFontSize }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.85}
                    >
                      {translate('profileTopUp')}
                    </Text>
                  </Pressable>
                  <Pressable style={styles.recordsBtn} onPress={() => navigation.navigate(routes.HISTORY as never)}>
                    <Text
                      style={[styles.linkText, { fontSize: walletFontSize }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.85}
                    >
                      {translate('profileViewRecords')}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* 暱稱 */}
              <View style={styles.inputRow}>
                <Text style={[styles.label, { fontSize: labelFontSize }]}>{translate('profileNicknameLabel')}</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder={translate('profileNicknamePlaceholder')}
                  placeholderTextColor="#9aa3ad"
                  selectionColor="#009688"
                  style={[styles.input, { fontSize: bodyFontSize }]}
                />
              </View>

              {/* 生日 */}
              <Pressable style={styles.inputRow} onPress={() => (Platform.OS === 'ios' ? openBirthdayPicker() : setShowDatePicker(true))}>
                <Text style={[styles.label, { fontSize: labelFontSize }]}>{translate('profileBirthdayLabel')}</Text>
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
                  <Text style={[styles.label, { fontSize: labelFontSize }]}>{translate('profileGenderLabel')}</Text>
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
                  <Text style={[styles.label, { fontSize: labelFontSize }]}>{translate('profileGenderLabel')}</Text>
                  <View style={styles.pickerBox}>
                    <Picker
                      selectedValue={gender}
                      onValueChange={(v) => setGender(v as GenderCode)}
                      dropdownIconColor="#cdd4db"
                      style={styles.picker}
                      itemStyle={{ color: '#e7eef6', fontSize: bodyFontSize }}
                    >
                      <Picker.Item label={translate('genderPleaseSelect')} value={0} />
                      <Picker.Item label={translate('genderMale')} value={1} />
                      <Picker.Item label={translate('genderFemale')} value={2} />
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
                  <Text style={[styles.deleteAccountText, { fontSize: labelFontSize }]}>{translate('deleteAccountLink')}</Text>
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
            <Text style={styles.modalTitle}>{translate('deleteAccountTitle')}</Text>
            <Text style={styles.modalMessage}>
              {translate('deleteAccountMessageBefore')}
              <Text style={styles.modalDeleteKeyword}>DELETE</Text>
              {translate('deleteAccountMessageAfter')}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={deleteConfirmInput}
              onChangeText={setDeleteConfirmInput}
              placeholder={translate('deleteAccountInputPlaceholder')}
              placeholderTextColor="#9aa3ad"
              selectionColor="#009688"
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!isDeleting}
            />
            <View style={styles.modalButtons}>
              <Pressable style={styles.modalCancelBtn} onPress={closeDeleteModal} disabled={isDeleting}>
                <Text style={styles.modalCancelText}>{translate('cancel')}</Text>
              </Pressable>
              <Pressable
                style={[styles.modalConfirmBtn, isDeleting && styles.modalConfirmBtnDisabled]}
                onPress={handleDeleteAccountConfirm}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>{translate('confirm')}</Text>
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
                <Pressable onPress={confirmBirthday} hitSlop={12}>
                  <Text style={styles.datePickerDoneText}>{translate('ok')}</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={draftBirthday ?? birthdayPickerValue}
                mode="date"
                display="spinner"
                onChange={onChangeDraftBirthday}
                maximumDate={new Date()}
                themeVariant="dark"
                accentColor="#009688"
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
                  <Picker.Item label={translate('genderPleaseSelect')} value={0} />
                  <Picker.Item label={translate('genderMale')} value={1} />
                  <Picker.Item label={translate('genderFemale')} value={2} />
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
    alignItems: 'center',
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
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 10,
    flexShrink: 1, // 寬度不足時可收縮，配合 adjustsFontSizeToFit 縮小文字
  },
  recordsBtn: {
    flexShrink: 1, // 同上：寬度不足時收縮，讓「查看紀錄」文字縮小而非溢出
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
    borderRadius: 25,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  label: { color: '#9aa3ad', marginBottom: 6 },
  input: {
    color: '#e7eef6',
    backgroundColor: '#1f2226',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },

  // ---- 生日盒 ----
  valueBox: {
    backgroundColor: '#1f2226',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  valueText: { color: '#e7eef6', flexShrink: 1 },
  arrow: { color: '#cdd4db' },
  valueTextPlaceholder: { color: '#9aa3ad' },

  // ---- 性別選單 ----
  pickerBox: { backgroundColor: '#1f2226', borderRadius: 25 },
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
    flexWrap: 'nowrap',
    gap: 4,
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
    marginLeft: 0,
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
  // ---- 載入失敗：重試按鈕 ----
  retryBtn: {
    marginTop: 16,
    backgroundColor: '#00a99d',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  retryBtnText: {
    color: '#eafff9',
    fontWeight: '800',
    letterSpacing: 0.3,
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
