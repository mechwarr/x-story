import routes from './routes';

// 回首頁（HomeScreen）的共用導覽。
//
// React Navigation 7 的 navigate 不會退回堆疊裡既有的同名畫面：目前畫面不是 MAIN 時一律推入新的
// 一頁。必須帶 pop: true 才會退回既有的 MAIN，並把它上面的畫面（含 STORY）移除。
// 沒退回的話，故事頁會被壓在新首頁底下繼續掛載：之後它被移除時，離開保底存檔會把舊進度寫回
// 「繼續觀看」；再從首頁開同一本書，還會疊出第二個故事頁，兩個實例輪流覆寫同一本書的進度。
// 堆疊裡沒有 MAIN（例如首次登入落在 PROFILE）時 pop 找不到目標，照常推入。
//
// 以 HOME 巢狀導覽送出：Drawer 層的畫面（繼續觀看、選單）與 HOME Stack 內的畫面都能直接用。
// navigation 可以是原生 navigation 或 useGuardedNavigate 回傳的物件（只用到 navigate）。
export default function navigateHome(navigation) {
  navigation.navigate(routes.HOME, { screen: routes.MAIN, pop: true });
}
