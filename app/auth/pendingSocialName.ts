// app/auth/pendingSocialName.ts
// 社群登入時在 App 端「盡力」解出可顯示的暱稱，暫存供 ProfileScreen 於後端 name 為空時預填。
// 不落盤、不送後端；使用者按「更新」才會透過 updateUserProfile 存回後端。
// 沿用 firstLoginRedirect 的 module 旗標模式（登入 → 進 Profile 屬同一 session）。
//
// 各登入方式 App 端實際可取得的名稱（實查結果）：
// - Google：res.user 內含 name / givenName / email / id，idToken(JWT) 亦含 name/email → 可解出真實暱稱。
// - Apple ：wrapper 只回 user(識別碼字串) + idToken；全名僅首次授權才有且目前未帶回 → 不預填。
// - Facebook：只有 accessToken，名稱需另打 FB Graph → 不預填。
// - WeChat：只有一次性 code，暱稱只能後端換 userinfo → App 端退為固定字「微信用戶」。

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentGoogleUser } from '../../components/utils/googleAuth';

/**
 * 持久化鍵：只放在記憶體時，Google 登入後尚未按「更新」就把 App 殺掉／被系統回收，
 * 下次冷啟動（自動登入 → 導回 Profile）暱稱就不見了。
 * 登出時會被 storage.deleteAllStorage() 一併清掉，故不需帳號命名空間。
 */
const PENDING_SOCIAL_NAME_KEY = 'pendingSocialName';

let pendingSocialName: string | null = null;

/** 設定暫存暱稱（空字串／空白視為無 → null），同步寫入／清除持久化值 */
export function setPendingSocialName(name?: string | null): void {
  pendingSocialName = name && String(name).trim() ? String(name).trim() : null;
  const task = pendingSocialName
    ? AsyncStorage.setItem(PENDING_SOCIAL_NAME_KEY, pendingSocialName)
    : AsyncStorage.removeItem(PENDING_SOCIAL_NAME_KEY);
  task.catch((e) => console.warn('[pendingSocialName] 持久化失敗:', e));
}

/** 讀取但不清除：讓使用者多次進出 Profile 仍能預填，直到存回後端或重新登入覆蓋 */
export function peekPendingSocialName(): string | null {
  return pendingSocialName;
}

/**
 * 後端暱稱為空時的預填來源（依序）：
 * 1) 記憶體暫存 → 2) 持久化值（冷啟動）→ 3) Google SDK 目前登入者（email 須與本帳號相同，
 *    避免裝置上殘留的另一個 Google 帳號名稱被帶進來）。
 */
export async function resolvePendingSocialName(accountEmail?: string | null): Promise<string | null> {
  if (pendingSocialName) return pendingSocialName;
  try {
    const stored = await AsyncStorage.getItem(PENDING_SOCIAL_NAME_KEY);
    if (stored && stored.trim()) {
      pendingSocialName = stored.trim();
      return pendingSocialName;
    }
  } catch (e) {
    console.warn('[pendingSocialName] 讀取持久化值失敗:', e);
  }
  try {
    const gUser: any = getCurrentGoogleUser();
    const u = gUser?.user ?? gUser;
    const gEmail = u?.email ? String(u.email).trim().toLowerCase() : null;
    const email = accountEmail ? String(accountEmail).trim().toLowerCase() : null;
    if (gEmail && email && gEmail === email) {
      return firstNonEmpty(u?.name, u?.givenName, localPart(u?.email));
    }
  } catch (e) {
    console.warn('[pendingSocialName] 取得 Google 目前使用者失敗:', e);
  }
  return null;
}

/** 存回後端成功後清除，避免殘留 */
export function clearPendingSocialName(): void {
  pendingSocialName = null;
  AsyncStorage.removeItem(PENDING_SOCIAL_NAME_KEY).catch(() => {});
}

function localPart(email?: string | null): string | null {
  if (!email || typeof email !== 'string') return null;
  const at = email.indexOf('@');
  const s = (at > 0 ? email.slice(0, at) : email).trim();
  return s || null;
}

/** 解 JWT payload（與 appleAuth 的 parseJwt 同法，Hermes 具備全域 atob） */
function decodeJwtPayload(token?: string | null): any | null {
  try {
    if (!token) return null;
    const part = String(token).split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(b64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function firstNonEmpty(...vals: Array<string | null | undefined>): string | null {
  for (const v of vals) {
    if (v && String(v).trim()) return String(v).trim();
  }
  return null;
}

/**
 * Google 登入結果 → best-effort 暱稱。
 * 相容兩種結構：@react-native-google-signin 的 data.user.{name,email,...}，
 * 以及部分版本直接平坦掛在 data 上的情況。最後退回 idToken JWT 與 id。
 */
export function deriveGoogleDisplayName(res: any): string | null {
  const d = res?.user ?? {};
  const u = d?.user ?? d;
  const jwt = decodeJwtPayload(res?.idToken);
  return firstNonEmpty(
    u?.name,
    u?.givenName,
    u?.given_name,
    d?.name,
    d?.givenName,
    localPart(u?.email),
    localPart(d?.email),
    jwt?.name,
    jwt?.given_name,
    localPart(jwt?.email),
    u?.id,
    d?.id
  );
}
