import React from 'react';
import {
  View,
  StyleSheet,
  Image,
  Pressable,
} from 'react-native';
import { showAlert } from "../CustomAlert";
import apiclient  from '../../config/apiClient';

import AppText from '../AppText';
import { translate } from '../../i18n/i18n';
import { toAlertTextStyle } from '../../config/foolproofStyle';
import { toColor, toFontWeight } from '../../config/normalizeStyle';
const domain = apiclient.currentBaseUrl() + 'images/update/';

function PersonalPhoto(props) {
  const {
    photo,
    name,
    role_infor,
    role_foolproof_title,
    role_foolproof_content,
    roleConf,
    roleFoolproofConf,
    role,
  } = props;

  if (role !== '主角')
    return (
      <Pressable
        onPress={() => {
          // 故事角色-防呆視窗：標題/內文/按鈕字樣來自 setup-story-role-foolproof 參數表
          // （roleFoolproofConf，已於 StoryScreen 依語系挑列）。未設定的欄位自動略過、沿用預設。
          showAlert(
            role_foolproof_title?.trim(),
            role_infor,
            [
              {
                // 按鈕字詞來自角色表 role_foolproof_content（後台資料常帶尾端空白，需 trim）；
                // 後台缺值時才退回內建 OK
                text: role_foolproof_content?.trim() || translate('ok'),
                cancelable: true,
                textStyle: toAlertTextStyle(
                  roleFoolproofConf?.setup_story_role_foolproof_size,
                  roleFoolproofConf?.setup_story_role_foolproof_weight,
                  roleFoolproofConf?.setup_story_role_foolproof_color
                ),
              },
            ],
            undefined,
            {
              titleStyle: toAlertTextStyle(
                roleFoolproofConf?.setup_story_role_foolproof_name_size,
                roleFoolproofConf?.setup_story_role_foolproof_name_weight,
                roleFoolproofConf?.setup_story_role_foolproof_name_color
              ),
              messageStyle: toAlertTextStyle(
                roleFoolproofConf?.setup_story_role_foolproof_information_size,
                roleFoolproofConf?.setup_story_role_foolproof_information_weight,
                roleFoolproofConf?.setup_story_role_foolproof_information_color
              ),
            }
          );
          // : onPressOption && onPressOption(null);
        }}
      >
        <View style={styles.container}>
          <Image
            fadeDuration={0}
            style={styles.img}
            source={{ uri: domain + photo }}
          />
          <AppText
            style={[
              styles.nameText,
              {
                color: toColor(roleConf?.role_name_color, '') || undefined,
                fontSize: roleConf?.role_name_size || 20,
                fontWeight: toFontWeight(roleConf?.role_name_weight),
              },
            ]}
          >
            {name}
          </AppText>
        </View>
      </Pressable>
    );
  return (
    <View style={styles.container}>
      <Image
        fadeDuration={0}
        style={styles.img}
        source={{ uri: domain + photo }}
      />
      <AppText
        style={[
          styles.nameText,
          {
            color: toColor(roleConf?.role_name_color, '') || undefined,
            fontSize: roleConf?.role_name_size || 20,
            fontWeight: toFontWeight(roleConf?.role_name_weight),
          },
        ]}
      >
        {name}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 10,
    alignItems: 'center',
  },
  img: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  nameText: {
    fontSize: 15,
    color: '#000',
    fontWeight: '500',
  },
});

export default React.memo(PersonalPhoto);
