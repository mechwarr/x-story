import React, { useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';


import colors from '../../config/colors';
import { toColor, toFontWeight } from '../../config/normalizeStyle';
import ChatImageArea from './ChatImageArea';
import ChatSoundArea from './ChatSoundArea';

import ChatTextArea from './ChatTextArea';
import ChatVideoArea from './ChatVideoArea';
import PersonalPhoto from './PersonalPhoto';

function Chat({
  textContentColor,
  textContentWeight,
  textContentSize,
  textContentBaseColor,
  textMsg,
  soundMsg,
  imgMsg,
  videoMsg,
  role,
  roleName,
  roleList,
  roleConf,
  roleFoolproofConf,
  onPressOption,
}) {
  const roleData = useMemo(() => {
    return roleList?.find((e) => e?.role_name?.trim() === roleName?.trim());
  }, [role, roleList]);

  // 對話框底色（去空白）；空值時退回 StyleSheet 預設底，故 fallback 傳 ''。
  const baseColor = toColor(textContentBaseColor, '');
  const mainRoleColor = toColor(roleConf?.main_Role_Name_Color, '');
  const supportingColor =
    toColor(
      roleData?.role_sex !== '女'
        ? roleConf?.boy_Supporting_Color
        : roleConf?.girl_Supporting_Color,
      ''
    ) || undefined;

  return (
    <Pressable onPress={() => onPressOption(null)}>
      {role !== '主角' ? (
        <View style={[styles.chatLeft]}>
          <PersonalPhoto
            photo={roleData?.role_pic}
            name={roleData?.role_name}
            {...roleData}
            roleConf={roleConf}
            roleFoolproofConf={roleFoolproofConf}
            role={role}
          />
          {textMsg ? (
            <ChatTextArea
              textMsg={textMsg}
              backgroundColor={{
                backgroundColor: supportingColor,
              }}
              textStyle={{
                fontSize: textContentSize || 20,
                color: toColor(textContentColor),
                fontWeight: toFontWeight(textContentWeight),
              }}
            />
          ) : null}
          {soundMsg ? (
            <ChatSoundArea
              soundMsg={soundMsg}
              backgroundColor={
                baseColor
                  ? { backgroundColor: baseColor }
                  : styles.leftBackground
              }
            />
          ) : null}
          {imgMsg ? (
            <ChatImageArea
              imgMsg={imgMsg}
              backgroundColor={styles.imgBackground}
            />
          ) : null}
          {videoMsg ? <ChatVideoArea videoMsg={videoMsg} /> : null}
        </View>
      ) : (
        <View style={[styles.chatRight]}>
          {textMsg ? (
            <ChatTextArea
              textMsg={textMsg}
              backgroundColor={
                mainRoleColor
                  ? { backgroundColor: mainRoleColor }
                  : styles.rightBackground
              }
              textStyle={{
                fontSize: textContentSize || 20,
                color: toColor(textContentColor),
                fontWeight: toFontWeight(textContentWeight),
              }}
            />
          ) : null}
          {soundMsg ? (
            <View style={{ alignSelf: 'center', marginRight: 8 }}>
              <ChatSoundArea
                soundMsg={soundMsg}
                backgroundColor={
                  baseColor
                    ? { backgroundColor: baseColor }
                    : styles.rightBackground
                }
              />
            </View>
          ) : null}
          {imgMsg ? (
            <ChatImageArea
              imgMsg={imgMsg}
              backgroundColor={styles.imgBackground}
            // size={size}
            />
          ) : null}
          {videoMsg ? <ChatVideoArea videoMsg={videoMsg} /> : null}
          <PersonalPhoto
            photo={roleData?.role_pic}
            name={roleData?.role_name}
            {...roleData}
            roleConf={roleConf}
            roleFoolproofConf={roleFoolproofConf}
            role={role}
          />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chatLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start', // 頭像欄貼齊頂端，避免被旁邊圖片/內容撐高（與 chatRight 一致）
    paddingVertical: 5,
  },
  chatRight: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    paddingVertical: 5,
  },
  leftBackground: {
    backgroundColor: colors.leftChatBackground,
  },
  rightBackground: {
    backgroundColor: colors.rightChatBackground,
  },
  imgBackground: {
    backgroundColor: colors.imgChatBackground,
  },
});

export default React.memo(Chat);
