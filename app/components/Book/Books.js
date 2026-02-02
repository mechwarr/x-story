import React, { useMemo } from 'react';
import { View, StyleSheet, FlatList, Platform } from 'react-native';
import colors from '../../config/colors';
import AppText from '../AppText';
import Book from './Book';

function Books({ type, config, storyList, storyCache, nochapter }) {
  const {
    story_type_size = 20,
    story_type_color = '#fff',
    story_type_weight = '',
  } = config;
  
  const renderItem = ({ item,index }) => <Book storyData={item} storyCache={storyCache} nochapter={nochapter} index={index}/>;

  const listData = useMemo(
    () => storyList.filter((e) => e?.story_type === type?.story_type),
    [storyList]
  );

  if (!listData?.length) return;
  
  return (
    <View style={styles.container}>
      {!storyList?.length ? null : (
        <>
          <AppText
            style={{
              fontSize: story_type_size ?? 20,
              color: story_type_color ?? colors.leftChatBackground,
              ...(story_type_weight === '粗' && {
                fontWeight: Platform.OS === 'ios' ? 600 : 'bold',
              }),
            }}
          >
            {type?.story_type}
          </AppText>
          <FlatList
            data={listData}
            keyExtractor={(item) => item?.id?.toString()}
            horizontal={true}
            renderItem={renderItem}
            showsHorizontalScrollIndicator={false}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 15,
  },
  type: {
    fontSize: 21,
    fontWeight: 'bold',
    color: colors.leftChatBackground,
  },
  name: {
    fontSize: 21,
  },
});

export default Books;
