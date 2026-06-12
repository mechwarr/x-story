// apiClient.ts
import { RestfulApi } from "./api";

export const devBaseUrl = "http://api.xstudio-mclub.url.tw/";
export const prodBaseUrl = "https://xstoryline.com/";
export const portURL = "http://20.198.216.126:3001/";

// 書籍資料專用 base URL（menu / news / story-type / nochapter / story-list 等 admin 端點）。
// 一律走正式站、不隨 __DEV__ 切換：書籍的 lang / story_type 等分類欄位以正式站為準，
// dev 站可能缺欄位或資料不一致，會導致依語系/類別篩選後整個分類消失。
// 需要切換書籍資料來源時只改這裡，各畫面不要再硬編 URL。
export const bookDataBaseUrl = prodBaseUrl;
const api = new RestfulApi({
  devBaseUrl,
  prodBaseUrl,
  isDev: __DEV__,
});

export default api;
