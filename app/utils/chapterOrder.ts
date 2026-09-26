// app/utils/chapterOrder.ts
//
// 章節／場次顯示排序：一律依後端的 `order` 欄位（補零字串 "01"、"02"…）由小到大排列。
//
// 為什麼需要這支工具：
//  - api/v1/admin/chapter/{storyId} 與 api/v1/admin/screenings/{storyId}/{chapterId} 回傳順序都是
//    id 遞增、與 `order` 無關，後台調整 order 時 App 不會跟著變。
//  - 章節頁（顯示順序）與 StoryScreen（播畢接「下一章」）必須用同一套順序，否則會出現
//    「畫面上的下一章」與「實際接續的下一章」不一致，故集中一處共用。
import { parseBookOrder } from './bookOrder';

type Ordered = { order?: string | number | null };

// 只以 order 為排序依據（不看 id）；無 order / 無法解析者排最後。
// 撞號時 Array.prototype.sort 為穩定排序，維持 API 回傳的相對順序。
// 回傳新陣列，不改動傳入的 API 回應。
const sortByOrder = <T extends Ordered>(list?: T[] | null): T[] =>
  [...(Array.isArray(list) ? list : [])].sort((a, b) => {
    const oa = parseBookOrder(a?.order);
    const ob = parseBookOrder(b?.order);
    // Infinity - Infinity 為 NaN，須先擋掉相等的情況
    return oa === ob ? 0 : oa - ob;
  });

export const sortChaptersByOrder = sortByOrder;

// 場次（screenings）：StoryScreen 以「陣列位置」當場次索引（index.screen、存檔的 cachedIndex.screen、
// 試閱截斷 slice(0, read_range_end) 皆是），故須在取得清單的當下就排好，後續一律用排序後的位置。
export const sortScreeningsByOrder = sortByOrder;
