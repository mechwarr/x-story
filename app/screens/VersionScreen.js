import React, { useState, useEffect, useMemo } from 'react';
import { ScrollView, View, Linking } from 'react-native';
import RenderHtml, {
  defaultFallbackFonts,
  defaultSystemFonts,
} from 'react-native-render-html';

import AppHeader from '../components/AppHeader';
import Content from './Content';
import Screen from './Screen';
import { bookDataBaseUrl } from '../config/apiClient';
import { matchesCurrentStoryLang } from '../i18n/i18n';
import { useLanguage } from '../i18n/LanguageContext';
import useResponsive from '../hook/useResponsive';

// 版本資訊內容與排版一律走後端 about 端點即時渲染（後台改動立即生效），
// App 端只負責把後端 HTML 轉成 react-native-render-html 能正確呈現、且不超出容器的形式。

// ⚠️ React 19 相容性（重要）：React 19 移除了 function component 的 defaultProps 支援，
// 而 react-native-render-html@6.3.4 的 TRenderEngineProvider 全靠 defaultProps 提供
// enableCSSInlineProcessing / ignoredStyles / systemFonts 等預設值。在本專案（React 19 /
// Expo SDK 53）下這些預設值全部變成 undefined → inline CSS 處理被關閉，後台的
// color / font-size / font-weight / text-align 全部被無聲忽略（後台改樣式 App 沒反應的根因）。
// 解法：下方 <RenderHtml> 把原本 defaultProps 會給的值全部「顯式」傳入。
// 若未來升級/更換 render-html 版本已內建 React 19 支援，可再簡化。
const HTML_PARSER_OPTIONS = { decodeEntities: true };
const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};

// Content 元件左右各有 15 的 padding，RenderHtml 的 contentWidth 必須扣掉，
// 否則會以整個螢幕寬排版、右側文字與圖片被父層裁切（排版跑掉）。
const CONTENT_PADDING = 15;

// 後端 about 內容用網頁編輯器產生，文字/圖片全被包在已廢棄的 <font> 標籤裡
// （例如 <font color="#ffffff">…</font>）。react-native-render-html 不支援 <font>，
// 會把整個 <font> 連同子節點一起丟棄 → 文字消失、被包在 <font> 內的圖片也消失
// （繁中的圖片就在 <font> 內，所以整頁空白）。
// 這裡把 <font> 轉成 RNRH 支援的 <span>，並把 color 屬性併入 inline style 保留字色。
const fontToSpan = (html) =>
  html
    .replace(/<font\b([^>]*)>/gi, (_, attrs) => {
      const color = (attrs.match(/color\s*=\s*["']([^"']*)["']/i) || [])[1];
      const style = (attrs.match(/style\s*=\s*["']([^"']*)["']/i) || [])[1] || '';
      const merged = `${color ? `color:${color};` : ''}${style}`;
      return merged ? `<span style="${merged}">` : '<span>';
    })
    .replace(/<\/font>/gi, '</span>');

// 後台編輯器（Summernote）輸出兩種 RNRH 的 CSS 解析器不認得的寫法，直接整條丟棄：
// 1) 「font-weight: bolder」：bolder 關鍵字不在支援清單 → 粗體失效，改寫成 bold。
// 2) 「!important」：宣告解析失敗 → 整條樣式失效（繁中 QR 的 li 用 color+!important
//    隱藏列表圓點），把 !important 拿掉讓宣告本身生效。
const normalizeCssQuirks = (html) =>
  html.replace(/\s*!important/gi, '').replace(/font-weight\s*:\s*bolder/gi, 'font-weight: bold');

// RN 不支援 float。編輯器的圖片靠左/靠右輸出「float:left/right」+ class="note-float-*"。
// 對齊由下方 classesStyles 依 note-float-* class 轉譯成原生 justifyContent；這裡保底：
// 只有 float 樣式、沒帶 note-float class 的圖片（後台手貼 HTML 的情況）補上對應 class。
const ensureFloatClass = (html) =>
  html.replace(/<img\b([^>]*?)>/gi, (tag, attrs) => {
    const float = (attrs.match(/float\s*:\s*(left|right)/i) || [])[1];
    if (!float || /note-float-/i.test(attrs)) return tag;
    const cls = `note-float-${float.toLowerCase()}`;
    if (/class\s*=/i.test(attrs)) {
      return `<img${attrs.replace(
        /class\s*=\s*["']([^"']*)["']/i,
        (_m, c) => `class="${c} ${cls}"`
      )}>`;
    }
    return `<img class="${cls}"${attrs}>`;
  });

// 圖片/字級都是絕對 px（img 的 width:150px、span 的 font-size:15px）。為了與 App
// 其餘元件一致的 RWD：手機（uiScale=1）維持編輯器原始規格；平板（uiScale=1.15）所有
// px 一併放大，跟字體/圖標/間距同步。只縮放 px；rem/% 交給 RenderHtml 依 contentWidth。
const scaleHtmlPx = (html, uiScale) =>
  uiScale === 1
    ? html
    : html.replace(/([\d.]+)px/g, (_, n) => `${(parseFloat(n) * uiScale).toFixed(2)}px`);

// react-native-render-html@6 不會採用 <img> inline style 裡的 width/height，
// 而是拿圖片「原始像素」再截到 contentWidth → sponsor(1645px)、copyright(2031px)
// 這種大圖會被畫到整個螢幕寬，遠大於編輯器設定的 113/250。
// 解法：把 style 的 width/height 抽成 <img> 的 width/height 屬性（RNRH 對屬性尺寸最可靠），
// 照編輯器比例呈現；並把寬度硬鎖在 maxWidth（容器寬）內，超出就等比縮小、高度同步縮，
// 確保圖片絕不超出 React 容器。
const imgStyleToAttrs = (html, maxWidth) =>
  html.replace(/<img\b([^>]*?)>/gi, (tag, attrs) => {
    const style = (attrs.match(/style\s*=\s*["']([^"']*)["']/i) || [])[1] || '';
    const w = (style.match(/width\s*:\s*([\d.]+)px/i) || [])[1];
    const h = (style.match(/height\s*:\s*([\d.]+)px/i) || [])[1];
    let injected = '';
    if (w && !/\bwidth\s*=/.test(attrs)) {
      const w0 = parseFloat(w);
      // 夾在容器寬內
      const cappedW = Math.min(Math.round(w0), Math.floor(maxWidth));
      injected += ` width="${cappedW}"`;
      if (h && !/\bheight\s*=/.test(attrs)) {
        // 高度按同比例縮，維持長寬比不變形
        const h0 = parseFloat(h);
        injected += ` height="${Math.round(h0 * (cappedW / w0))}"`;
      }
    }
    return injected ? `<img${injected}${attrs}>` : tag;
  });

// 「圖文同一行」支援：RNRH 會把 <img> 一律提升成獨立區塊（強制換行），後台
// 「Copyright @ <img logo>」這種文字+圖片同行的排版會被拆成兩行。
// 這裡在 DOM 解析階段找出「同一個 <div> 的直接內容裡同時有非空白文字與圖片」的節點，
// 加上 img-text-row class，由 classesStyles 轉成 flexDirection:row 讓文字與圖片並排。
// 巢狀 <div>/<ul> 不往下算（它們本來就是獨立區塊），避免誤把整段包成一行。
const isWhitespace = (s) => !s || !s.replace(/[\s\u00a0]+/g, '');
const hasInlineTextAndImg = (el) => {
  let hasImg = false;
  let hasText = false;
  const walk = (nodes) => {
    for (const n of nodes || []) {
      if (n.type === 'text') {
        if (!isWhitespace(n.data)) hasText = true;
      } else if (n.type === 'tag') {
        // 區塊型子節點自成一段，不列入「同一行」判定
        if (n.name === 'div' || n.name === 'ul' || n.name === 'ol' || n.name === 'table') continue;
        if (n.name === 'img') hasImg = true;
        walk(n.children);
      }
    }
  };
  walk(el.children);
  return hasImg && hasText;
};
const domVisitors = {
  onElement(el) {
    if (el.name === 'div' && hasInlineTextAndImg(el)) {
      el.attribs = el.attribs || {};
      el.attribs.class = `${el.attribs.class || ''} img-text-row`.trim();
    }
    // 後台編輯器輸出 <ul type="­">（軟連字號等非標準值）代表「不要列表圓點」；
    // 另有 li 用「marker 顏色=頁面背景色」的隱藏技巧，RNRH 的 marker 不吃 li 顏色，
    // 故一律把非標準 type 的 ul 轉成無標記列表，忠實還原後台「無圓點」的意圖。
    if (el.name === 'ul') {
      const t = ((el.attribs && el.attribs.type) || '').trim().toLowerCase();
      if (t && !['disc', 'circle', 'square'].includes(t)) {
        el.attribs.style = `${el.attribs.style ? `${el.attribs.style};` : ''}list-style-type: none;`;
      }
      // 網頁的列表圓點（marker）會繼承 li 的 color（後台靠「li 字色=頁面背景色」把圓點
      // 藏進背景），但 RNRH 的 marker 只吃 ul 自身的 color → 把第一個 li 的 inline color
      // 補到 ul 上，讓 marker 顏色跟網頁行為一致。
      const ulStyle = (el.attribs && el.attribs.style) || '';
      if (!/(^|;)\s*color\s*:/i.test(ulStyle)) {
        const li = (el.children || []).find((n) => n.type === 'tag' && n.name === 'li');
        const liColor =
          li && (((li.attribs && li.attribs.style) || '').match(/color\s*:\s*([^;]+)/i) || [])[1];
        if (liColor) {
          el.attribs = el.attribs || {};
          el.attribs.style = `${ulStyle ? `${ulStyle};` : ''}color:${liColor.trim()};`;
        }
      }
    }
  },
};

// 圖片對齊：RNRH 的圖片容器寫死 justifyContent:'center'（全域置中），但 tagsStyles /
// classesStyles 會合併在其後，可覆蓋。網頁區塊圖片預設是靠左，所以 img 預設給
// flex-start 對齊編輯器行為；editor 靠右（note-float-right）轉成 flex-end。
const classesStyles = {
  'note-float-left': { justifyContent: 'flex-start' },
  'note-float-right': { justifyContent: 'flex-end' },
  // 圖文同行容器：橫向排列、垂直置中、超寬自動換行
  'img-text-row': { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
};

// 後台的 mailto / LINE 連結：v6 預設 <a> 只有樣式沒有點擊行為，需經 renderersProps 接上。
const renderersProps = {
  a: {
    onPress: (_event, href) => {
      if (href) Linking.openURL(href).catch(() => {});
    },
  },
};

function VersionScreen() {
  const [rawHtml, setRawHtml] = useState('');
  const { contentWidth: availableWidth, uiScale } = useResponsive();
  const { lang } = useLanguage();

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 版本資訊固定走正式站（bookDataBaseUrl）：dev/測試站的 about 端點常無資料或連不上，
        // 會導致 fetch 失敗、文本整頁空白。正式站三種語系（繁中／簡中／English）資料齊全。
        const url = bookDataBaseUrl + 'api/v1/admin/about';
        console.log('[VersionScreen] fetch about:', url);
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('API請求失敗 HTTP ' + response.status);
        }
        const data = await response.json();
        console.log('[VersionScreen] about 筆數:', Array.isArray(data) ? data.length : 'not-array');
        if (data.length > 0) {
          // about 端點會回多筆（繁中／簡中／English），各筆以 lang 欄位區分。
          // 後端 lang 欄位的字形/文案不統一，故用既有的 matchesCurrentStoryLang 依
          // App 目前語系挑選對應那筆，找不到才退回第一筆。
          const entry = data.find((d) => matchesCurrentStoryLang(d.lang)) ?? data[0];
          // 相對圖片 URL 補成正式站絕對 URL（繁中那筆是 /images/ 相對路徑）
          setRawHtml(
            entry.about_content.replace(/src="\/images\//g, `src="${bookDataBaseUrl}images/`)
          );
        }
      } catch (error) {
        console.error(error);
      }
    };

    fetchData();
  }, [lang]);

  // availableWidth 已處理平板（≤ MAX_CONTENT_WIDTH），再扣掉 Content 左右 padding。
  const contentWidth = availableWidth - CONTENT_PADDING * 2;
  // render-html 的斷行寬度估算偶爾會讓一行比 contentWidth 略寬，若外層剛好用
  // contentWidth 做 overflow:hidden，就會把行尾單字「切掉」而不是換行。
  // 故給 RenderHtml 一點斷行餘裕（比外層裁切容器窄 WRAP_SAFETY），讓文字提早換行、
  // 不會碰到裁切邊界；overflow:hidden 只當作真正過寬元素的最後防線。
  const WRAP_SAFETY = 8;
  const renderWidth = contentWidth - WRAP_SAFETY;

  // 在 render 層轉換 HTML：這裡才拿得到寬度去夾圖片。
  // 1) <font> → <span>  2) CSS 怪異值正規化  3) float → note-float class 保底
  // 4) 依 uiScale 縮放 px  5) 圖片寬度鎖在 renderWidth 內
  const html = useMemo(
    () =>
      rawHtml
        ? imgStyleToAttrs(
            scaleHtmlPx(ensureFloatClass(normalizeCssQuirks(fontToSpan(rawHtml))), uiScale),
            renderWidth
          )
        : '',
    [rawHtml, uiScale, renderWidth]
  );

  // 深灰底頁面，未指定字色的內容預設白色（後台有指定的顏色會覆蓋此預設）。
  const baseStyle = useMemo(() => ({ fontSize: 14, color: '#ffffff' }), []);
  const tagsStyles = useMemo(
    () => ({
      // maxWidth 防呆 + 預設靠左（覆蓋 RNRH 寫死的置中，對齊網頁區塊圖片預設行為）
      img: { maxWidth: renderWidth, justifyContent: 'flex-start' },
    }),
    [renderWidth]
  );

  return (
    <Screen>
      <AppHeader />
      <Content>
        <ScrollView>
          {/* 外層：固定寬 + overflow hidden，任何殘留溢出都被裁在容器內（最後防線）。
              內層：固定寬 renderWidth 作為 render-html 的「實際父容器」。RNRH 斷行是依父
              容器實寬、而非 contentWidth prop，故必須用真正固定寬的 View 才夾得住文字；
              RN 的 <Text> 不會超出父容器，因此文字一定在 renderWidth 內斷行、不會被裁到。 */}
          <View style={{ width: contentWidth, overflow: 'hidden' }}>
            <View style={{ width: renderWidth }}>
              <RenderHtml
                contentWidth={renderWidth}
                source={{ html }}
                baseStyle={baseStyle}
                tagsStyles={tagsStyles}
                classesStyles={classesStyles}
                domVisitors={domVisitors}
                renderersProps={renderersProps}
                // ── 以下為 React 19 下失效的 defaultProps 顯式補回（見檔頭說明）──
                htmlParserOptions={HTML_PARSER_OPTIONS}
                emSize={14}
                ignoredDomTags={EMPTY_ARRAY}
                ignoredStyles={EMPTY_ARRAY}
                customHTMLElementModels={EMPTY_OBJECT}
                enableUserAgentStyles={true}
                enableCSSInlineProcessing={true}
                fallbackFonts={defaultFallbackFonts}
                systemFonts={defaultSystemFonts}
              />
            </View>
          </View>
        </ScrollView>
      </Content>
    </Screen>
  );
}

export default VersionScreen;
