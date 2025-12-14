// apiClient.ts
import { RestfulApi } from "./api";

export const devBaseUrl = "http://api.xstudio-mclub.url.tw/";
export const prodBaseUrl = "https://xstoryline.com/";
export const portURL = "http://20.198.216.126:3001/";
const api = new RestfulApi({
  devBaseUrl,
  prodBaseUrl,
  isDev: __DEV__,
});

export default api;
