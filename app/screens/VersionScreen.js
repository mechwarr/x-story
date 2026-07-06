import React, { useState, useEffect, useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import RenderHtml from 'react-native-render-html';

import AppHeader from '../components/AppHeader';
import Content from './Content';
import Screen from './Screen';
import { bookDataBaseUrl } from '../config/apiClient';
import { matchesCurrentStoryLang } from '../i18n/i18n';
import { useLanguage } from '../i18n/LanguageContext';
import useResponsive from '../hook/useResponsive';

// 版本資訊內容與排版一律走後端 about 端點即時渲染（後台改動立即生效），
// App 端只負責把後端 HTML 轉成 react-native-render-html 能正確呈現、且不超出容器的形式。

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
  // 1) <font> → <span>  2) 依 uiScale 縮放 px  3) 圖片寬度鎖在 renderWidth 內
  const html = useMemo(
    () => (rawHtml ? imgStyleToAttrs(scaleHtmlPx(fontToSpan(rawHtml), uiScale), renderWidth) : ''),
    [rawHtml, uiScale, renderWidth]
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
                // 深灰底頁面，預設字色設白避免黑字看不見
                baseStyle={{ color: '#ffffff' }}
                tagsStyles={{ img: { maxWidth: renderWidth } }}
              />
            </View>
          </View>
        </ScrollView>
      </Content>
    </Screen>
  );
}

export default VersionScreen;
