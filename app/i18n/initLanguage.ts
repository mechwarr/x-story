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

    // 使用者若曾於「語系設定」中手動切換，啟動時一律沿用已儲存的語系，
    // 不再依裝置語系自動覆蓋（無論登入與否）。
    const isManual = await Storage.getUserLangManual();
    if (isManual) {
      langCode = await Storage.getUserLangCode();
      if (!langCode) {
        // 理論上手動切換時一定有存語系；萬一缺失才退回裝置語系（不覆蓋手動旗標）
        langCode = normalizeLang(getDeviceLangCode());
        await Storage.setUserLangCode(langCode);
      }
    } else if (isLoggedIn) {
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
