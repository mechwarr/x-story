import React, { useState, useEffect } from 'react';
import { ScrollView } from 'react-native';
import RenderHtml from 'react-native-render-html';

import AppHeader from '../components/AppHeader';
import Content from './Content';
import Screen from './Screen';
import apiclient from '../config/apiClient';
import useResponsive from '../hook/useResponsive';

function VersionScreen() {
  const [quote, setQuote] = useState('');
  const { contentWidth } = useResponsive();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(apiclient.currentBaseUrl() + 'api/v1/admin/about');
        if (!response.ok) {
          throw new Error('API請求失敗');
        }
        const data = await response.json();
        if (data.length > 0) {
          // 替換相對圖片URL為絕對URL，使用 apiclient.currentBaseUrl()
          const modifiedHtml = data[0].about_content.replace(
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
  }, []);

  return (
    <Screen>
      <AppHeader />
      <Content>
        <ScrollView>
          <RenderHtml contentWidth={contentWidth} source={{ html: quote }} />
        </ScrollView>
      </Content>
    </Screen>
  );
}

export default VersionScreen;
