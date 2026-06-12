// 全域自訂 Alert：以自繪 Modal 取代原生 Alert.alert，雙平台外觀一致。
// 用法與 Alert.alert 相同：showAlert(title, message?, buttons?, options?)
// 需在 App 根部掛一次 <CustomAlertHost />（見 _layout.tsx）。
import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Alert as RNAlert,
} from 'react-native';
import colors from '../config/colors';
import useResponsive from '../hook/useResponsive';

export type AlertButtonStyle = 'default' | 'cancel' | 'destructive';

export type AlertButton = {
  text?: string;
  onPress?: () => void;
  style?: AlertButtonStyle;
};

export type AlertOptions = {
  cancelable?: boolean;
  onDismiss?: () => void;
};

type AlertConfig = {
  title?: string;
  message?: string;
  buttons: AlertButton[];
  options?: AlertOptions;
};

// host 掛載後填入；未掛載前以原生 Alert 兜底，避免提示遺失。
let enqueue: ((config: AlertConfig) => void) | null = null;

/**
 * 與 React Native Alert.alert 相同簽名的替代品，改用自訂 Modal 呈現。
 */
export function showAlert(
  title?: string,
  message?: string,
  buttons?: AlertButton[],
  options?: AlertOptions
): void {
  const config: AlertConfig = {
    title,
    message,
    buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }],
    options,
  };
  if (enqueue) {
    enqueue(config);
  } else {
    // host 尚未掛載（極早期）：退回原生 Alert，確保訊息不會消失。
    RNAlert.alert(title ?? '', message, buttons as any, options as any);
  }
}

export function CustomAlertHost(): React.ReactElement | null {
  const [current, setCurrent] = useState<AlertConfig | null>(null);
  const queueRef = useRef<AlertConfig[]>([]);
  const { ms } = useResponsive();

  useEffect(() => {
    // 用 functional update 取最新狀態，避免閉包讀到舊的 current。
    enqueue = (config: AlertConfig) => {
      setCurrent((cur) => {
        if (cur) {
          queueRef.current.push(config);
          return cur;
        }
        return config;
      });
    };
    return () => {
      enqueue = null;
    };
  }, []);

  const showNext = () => {
    const next = queueRef.current.shift() ?? null;
    setCurrent(next);
  };

  const handleButton = (btn: AlertButton) => {
    setCurrent(null);
    btn.onPress?.();
    // 給淡出動畫一點時間，再顯示佇列中的下一則。
    setTimeout(showNext, 180);
  };

  const handleBackdrop = () => {
    if (!current) return;
    // 預設可關閉（與 iOS 預設一致）；cancelable: false 則不可點外部關閉。
    if (current.options?.cancelable === false) return;
    const cancelBtn = current.buttons.find((b) => b.style === 'cancel');
    setCurrent(null);
    cancelBtn?.onPress?.();
    current.options?.onDismiss?.();
    setTimeout(showNext, 180);
  };

  if (!current) return null;

  const buttons = current.buttons;
  // 1~2 顆橫排（如原生 iOS）；3 顆以上直排，避免擠壓。
  const stacked = buttons.length > 2;

  const renderButton = (btn: AlertButton, index: number) => {
    const isCancel = btn.style === 'cancel';
    const isDestructive = btn.style === 'destructive';
    return (
      <Pressable
        key={index}
        style={({ pressed }) => [
          styles.button,
          stacked ? styles.buttonStacked : styles.buttonInline,
          isCancel
            ? styles.buttonCancel
            : isDestructive
            ? styles.buttonDestructive
            : styles.buttonPrimary,
          pressed && styles.buttonPressed,
        ]}
        onPress={() => handleButton(btn)}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.buttonText,
            { fontSize: ms(16) },
            isCancel
              ? styles.buttonCancelText
              : isDestructive
              ? styles.buttonDestructiveText
              : styles.buttonPrimaryText,
          ]}
        >
          {btn.text ?? 'OK'}
        </Text>
      </Pressable>
    );
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleBackdrop}
    >
      <Pressable style={styles.overlay} onPress={handleBackdrop}>
        <Pressable style={[styles.card, { maxWidth: ms(340) }]} onPress={(e) => e.stopPropagation()}>
          {!!current.title && <Text style={[styles.title, { fontSize: ms(18) }]}>{current.title}</Text>}
          {!!current.message && (
            <Text style={[styles.message, { fontSize: ms(15), lineHeight: ms(22) }]}>{current.message}</Text>
          )}
          <View style={[styles.buttonRow, stacked && styles.buttonColumn]}>
            {buttons.map(renderButton)}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingTop: 22,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: Platform.OS === 'ios' ? '600' : 'bold',
    color: '#222',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: '#444',
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  buttonColumn: {
    flexDirection: 'column',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonInline: {
    flex: 1,
  },
  buttonStacked: {
    width: '100%',
    marginBottom: 8,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonCancel: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#d9d9d9',
  },
  buttonDestructive: {
    backgroundColor: colors.danger,
  },
  buttonText: {
    fontSize: 16,
  },
  buttonPrimaryText: {
    color: '#fff',
    fontWeight: '600',
  },
  buttonCancelText: {
    color: '#333',
  },
  buttonDestructiveText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default CustomAlertHost;
