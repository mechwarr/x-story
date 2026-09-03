import routes from './routes';
import storage from '../storage/storage';
import { getBookstoreList, getEffectiveRoleLevel } from '../config/userApiClient';
import { canViewUnlisted } from '../config/roles';
import { matchesCurrentStoryLang } from '../i18n/i18n';
import {
  isPendingProfileRedirect,
  setPendingProfileRedirect,
  getProfileIncompletePersisted,
} from '../auth/firstLoginRedirect';

// 啟動落點判定（token 檢查通過後、掛載 Drawer 前呼叫；期間畫面顯示 BootScreen）：
// 「繼續觀看」頁會顯示至少一本書時落在繼續觀看，否則落在首頁——與 ContinueScreen 的
// 可見性過濾一致（語系 + 上架狀態 + role>=5 例外），避免落在空頁。
//
// 設計原則：
//  1. 三路資料（本機紀錄／角色／在架清單）「平行」採集，互不等待。
//  2. 整體共用一個 deadline：任何一路超時就以「未知」處理，判定總時長絕不超過
//     DECISION_DEADLINE_MS——不讓使用者對著過場畫面等單一請求的完整逾時（15 秒）。
//  3. 未知一律 fail-open（在架清單未知＝不誤擋；Book 點擊仍有 canContinueOwned 二次守門），
//     只有「確定沒有可見紀錄」才落首頁。
//  4. 絕不 throw、絕不彈窗：停權（role<=0）驅離、token 過期提示等 alert 流程由
//     useInitApp／sessionAuth／suspensionGuard 背景處理，與落點判定分離。
//     （api/users/me 已做 in-flight 去重，本模組與停權檢查共用同一發請求。）
const DECISION_DEADLINE_MS = 5000;

// deadline 哨兵：與所有正常回傳值都能區分（null / [] 都是合法結果）
const TIMED_OUT = { timedOut: true };

const makeDeadline = (ms) =>
  new Promise((resolve) => setTimeout(() => resolve(TIMED_OUT), ms));

// 以共用 deadline 等待單一路資料；超時回傳 undefined（呼叫端以「未知」處理）
const raceDeadline = async (promise, deadline, label) => {
  const result = await Promise.race([promise, deadline]);
  if (result === TIMED_OUT) {
    console.warn(`[startupRoute] ${label} 超過 ${DECISION_DEADLINE_MS}ms 未回應，以「未知」處理`);
    return undefined;
  }
  return result;
};

export async function decideInitialRoute() {
  try {
    // 冷啟動以既有 token 自動登入時不會經過 LoginContainer，記憶體旗標為空 →
    // 改讀持久化旗標（資料補齊前一直為真），讓「資料未完成」的使用者同樣先看到 ProfileScreen。
    if (!isPendingProfileRedirect() && (await getProfileIncompletePersisted())) {
      setPendingProfileRedirect(true);
    }
    // 個人資料未完成：一律落在 HOME（其內層 Stack 會直接顯示 ProfileScreen）。
    // 不可落在「繼續觀看」——那樣 HOME 這個 Stack 根本不會掛載，導向個人資料頁就永遠不會發生。
    if (isPendingProfileRedirect()) {
      console.log('[startupRoute] 個人資料未完成 → HOME（內層顯示 ProfileScreen）');
      return routes.HOME;
    }

    const deadline = makeDeadline(DECISION_DEADLINE_MS);

    // 三路平行採集（此刻即發出，之後才逐一 await）：
    //  - 本機閱讀紀錄：一般情況只讀 SecureStore + AsyncStorage（快）；SecureStore 尚無帳號 id 時
    //    會回查 profile（網路），該請求與 useInitApp 的停權檢查共用（in-flight 去重）。
    //  - 角色：優先 SecureStore 快取，快取缺失才回查 profile（同上共用）。
    //  - 在架清單：公開 API，取不到時 getBookstoreList 回 null（不與空清單混同）。
    const recordsPromise = storage.getStorys('continueStory').catch((e) => {
      console.warn('[startupRoute] 讀取閱讀紀錄失敗:', e?.message ?? e);
      return null;
    });
    const rolePromise = getEffectiveRoleLevel().catch(() => 0);
    const shelfPromise = getBookstoreList().catch(() => null);

    // 1) 本機紀錄 + 語系過濾（與 ContinueScreen 相同來源欄位）
    const records = await raceDeadline(recordsPromise, deadline, '閱讀紀錄');
    const langMatched = (Array.isArray(records) ? records : []).filter((it) =>
      matchesCurrentStoryLang(it?.storyData?.lang ?? it?.lang)
    );
    console.log(
      `[startupRoute] 紀錄 ${Array.isArray(records) ? records.length : '未知'} 筆、語系相符 ${langMatched.length} 筆`
    );
    if (!langMatched.length) return routes.HOME;

    // 2) role >= 5（小編／管理員）：未上架／已下架亦可見 → 有語系相符紀錄即落繼續觀看
    const roleLevel = await raceDeadline(rolePromise, deadline, '角色權限');
    if (canViewUnlisted(roleLevel)) {
      console.log(`[startupRoute] roleLevel ${roleLevel} 可見未上架 → 繼續觀看`);
      return routes.CONTINUE;
    }

    // 3) 一般用戶：至少一本紀錄仍在架才落繼續觀看；在架清單未知（失敗／超時）→ 不誤擋
    const shelf = await raceDeadline(shelfPromise, deadline, '在架清單');
    const onShelfIds = Array.isArray(shelf)
      ? new Set(
          shelf
            .filter((b) => b?.isActive !== false)
            .map((b) => Number(b?.storyListId))
        )
      : null;
    const hasVisible = !onShelfIds
      ? true
      : langMatched.some((it) => onShelfIds.has(Number(it?.storyId)));
    console.log(
      `[startupRoute] roleLevel ${roleLevel ?? '未知'}、在架清單 ${
        onShelfIds ? `${onShelfIds.size} 本` : '未知(不誤擋)'
      }、有可見紀錄: ${hasVisible}`
    );
    return hasVisible ? routes.CONTINUE : routes.HOME;
  } catch (e) {
    // 任何意外都不得卡住啟動：退回首頁並留下原因
    console.warn('[startupRoute] 判定過程出錯，退回首頁:', e?.message ?? e);
    return routes.HOME;
  }
}
