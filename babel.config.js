/**
 * 這是 React Native/Expo 專案的 Babel 設定檔。
 * 它必須放在專案的根目錄中 (與 package.json 同一層)。
 */
module.exports = {
  // 這是 Expo 專案的標準預設集 (Preset)
  presets: ['babel-preset-expo'],
  
  plugins: [
    // 其他任何您可能需要的 Babel 插件放在這裡...
    
    // VITAL: Reanimated 插件必須是列表中的最後一個！
    // 這是解決 NoSuchFieldException 錯誤的關鍵配置。
    'react-native-reanimated/plugin',
  ],
};
