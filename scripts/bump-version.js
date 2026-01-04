#!/usr/bin/env node

/**
 * 版本號自動遞增腳本
 * 
 * 使用方法:
 *   node scripts/bump-version.js [patch|minor|major]
 * 
 * 範例:
 *   node scripts/bump-version.js patch  # 1.0.0 -> 1.0.1
 *   node scripts/bump-version.js minor  # 1.0.0 -> 1.1.0
 *   node scripts/bump-version.js major  # 1.0.0 -> 2.0.0
 *   node scripts/bump-version.js        # 預設為 patch
 */

const fs = require('fs');
const path = require('path');

const BUILD_GRADLE_PATH = path.join(__dirname, '../android/app/build.gradle');
const GRADLE_PROPERTIES_PATH = path.join(__dirname, '../android/gradle.properties');
const APP_JSON_PATH = path.join(__dirname, '../app.json');
const IOS_PROJECT_PATH = path.join(__dirname, '../ios/storyappv2.xcodeproj/project.pbxproj');
const IOS_INFO_PLIST_PATH = path.join(__dirname, '../ios/storyappv2/Info.plist');

// 解析版本號 (例如: "1.0.0" -> [1, 0, 0])
function parseVersion(versionString) {
    return versionString.split('.').map(Number);
}

// 格式化版本號 (例如: [1, 0, 0] -> "1.0.0")
function formatVersion(versionArray) {
    return versionArray.join('.');
}

// 遞增版本號
function bumpVersion(versionString, type = 'patch') {
    const version = parseVersion(versionString);
    
    switch (type) {
        case 'major':
            version[0]++;
            version[1] = 0;
            version[2] = 0;
            break;
        case 'minor':
            version[1]++;
            version[2] = 0;
            break;
        case 'patch':
        default:
            version[2]++;
            break;
    }
    
    return formatVersion(version);
}

// 讀取 build.gradle 文件
function readBuildGradle() {
    return fs.readFileSync(BUILD_GRADLE_PATH, 'utf8');
}

// 更新 build.gradle 中的版本號
function updateBuildGradle(versionCode, versionName) {
    let content = readBuildGradle();
    
    // 更新 versionCode
    content = content.replace(
        /versionCode\s+\d+/,
        `versionCode ${versionCode}`
    );
    
    // 更新 versionName
    content = content.replace(
        /versionName\s+"[^"]+"/,
        `versionName "${versionName}"`
    );
    
    fs.writeFileSync(BUILD_GRADLE_PATH, content, 'utf8');
    console.log(`✅ 已更新 build.gradle: versionCode=${versionCode}, versionName=${versionName}`);
}

// 讀取 gradle.properties 文件
function readGradleProperties() {
    return fs.readFileSync(GRADLE_PROPERTIES_PATH, 'utf8');
}

// 更新 gradle.properties 中的版本號
function updateGradleProperties(versionCode, versionName) {
    let content = readGradleProperties();
    
    // 更新 VERSION_CODE
    content = content.replace(
        /^VERSION_CODE=\d+/m,
        `VERSION_CODE=${versionCode}`
    );
    
    // 更新 VERSION_NAME
    content = content.replace(
        /^VERSION_NAME=[^\n]+/m,
        `VERSION_NAME=${versionName}`
    );
    
    fs.writeFileSync(GRADLE_PROPERTIES_PATH, content, 'utf8');
    console.log(`✅ 已更新 gradle.properties: VERSION_CODE=${versionCode}, VERSION_NAME=${versionName}`);
}

// 讀取 app.json 文件（如果存在）
function readAppJson() {
    if (fs.existsSync(APP_JSON_PATH)) {
        return JSON.parse(fs.readFileSync(APP_JSON_PATH, 'utf8'));
    }
    return null;
}

// 更新 app.json 中的版本號（如果存在）
function updateAppJson(versionName) {
    const appJson = readAppJson();
    if (appJson) {
        // 處理 Expo 結構
        if (appJson.expo && appJson.expo.version) {
            appJson.expo.version = versionName;
        }
        // 處理根層級的 version
        if (appJson.version) {
            appJson.version = versionName;
        }
        fs.writeFileSync(APP_JSON_PATH, JSON.stringify(appJson, null, 2) + '\n', 'utf8');
        console.log(`✅ 已更新 app.json: version=${versionName}`);
    }
}

// 讀取 iOS project.pbxproj 文件
function readIOSProject() {
    if (fs.existsSync(IOS_PROJECT_PATH)) {
        return fs.readFileSync(IOS_PROJECT_PATH, 'utf8');
    }
    return null;
}

// 更新 iOS project.pbxproj 中的版本號
function updateIOSProject(versionName, buildNumber) {
    const content = readIOSProject();
    if (!content) {
        console.log('⚠️  iOS project.pbxproj 不存在，跳過 iOS 版本更新');
        return;
    }
    
    let updated = content;
    
    // 更新 MARKETING_VERSION (版本號，例如 1.0.0)
    updated = updated.replace(
        /MARKETING_VERSION = [^;]+;/g,
        `MARKETING_VERSION = ${versionName};`
    );
    
    // 更新 CURRENT_PROJECT_VERSION (build number)
    updated = updated.replace(
        /CURRENT_PROJECT_VERSION = [^;]+;/g,
        `CURRENT_PROJECT_VERSION = ${buildNumber};`
    );
    
    fs.writeFileSync(IOS_PROJECT_PATH, updated, 'utf8');
    console.log(`✅ 已更新 iOS project.pbxproj: MARKETING_VERSION=${versionName}, CURRENT_PROJECT_VERSION=${buildNumber}`);
}

// 讀取 iOS Info.plist 文件
function readIOSInfoPlist() {
    if (fs.existsSync(IOS_INFO_PLIST_PATH)) {
        return fs.readFileSync(IOS_INFO_PLIST_PATH, 'utf8');
    }
    return null;
}

// 更新 iOS Info.plist 中的版本號
function updateIOSInfoPlist(versionName, buildNumber) {
    const content = readIOSInfoPlist();
    if (!content) {
        console.log('⚠️  iOS Info.plist 不存在，跳過 Info.plist 版本更新');
        return;
    }
    
    let updated = content;
    
    // 更新 CFBundleShortVersionString (版本號)
    updated = updated.replace(
        /<key>CFBundleShortVersionString<\/key>\s*<string>[^<]+<\/string>/,
        `<key>CFBundleShortVersionString</key>\n    <string>${versionName}</string>`
    );
    
    // 更新 CFBundleVersion (build number)
    updated = updated.replace(
        /<key>CFBundleVersion<\/key>\s*<string>[^<]+<\/string>/,
        `<key>CFBundleVersion</key>\n    <string>${buildNumber}</string>`
    );
    
    fs.writeFileSync(IOS_INFO_PLIST_PATH, updated, 'utf8');
    console.log(`✅ 已更新 iOS Info.plist: CFBundleShortVersionString=${versionName}, CFBundleVersion=${buildNumber}`);
}

// 從 build.gradle 讀取當前版本號
function getCurrentVersion() {
    const content = readBuildGradle();
    const versionCodeMatch = content.match(/versionCode\s+(\d+)/);
    const versionNameMatch = content.match(/versionName\s+"([^"]+)"/);
    
    if (!versionCodeMatch || !versionNameMatch) {
        throw new Error('無法從 build.gradle 讀取版本號');
    }
    
    return {
        code: parseInt(versionCodeMatch[1], 10),
        name: versionNameMatch[1]
    };
}

// 主函數
function main() {
    const type = process.argv[2] || 'patch';
    
    if (!['patch', 'minor', 'major'].includes(type)) {
        console.error('❌ 錯誤: 版本類型必須是 patch, minor 或 major');
        process.exit(1);
    }
    
    try {
        // 讀取當前版本
        const current = getCurrentVersion();
        console.log(`📦 當前版本: ${current.name} (${current.code})`);
        
        // 計算新版本
        const newVersionName = bumpVersion(current.name, type);
        const newVersionCode = current.code + 1;
        
        console.log(`🚀 新版本: ${newVersionName} (${newVersionCode})`);
        console.log(`📝 版本類型: ${type}`);
        console.log('');
        
        // 更新所有文件
        updateBuildGradle(newVersionCode, newVersionName);
        updateGradleProperties(newVersionCode, newVersionName);
        updateAppJson(newVersionName);
        updateIOSProject(newVersionName, newVersionCode);
        updateIOSInfoPlist(newVersionName, newVersionCode);
        
        console.log('');
        console.log('✨ 版本號更新完成！');
        console.log('');
        console.log('下一步:');
        console.log('  Android:');
        console.log('    1. 構建 Release AAB: cd android && ./gradlew bundleRelease');
        console.log('    2. 上傳 AAB 到 Google Play Console');
        console.log('    3. 上傳 mapping 文件: android/app/mapping/mapping-' + newVersionName + '-' + newVersionCode + '.txt');
        console.log('  iOS:');
        console.log('    1. 構建 iOS: npm run build:ios 或 eas build --platform ios --profile production');
        console.log('    2. 提交到 App Store: eas submit --platform ios');
        
    } catch (error) {
        console.error('❌ 錯誤:', error.message);
        process.exit(1);
    }
}

main();

