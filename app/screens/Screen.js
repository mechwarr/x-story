import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Platform, SafeAreaView } from 'react-native';
import colors from '../config/colors';
import useResponsive from '../hook/useResponsive';

function Screen({ children, style }) {
  const { isTablet, maxContentWidth, horizontalPadding } = useResponsive();

  return (
    <SafeAreaView style={[styles.container, { paddingHorizontal: horizontalPadding }, style]}>
      <StatusBar style='auto' hidden={true} />
      <View style={[styles.content, isTablet && { maxWidth: maxContentWidth, alignSelf: 'center', width: '100%' }]}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: Platform.OS === 'android' ? 15 : 47,
    flex: 1,
    backgroundColor: colors.homeBackground,
  },
  content: {
    flex: 1,
  },
});

export default Screen;
