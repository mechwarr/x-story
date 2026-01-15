/**
 * 這是 React Native/Expo 專案的 Babel 設定檔。
 * 它必須放在專案的根目錄中 (與 package.json 同一層)。
 */
module.exports = {
  // 這是 Expo 專案的標準預設集 (Preset)
  presets: ['babel-preset-expo'],
  
  plugins: [
    // 其他任何您可能需要的 Babel 插件放在這裡...
    
    // 在 Production 環境移除 console.log（提升效能並避免洩漏資訊）
    // 注意：此插件必須在 react-native-reanimated/plugin 之前
    // 需要先安裝：npm install --save-dev babel-plugin-transform-remove-console
    // 暫時註釋掉，如果需要在 production 環境移除 console，請先安裝插件：
    // npm install --save-dev babel-plugin-transform-remove-console
    // process.env.NODE_ENV === 'production' && [
    //   'transform-remove-console',
    //   {
    //     exclude: ['error', 'warn'], // 保留 console.error 和 console.warn
    //   },
    // ],
    
    // VITAL: Reanimated 插件必須是列表中的最後一個！
    // 這是解決 NoSuchFieldException 錯誤的關鍵配置。
    'react-native-reanimated/plugin',
  ].filter(Boolean), // 過濾掉 false 值（開發環境時）
};
