import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, View } from 'react-native';

import AppHeader from '../components/AppHeader';
import Screen from './Screen';
import { useIsFocused } from '@react-navigation/native';

import Content from './Content';
import AppText from '../components/AppText';
import storage from '../storage/storage';
import Book from '../components/Book/Book';
import colors from '../config/colors';
import { isEmpty } from 'lodash';
import { translate } from '../i18n/i18n';

function ContinueScreen() {
  const [storyCache, setStoryCache] = useState(null);
  const isFocus = useIsFocused();

  useEffect(() => {
    async function getStories() {
      const continueStory = await storage.getStorys('continueStory');
      setStoryCache({ continueStory });
    }
    getStories(!storyCache?.continueStory);
  }, [isFocus]);
  return (
    <Screen>
      <AppHeader />
      <Content>
        <View style={styles.books}>
          {!storyCache?.continueStory || isEmpty(storyCache?.continueStory) ? (
            <AppText style={styles.noBooks}>{translate('noBooksViewed')}</AppText>
          ) : (
            <FlatList
              data={storyCache?.continueStory ?? []}
              keyExtractor={(item) => item?.storyId?.toString()}
              numColumns={2}
              renderItem={({ item }) => <Book {...item} showIcon={true} />}
            />
          )}
        </View>
      </Content>
    </Screen>
  );
}

const styles = StyleSheet.create({
  books: {
    alignItems: 'flex-start',
  },
  noBooks: {
    color: colors.white,
    fontSize: 20,
    // fontWeight: 'bold',
  },
});

export default ContinueScreen;
