import React, { useState, useEffect } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";

import AppHeader from "../components/AppHeader";
import Screen from "./Screen";
import Content from "./Content";
import colors from "../config/colors";
import useResponsive from "../hook/useResponsive";
import routes from "../navigations/routes";
import { translate } from "../i18n/i18n";
import { useLanguage, LANGUAGE_OPTIONS } from "../i18n/LanguageContext";
import Storage, {
  DEFAULT_AUTO_PLAY_SECONDS,
  MIN_AUTO_PLAY_SECONDS,
  MAX_AUTO_PLAY_SECONDS,
} from "../auth/Storage";

// 設定畫面：
//  - 語系：以下拉選單在 繁體中文 / 簡體中文 / English 之間手動切換。
//    切換後會持久化並標記為手動，且整個畫面子樹會以新語系重新掛載（見 _layout.tsx 的 LanguageGate）。
//  - 自動播放速度：以 < 秒數 > 步進器調整劇情自動播放的每段間隔（範圍 1~10 秒），持久化於 Storage。
function LanguageScreen() {
  const { scale } = useResponsive();
  const { lang, changeLanguage } = useLanguage();
  const navigation = useNavigation();
  const [open, setOpen] = useState(false);
  const [autoPlaySeconds, setAutoPlaySeconds] = useState(
    DEFAULT_AUTO_PLAY_SECONDS
  );

  const current =
    LANGUAGE_OPTIONS.find((o) => o.code === lang) ?? LANGUAGE_OPTIONS[0];

  const fs = Math.round(16 * scale);

  // 載入已儲存的自動播放間隔
  useEffect(() => {
    let mounted = true;
    Storage.getAutoPlaySeconds().then((s) => {
      if (mounted) setAutoPlaySeconds(s);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // 調整自動播放間隔（範圍 MIN~MAX_AUTO_PLAY_SECONDS）並持久化
  const changeAutoPlaySeconds = (delta) => {
    setAutoPlaySeconds((prev) => {
      const next = Math.min(
        MAX_AUTO_PLAY_SECONDS,
        Math.max(MIN_AUTO_PLAY_SECONDS, prev + delta)
      );
      Storage.setAutoPlaySeconds(next);
      return next;
    });
  };

  const handleSelect = (code) => {
    setOpen(false);
    if (code === lang) return;

    // 先把抽屜目前路由切回首頁，再切換語系。
    // 切換語系會透過 LanguageGate 以新語系 key 重新掛載整個畫面；
    // 此時 React Navigation 會還原抽屜路由，先導回 HOME 可確保重繪後停在首頁而非語系設定頁。
    navigation.navigate(routes.HOME);
    changeLanguage(code);
  };

  return (
    <Screen>
      <AppHeader />
      <Content>
        <Text style={[styles.label, { fontSize: Math.round(15 * scale) }]}>
          {translate("selectLanguage")}
        </Text>

        {/* 下拉觸發器：顯示目前語言 */}
        <Pressable
          style={styles.trigger}
          onPress={() => setOpen((v) => !v)}
          hitSlop={8}
        >
          <Text style={[styles.triggerText, { fontSize: fs }]}>
            {current.label}
          </Text>
          <Text style={[styles.caret, { fontSize: fs }]}>
            {open ? "▲" : "▼"}
          </Text>
        </Pressable>

        {/* 展開的選項清單 */}
        {open && (
          <View style={styles.dropdown}>
            {LANGUAGE_OPTIONS.map((opt, idx) => {
              const selected = opt.code === lang;
              return (
                <Pressable
                  key={opt.code}
                  style={[
                    styles.option,
                    idx < LANGUAGE_OPTIONS.length - 1 && styles.optionDivider,
                    selected && styles.optionSelected,
                  ]}
                  onPress={() => handleSelect(opt.code)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      { fontSize: fs },
                      selected && styles.optionTextSelected,
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {selected && (
                    <Text style={[styles.check, { fontSize: fs }]}>✓</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        {/* 自動播放速度：< 秒數 > 步進器，範圍 1~10 秒（只保留最快的 10 檔） */}
        <Text
          style={[
            styles.label,
            styles.autoPlayLabel,
            { fontSize: Math.round(15 * scale) },
          ]}
        >
          {translate("autoPlaySpeed")}
        </Text>
        <View style={styles.stepper}>
          <Pressable
            style={[
              styles.stepBtn,
              autoPlaySeconds <= MIN_AUTO_PLAY_SECONDS && styles.stepBtnDisabled,
            ]}
            onPress={() => changeAutoPlaySeconds(-1)}
            disabled={autoPlaySeconds <= MIN_AUTO_PLAY_SECONDS}
            hitSlop={8}
          >
            <Text style={[styles.stepCaret, { fontSize: fs }]}>{"<"}</Text>
          </Pressable>
          <Text style={[styles.stepValue, { fontSize: fs }]}>
            {translate("autoPlaySecondsUnit", { n: autoPlaySeconds })}
          </Text>
          <Pressable
            style={[
              styles.stepBtn,
              autoPlaySeconds >= MAX_AUTO_PLAY_SECONDS && styles.stepBtnDisabled,
            ]}
            onPress={() => changeAutoPlaySeconds(1)}
            disabled={autoPlaySeconds >= MAX_AUTO_PLAY_SECONDS}
            hitSlop={8}
          >
            <Text style={[styles.stepCaret, { fontSize: fs }]}>{">"}</Text>
          </Pressable>
        </View>
      </Content>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.personalText,
    marginBottom: 10,
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#4A4A4D",
    borderWidth: 1,
    borderColor: colors.textInputBorder,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  triggerText: {
    color: colors.white,
    fontWeight: "bold",
  },
  caret: {
    color: colors.personalText,
    marginLeft: 12,
  },
  dropdown: {
    marginTop: 6,
    backgroundColor: "#2F2F31",
    borderWidth: 1,
    borderColor: colors.textInputBorder,
    borderRadius: 8,
    overflow: "hidden",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  optionDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.textInputBorder,
  },
  optionSelected: {
    backgroundColor: "rgba(110,195,197,0.12)",
  },
  optionText: {
    color: colors.white,
  },
  optionTextSelected: {
    color: colors.versionText,
    fontWeight: "bold",
  },
  check: {
    color: colors.versionText,
    marginLeft: 12,
  },
  autoPlayLabel: {
    marginTop: 28,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#4A4A4D",
    borderWidth: 1,
    borderColor: colors.textInputBorder,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  stepBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  stepBtnDisabled: {
    opacity: 0.35,
  },
  stepCaret: {
    color: colors.white,
    fontWeight: "bold",
  },
  stepValue: {
    color: colors.white,
    fontWeight: "bold",
  },
});

export default LanguageScreen;
