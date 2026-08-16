// app/auth/firstLoginRedirect.ts
// 「個人資料未完成」→ 進入主畫面時直接以 ProfileScreen 為落點（見 navigations/StoryNavigator.js）。
//
// 兩層旗標：
// 1) module 範圍的暫存旗標（本檔下方）：由 LoginContainer 在「主動登入成功」時設定，
//    StoryNavigator 掛載時取用一次。
// 2) 持久化旗標（AsyncStorage）：記住「此帳號個人資料尚未完成」，讓 App 冷啟動以既有 token
//    自動登入（不經過 LoginContainer）時同樣先進 ProfileScreen —— 否則新用戶登入後沒填完
//    就把 App 殺掉，之後每次啟動都直接進首頁，再也不會被提醒補資料。
//    由 ProfileScreen 每次載入／更新成功時同步；資料補齊即清除。
//    登出時會被 storage.deleteAllStorage() 一併清掉（它只保留閱讀紀錄鍵），故不需帳號命名空間。
import AsyncStorage from '@react-native-async-storage/async-storage';

const PROFILE_INCOMPLETE_KEY = 'profileIncomplete';

let pendingProfileRedirect = false;

export function setPendingProfileRedirect(value: boolean): void {
  pendingProfileRedirect = value;
}

/** 只讀取、不清除：供 AppNavigator 決定 Drawer 落點（真正的取用在 StoryNavigator） */
export function isPendingProfileRedirect(): boolean {
  return pendingProfileRedirect;
}

/** 取用並清除旗標（只會回傳 true 一次） */
export function consumePendingProfileRedirect(): boolean {
  const pending = pendingProfileRedirect;
  pendingProfileRedirect = false;
  return pending;
}

/**
 * 寫入持久化旗標。只在「確實知道結果」時呼叫（例如 profile 取得成功、或更新成功後），
 * 取不到 profile 時不要寫入，避免把暫時性的網路失敗誤記成「資料未完成」。
 */
export async function setProfileIncompletePersisted(incomplete: boolean): Promise<void> {
  try {
    if (incomplete) {
      await AsyncStorage.setItem(PROFILE_INCOMPLETE_KEY, '1');
    } else {
      await AsyncStorage.removeItem(PROFILE_INCOMPLETE_KEY);
    }
  } catch (e) {
    // 寫入失敗只會讓「冷啟動導向」失準，不影響登入流程
    console.warn('[firstLoginRedirect] 持久化旗標寫入失敗（忽略）:', (e as any)?.message);
  }
}

/** 讀取持久化旗標（冷啟動自動登入時判斷是否仍需先進 ProfileScreen） */
export async function getProfileIncompletePersisted(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PROFILE_INCOMPLETE_KEY)) === '1';
  } catch (e) {
    console.warn('[firstLoginRedirect] 持久化旗標讀取失敗（視為已完成）:', (e as any)?.message);
    return false;
  }
}
