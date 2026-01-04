#!/usr/bin/env node

/**
 * 自動添加 Hermes dSYM Build Phase 到 Xcode 項目
 * 這個腳本會在 project.pbxproj 中添加一個新的 Run Script Phase
 * 用於在構建時複製 hermes.framework 的 dSYM 文件
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROJECT_FILE = path.join(__dirname, '../ios/storyappv2.xcodeproj/project.pbxproj');

// 生成 24 字符的 UUID（Xcode 格式）
function generateUUID() {
    const chars = '0123456789ABCDEF';
    let uuid = '';
    for (let i = 0; i < 24; i++) {
        uuid += chars[Math.floor(Math.random() * chars.length)];
    }
    return uuid;
}

function addHermesDSYMPhase() {
    console.log('🔧 開始添加 Hermes dSYM Build Phase...\n');

    // 檢查項目文件是否存在
    if (!fs.existsSync(PROJECT_FILE)) {
        console.error(`❌ 找不到項目文件: ${PROJECT_FILE}`);
        process.exit(1);
    }

    let projectContent = fs.readFileSync(PROJECT_FILE, 'utf8');

    // 檢查是否已經存在
    if (projectContent.includes('Copy Hermes dSYM') || 
        projectContent.includes('hermes.framework.dSYM') && 
        projectContent.includes('DWARF_DSYM_FOLDER_PATH')) {
        console.log('✅ 已存在 Hermes dSYM Build Phase，無需重複添加');
        return;
    }

    // 生成 UUID
    const phaseUUID = generateUUID();
    const phaseName = 'Copy Hermes dSYM';

    // 構建腳本內容
    const shellScript = `# 複製 hermes.framework 的 dSYM 到 Archive
HERMES_DSYM_PATH="\\${PODS_ROOT}/hermes-engine/Pre-built/dSYMs/hermes.framework.dSYM"
HERMES_DSYM_PATH_ALT="\\${PODS_ROOT}/hermes-engine/dSYMs/hermes.framework.dSYM"

if [ -d "$HERMES_DSYM_PATH" ]; then
    echo "Copying Hermes dSYM from $HERMES_DSYM_PATH"
    cp -R "$HERMES_DSYM_PATH" "\\${DWARF_DSYM_FOLDER_PATH}/"
elif [ -d "$HERMES_DSYM_PATH_ALT" ]; then
    echo "Copying Hermes dSYM from $HERMES_DSYM_PATH_ALT"
    cp -R "$HERMES_DSYM_PATH_ALT" "\\${DWARF_DSYM_FOLDER_PATH}/"
fi`;

    // 創建新的 Build Phase 條目
    const newPhase = `		${phaseUUID} /* ${phaseName} */ = {
			isa = PBXShellScriptBuildPhase;
			alwaysOutOfDate = 1;
			buildActionMask = 2147483647;
			files = (
			);
			inputPaths = (
			);
			name = "${phaseName}";
			outputPaths = (
			);
			runOnlyForDeploymentPostprocessing = 0;
			shellPath = /bin/sh;
			shellScript = "${shellScript.replace(/\n/g, '\\n').replace(/"/g, '\\"')}";
		};`;

    // 找到 Build Phases 區域的結束位置
    const buildPhasesEndMarker = '/* End PBXShellScriptBuildPhase section */';
    const buildPhasesEndIndex = projectContent.indexOf(buildPhasesEndMarker);

    if (buildPhasesEndIndex === -1) {
        console.error('❌ 無法找到 Build Phases 區域');
        process.exit(1);
    }

    // 在 Build Phases 結束前插入新 Phase
    projectContent = projectContent.slice(0, buildPhasesEndIndex) + 
                     newPhase + '\n\t\t' + 
                     projectContent.slice(buildPhasesEndIndex);

    // 找到 Target 的 buildPhases 列表
    const targetBuildPhasesRegex = /(13B07F861A680F5B00A75B9A \/\* storyappv2 \*\/ = \{[^}]*buildPhases = \([\s\S]*?)(00DD1BFF1BD5951E006B06BC \/\* Bundle React Native code and images \*\/,)/;
    const match = projectContent.match(targetBuildPhasesRegex);

    if (!match) {
        console.error('❌ 無法找到 Target buildPhases 列表');
        process.exit(1);
    }

    // 在 "Bundle React Native code and images" 之後添加新 Phase
    const newBuildPhaseEntry = `\n\t\t\t\t${phaseUUID} /* ${phaseName} */,`;
    projectContent = projectContent.replace(
        /(00DD1BFF1BD5951E006B06BC \/\* Bundle React Native code and images \*\/,)/,
        `$1${newBuildPhaseEntry}`
    );

    // 備份原文件
    const backupFile = PROJECT_FILE + '.backup.' + Date.now();
    fs.copyFileSync(PROJECT_FILE, backupFile);
    console.log(`📦 已備份原文件到: ${backupFile}`);

    // 寫入修改後的文件
    fs.writeFileSync(PROJECT_FILE, projectContent, 'utf8');

    console.log('✅ 成功添加 Hermes dSYM Build Phase!');
    console.log('\n📋 下一步:');
    console.log('   1. 在 Xcode 中打開項目確認新添加的 Build Phase');
    console.log('   2. 執行 Product → Archive');
    console.log('   3. 上傳到 App Store Connect');
    console.log('\n⚠️  如果 Xcode 顯示項目文件有問題，可以從備份恢復');
}

addHermesDSYMPhase();

