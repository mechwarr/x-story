import React from 'react';
import {
  View,
  StyleSheet,
  Image,
  Pressable,
  Alert,
  Platform,
} from 'react-native';
import apiclient  from '../../config/apiClient';

import AppText from '../AppText';
import { translate } from '../../i18n/i18n';
const domain = apiclient.currentBaseUrl() + 'images/update/';

function PersonalPhoto(props) {
  const {
    photo,
    name,
    role_infor,
    role_foolproof_title,
    role_foolproof_content,
    roleConf,
    role,
  } = props;

  if (role !== '主角')
    return (
      <Pressable
        onPress={() => {
          Alert.alert(role_foolproof_title, role_infor, [
            {
              text: translate('ok'),
              cancelable: true,
            },
          ]);
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
                color: roleConf?.role_name_color,
                fontSize: roleConf?.role_name_size || 20,
                ...(roleConf?.role_name_weight === '粗' && {
                  fontWeight: Platform.OS === 'ios' ? 600 : 'bold',
                }),
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
            color: roleConf?.role_name_color,
            fontSize: roleConf?.role_name_size || 20,
            ...(roleConf?.role_name_weight === '粗' && {
              fontWeight: Platform.OS === 'ios' ? 600 : 'bold',
            }),
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
