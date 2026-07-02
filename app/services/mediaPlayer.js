import { Audio } from 'expo-av';

// 單一播放管理（全域）：同一時間只允許一個對象在播放——音樂 / 音效 / 影片擇一。
// 任何新的播放都會先停止「目前對象（currentPlayer）」，再接手成為新的目前對象；
// 離開劇情頁時呼叫 release() 立即停止並釋放，避免背景殘留播放與記憶體洩漏。
//
// 設計重點：
//  - 對外（元件的點擊 / 載入事件）一律是同步呼叫，不用 async/await，呼叫後立即返回；
//    expo-av 內部不可避免的非同步一律在本模組內以 fire-and-forget（.catch 吞錯）收斂。
//  - currentPlayer 是唯一的「目前對象狀態」，只持有一個 { stop } 物件。

// 目前對象：{ stop: () => void }。null = 沒有任何東西在播。
let current = null;
// 目前的音效實例（Audio.Sound）。影片不在此持有（沿用元件自己的 <Video> ref）。
let soundInstance = null;

// 停止並清掉「目前對象」。音效會 stop+unload 釋放記憶體；影片會 pause。
function stopCurrent() {
  const c = current;
  current = null;
  if (c && typeof c.stop === 'function') {
    try {
      c.stop();
    } catch (e) {
      // 停止失敗不應影響後續播放
    }
  }
}

// 播放音效：先停掉前一個對象，再建立並播放。元件端維持同步呼叫。
function playSound(url) {
  stopCurrent();
  // 先用 entry 佔住 current：若建立過程中又有新的播放插入（current 被換掉），
  // 建立完成後可據此判斷「我已不是目前對象」→ 直接卸載、不要播。
  const entry = {
    stop: () => {
      const s = soundInstance;
      soundInstance = null;
      if (s) {
        s.stopAsync().catch(() => {});
        s.unloadAsync().catch(() => {});
      }
    },
  };
  current = entry;

  Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {});
  Audio.Sound.createAsync({ uri: url }, { shouldPlay: true })
    .then(({ sound }) => {
      if (current !== entry) {
        // 已被新的播放取代 → 釋放這顆，不接管。
        sound.unloadAsync().catch(() => {});
        return;
      }
      soundInstance = sound;
      // 播畢自動釋放，並清掉目前對象狀態。
      sound.setOnPlaybackStatusUpdate((st) => {
        if (st && st.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          if (soundInstance === sound) soundInstance = null;
          if (current === entry) current = null;
        }
      });
    })
    .catch((e) => {
      if (current === entry) current = null;
      console.warn('[mediaPlayer] playSound 失敗:', e?.message || e);
    });
}

// 播放影片：沿用元件自己的 expo-av <Video> ref。先停掉前一個對象再播；stop = 暫停。
function playVideo(videoRef) {
  stopCurrent();
  const entry = {
    stop: () => {
      videoRef.current?.pauseAsync?.().catch(() => {});
    },
  };
  current = entry;
  videoRef.current?.playAsync?.().catch(() => {});
}

// 釋放：停止目前對象並清空狀態（離開劇情頁 / 進背景時呼叫）。
function release() {
  stopCurrent();
}

export default { playSound, playVideo, release };
