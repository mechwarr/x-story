// i18n/LanguageContext.tsx
//
// 提供 App 內手動切換語系的能力。
// translate() 讀取的是模組層級的 currentLang（見 i18n.ts），本身不會觸發 React 重繪，
// 因此這裡用一個 React state（lang）作為「語系版本」，搭配 _layout.tsx 中以 lang 為 key 的
// 重新掛載機制，讓切換語系後整個畫面重新渲染、套用新語系文案。
import React, {
  createContext,
  useCallback,
  useContext,
  useState,
  ReactNode,
} from 'react';
import { setLanguage, getCurrentLang, normalizeLang } from './i18n';
import Storage from '../auth/Storage';

// 可供使用者選擇的語系（顯示名稱一律以該語言本身呈現）
export const LANGUAGE_OPTIONS: { code: string; label: string }[] = [
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'zh-CN', label: '简体中文' },
  { code: 'en', label: 'English' },
];

type LanguageContextType = {
  lang: string;
  changeLanguage: (code: string) => Promise<void>;
};

const LanguageContext = createContext<LanguageContextType>({
  lang: getCurrentLang(),
  changeLanguage: async () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  // 初始值取自模組層級的 currentLang（此時語系初始化已完成，見 useInitApp）
  const [lang, setLang] = useState<string>(() => getCurrentLang());

  const changeLanguage = useCallback(
    async (code: string) => {
      const normalized = normalizeLang(code);
      if (normalized === getCurrentLang()) return;

      // 1) 立即更新模組層級語系，讓接下來的 translate() 使用新語系
      setLanguage(normalized);

      // 2) 持久化並標記為「手動切換」，使下次啟動不再依裝置語系自動覆蓋
      try {
        await Storage.setUserLangCode(normalized);
        await Storage.setUserLangManual(true);
      } catch (e) {
        console.error('changeLanguage persist error', e);
      }

      // 3) 更新 state → 觸發以 lang 為 key 的重新掛載，整個畫面套用新語系
      setLang(normalized);
    },
    []
  );

  return (
    <LanguageContext.Provider value={{ lang, changeLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
