#!/usr/bin/env node

/**
 * 自動添加 Hermes dSYM Build Phase 到 Xcode 項目
 * 這個腳本會在 project.pbxproj 中添加一個新的 Run Script Phase
 * 用於在構建時複製 hermes.framework 的 dSYM 文件
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROJECT_FILE = path.join(__dirname, '../ios/xStory.xcodeproj/project.pbxproj');

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
    if (projectContent.includes('Generate Hermes dSYM') ||
        projectContent.includes('Copy Hermes dSYM') ||
        (projectContent.includes('hermes.framework.dSYM') &&
        projectContent.includes('DWARF_DSYM_FOLDER_PATH'))) {
        console.log('✅ 已存在 Hermes dSYM Build Phase，無需重複添加');
        return;
    }

    // 生成 UUID
    const phaseUUID = generateUUID();
    const phaseName = 'Generate Hermes dSYM';

    // Prebuilt Hermes xcframework 通常不含獨立 dSYM；對已嵌入的 binary 執行 dsymutil
    const shellScript = `# Prebuilt Hermes often ships without a separate dSYM; generate from the embedded binary.
HERMES_BIN="\${TARGET_BUILD_DIR}/\${FRAMEWORKS_FOLDER_PATH}/hermes.framework/hermes"
if [ ! -f "$HERMES_BIN" ]; then
  echo "warning: Hermes binary not found at $HERMES_BIN (skipping dSYM)"
  exit 0
fi
OUT_DSYM="\${DWARF_DSYM_FOLDER_PATH}/hermes.framework.dSYM"
rm -rf "$OUT_DSYM"
dsymutil "$HERMES_BIN" -o "$OUT_DSYM"
`;

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
    const targetBuildPhasesRegex = /(13B07F861A680F5B00A75B9A \/\* xStory \*\/ = \{[^}]*buildPhases = \([\s\S]*?)(493DE618FDD0A49D57A7E2AC \/\* \[CP\] Embed Pods Frameworks \*\/,)/;
    const match = projectContent.match(targetBuildPhasesRegex);

    if (!match) {
        console.error('❌ 無法找到 Target buildPhases 列表（預期在 [CP] Embed Pods Frameworks 之後插入）');
        process.exit(1);
    }

    const newBuildPhaseEntry = `\n\t\t\t\t${phaseUUID} /* ${phaseName} */,`;
    projectContent = projectContent.replace(
        /(493DE618FDD0A49D57A7E2AC \/\* \[CP\] Embed Pods Frameworks \*\/,)/,
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

