// 解鎖成功後「開始閱讀」的落點解析（Book 卡片／章節項目／故事頁覆蓋層三處共用）。
//
// 規則：一律直接進故事頁（不經章節列表、不跳章節介紹），落點依本帳號的「繼續觀看」紀錄：
//  - 沒有紀錄                     → 第一章（不分章節書＝本書）第一場次。
//  - 紀錄停在場次中間             → 原樣回到停下的那句（同「繼續觀看」，不跳過沒讀完的部分）。
//  - 紀錄所在場次已讀完           → 下一場次；本章已無下一場 → 下一章第一場次。
//  - 已是整本最後（無下一場/下一章、或下一段即結束哨符）→ 從頭開始。
// 「被選項跳轉擋下」的購買不走這裡：由 StoryScreen 直接接續到選項目的地。
import axios from 'axios';
import apiclient from '../config/apiClient';
import storage from '../storage/storage';
import { matchesBookLang } from '../i18n/i18n';
import { sortChaptersByOrder, sortScreeningsByOrder } from '../utils/chapterOrder';

// 與 StoryScreen 的 isStoryEnd 同一定義：order 為 '999999' 或空白＝整本結束哨符。
const isStoryEnd = (item) => {
  const o = String(item?.order ?? '').trim();
  return o === '' || o === '999999';
};

// 章節依「這本書」的語系過濾（非 App 語系），跨語言的已購書才取得到章節。
const fetchChapterList = async (storyId, bookLang) => {
  const res = await axios.get(apiclient.currentBaseUrl() + `api/v1/admin/chapter/${storyId}`);
  return sortChaptersByOrder(
    (Array.isArray(res?.data) ? res.data : []).filter((c) => matchesBookLang(c?.lang, bookLang))
  );
};

// 判斷紀錄所在場次是否已讀完。回傳：
//  'partial'  → 還沒讀完（或含待選選項），應原樣續讀
//  'done'     → 已讀到場次最後一句，應進下一場
//  'bookEnd'  → 下一段即整本結束哨符
// 註：讀到「結尾」段時 StoryScreen 會立刻換場、結尾段不會進 path，
//     故「最後一句的下一段是結尾」即代表本場已讀完。
const getSceneProgress = async ({ storyId, chapterId, screen, path }) => {
  const URL = apiclient.currentBaseUrl();
  const screenings = sortScreeningsByOrder(
    (await axios.get(URL + `api/v1/admin/screenings/${storyId}/${chapterId}`))?.data
  );
  const screeningId = screenings[screen]?.id;
  if (!screeningId) return { progress: 'partial', screeningCount: screenings.length };
  const content = (
    (await axios.get(URL + `api/v1/admin/content/${storyId}/${chapterId}/${screeningId}`))?.data ?? []
  )
    .slice()
    .sort((a, b) => a.order - b.order);
  const lastOrder = String(path[path.length - 1]);
  const lastIdx = content.findIndex((c) => String(c?.order) === lastOrder);
  const last = content[lastIdx];
  const next = content[lastIdx + 1];
  if (lastIdx < 0 || !next || last?.choice1Content) {
    return { progress: 'partial', screeningCount: screenings.length };
  }
  if (isStoryEnd(next)) return { progress: 'bookEnd', screeningCount: screenings.length };
  if (next.contentPresent === '結尾') return { progress: 'done', screeningCount: screenings.length };
  return { progress: 'partial', screeningCount: screenings.length };
};

// 回傳 STORY 的 route params；無法決定落點（如章節清單取不到又沒有紀錄）時回傳 null，
// 由呼叫端退回各自原本的導向。
// fallback：不分章節書的 chapterId / read_range_end / free_open（章節書以章節清單為準）。
export const resolveStartReadingParams = async ({
  storyId,
  storyData,
  nochapter,
  name,
  author,
  fallback = {},
}) => {
  const isChapterBook = storyData?.chapter_type === '章節';
  const base = { storyId, name, author, storyData, nochapter };

  let chapters = [];
  if (isChapterBook) {
    try {
      chapters = await fetchChapterList(storyId, storyData?.lang);
    } catch (e) {
      console.warn('[startReading] 章節清單取不到:', e?.message ?? e);
    }
  }
  const chapterParams = (ch) =>
    isChapterBook
      ? { chapterId: ch?.id, read_range_end: ch?.read_range_end, free_open: ch?.free_open }
      : {
          chapterId: fallback.chapterId,
          read_range_end: fallback.read_range_end,
          free_open: fallback.free_open,
        };

  const fromBeginning = () => {
    if (isChapterBook && !chapters.length) return null;
    return { ...base, ...chapterParams(chapters[0]) };
  };

  const records = (await storage.getStorys('continueStory')) ?? [];
  const record = records.find((r) => Number(r?.storyId) === Number(storyId));
  const cached = record?.cachedIndex;
  if (!record || !cached || record.chapterId == null) return fromBeginning();

  // 原樣續讀：沿用存檔的章節與試閱設定（同 Book.goToContinue）。
  const resume = {
    ...base,
    chapterId: record.chapterId,
    nochapter: record.nochapter ?? nochapter,
    read_range_end: record.read_range_end ?? fallback.read_range_end,
    free_open: record.free_open ?? fallback.free_open,
    cachedIndex: cached,
  };
  const path = Array.isArray(cached.path) ? cached.path : [];
  // 空 path＝「下一場起點」存檔（上一場已讀完、新場一句都還沒看）→ 本身就是下一場。
  if (!path.length) return resume;

  let scene;
  try {
    scene = await getSceneProgress({
      storyId,
      chapterId: record.chapterId,
      screen: Number(cached.screen) || 0,
      path,
    });
  } catch (e) {
    console.warn('[startReading] 場次內容取不到，原樣續讀:', e?.message ?? e);
    return resume;
  }
  console.log('[startReading] 紀錄場次進度 →', { storyId, chapterId: record.chapterId, screen: cached.screen, ...scene });

  if (scene.progress === 'partial') return resume;

  const restart = async () => {
    // 已讀到整本最後：清掉停在結尾的紀錄，從頭開始。
    await storage.deleteStory({ storyId: record.storyId }, 'continueStory');
    return fromBeginning();
  };
  if (scene.progress === 'bookEnd') return restart();

  const nextScreen = (Number(cached.screen) || 0) + 1;
  if (nextScreen < scene.screeningCount) {
    return {
      ...resume,
      cachedIndex: { story: 0, screen: nextScreen, scrollOffset: 0, path: [] },
    };
  }
  if (isChapterBook) {
    const idx = chapters.findIndex((c) => String(c?.id) === String(record.chapterId));
    if (idx < 0) return resume; // 章節清單取不到或對不到本章 → 不冒險，原樣續讀
    if (idx + 1 < chapters.length) return { ...base, ...chapterParams(chapters[idx + 1]) };
  }
  return restart();
};
