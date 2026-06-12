// i18n/initLanguage.ts
import * as RNLocalize from 'react-native-localize';
import Storage from '../auth/Storage';
import { setLanguage, normalizeLang } from './i18n';

// 安全地取得裝置語系；原生模組不存在或拋錯時退回 'en'，避免啟動即閃退
const getDeviceLangCode = (): string => {
  try {
    return RNLocalize.getLocales()[0]?.languageTag ?? 'en';
  } catch (e) {
    console.error('getDeviceLangCode error', e);
    return 'en';
  }
};

export const initLanguageByLoginStatus = async (isLoggedIn: boolean) => {
  try {
    let langCode: string | null = null;

    if (isLoggedIn) {
      langCode = await Storage.getUserLangCode();
      if (!langCode) {
        // 存入前先正規化，SecureStore 只保留 en / zh-TW / zh-CN
        langCode = normalizeLang(getDeviceLangCode());
        await Storage.setUserLangCode(langCode);
      }
    } else {
      langCode = normalizeLang(getDeviceLangCode());
      await Storage.setUserLangCode(langCode);
    }

    setLanguage(langCode);
  } catch (e) {
    // 任何意外都不該阻擋 App 啟動，最差退回英文
    console.error('initLanguageByLoginStatus error', e);
    setLanguage('en');
  }
};
