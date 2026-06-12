import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

import AppHeader from "../components/AppHeader";
import Screen from "./Screen";
import Content from "./Content";
import colors from "../config/colors";
import useResponsive from "../hook/useResponsive";
import { translate } from "../i18n/i18n";
import { useLanguage, LANGUAGE_OPTIONS } from "../i18n/LanguageContext";

// 語系設定畫面：以下拉選單在 繁體中文 / 簡體中文 / English 之間手動切換。
// 切換後會持久化並標記為手動，且整個畫面子樹會以新語系重新掛載（見 _layout.tsx 的 LanguageGate）。
function LanguageScreen() {
  const { scale } = useResponsive();
  const { lang, changeLanguage } = useLanguage();
  const [open, setOpen] = useState(false);

  const current =
    LANGUAGE_OPTIONS.find((o) => o.code === lang) ?? LANGUAGE_OPTIONS[0];

  const fs = Math.round(16 * scale);

  const handleSelect = (code) => {
    setOpen(false);
    if (code !== lang) {
      // 切換後 LanguageGate 會以新語系 key 重新掛載整個畫面
      changeLanguage(code);
    }
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
});

export default LanguageScreen;
