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

let pendingSocialName: string | null = null;

/** 設定暫存暱稱（空字串／空白視為無 → null） */
export function setPendingSocialName(name?: string | null): void {
  pendingSocialName = name && String(name).trim() ? String(name).trim() : null;
}

/** 讀取但不清除：讓使用者多次進出 Profile 仍能預填，直到存回後端或重新登入覆蓋 */
export function peekPendingSocialName(): string | null {
  return pendingSocialName;
}

/** 存回後端成功後清除，避免殘留 */
export function clearPendingSocialName(): void {
  pendingSocialName = null;
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
