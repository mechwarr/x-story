// apiClient.ts
import { RestfulApi } from "./api";

export const devBaseUrl = "http://api.xstudio-mclub.url.tw/";
export const prodBaseUrl = "http://20.198.216.126:3001";
//https://xstoryline.com/
const api = new RestfulApi({
  devBaseUrl,
  prodBaseUrl,
  isDev: __DEV__,
});

export default api;
