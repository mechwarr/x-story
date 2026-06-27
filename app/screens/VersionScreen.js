import React, { useState, useEffect } from 'react';
import { ScrollView, useWindowDimensions } from 'react-native';
import RenderHtml from 'react-native-render-html';

import AppHeader from '../components/AppHeader';
import Content from './Content';
import Screen from './Screen';
import apiclient from '../config/apiClient';
import { matchesCurrentStoryLang } from '../i18n/i18n';
import { useLanguage } from '../i18n/LanguageContext';

// Content 元件左右各有 15 的 padding，RenderHtml 的 contentWidth 必須扣掉，
// 否則會以整個螢幕寬排版、右側文字與圖片被父層裁切（排版跑掉）。
const CONTENT_PADDING = 15;

function VersionScreen() {
  const [quote, setQuote] = useState('');
  const { width } = useWindowDimensions();
  const { lang } = useLanguage();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(apiclient.currentBaseUrl() + 'api/v1/admin/about');
        if (!response.ok) {
          throw new Error('API請求失敗');
        }
        const data = await response.json();
        if (data.length > 0) {
          // about 端點會回多筆（繁中／簡中／English），各筆以 lang 欄位區分。
          // 後端 lang 欄位的字形/文案不統一，故用既有的 matchesCurrentStoryLang 依
          // App 目前語系挑選對應那筆，找不到才退回第一筆。
          const entry = data.find((d) => matchesCurrentStoryLang(d.lang)) ?? data[0];
          // 替換相對圖片URL為絕對URL，使用 apiclient.currentBaseUrl()
          const modifiedHtml = entry.about_content.replace(
            /src="\/images\//g,
            `src="${apiclient.currentBaseUrl()}images/`
          );
          setQuote(modifiedHtml);
        }
      } catch (error) {
        console.error(error);
      }
    };

    fetchData();
  }, [lang]);

  const contentWidth = width - CONTENT_PADDING * 2;

  return (
    <Screen>
      <AppHeader />
      <Content>
        <ScrollView>
          <RenderHtml
            contentWidth={contentWidth}
            source={{ html: quote }}
            tagsStyles={{ img: { maxWidth: contentWidth } }}
          />
        </ScrollView>
      </Content>
    </Screen>
  );
}

export default VersionScreen;
