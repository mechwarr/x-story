import AsyncStorage from '@react-native-async-storage/async-storage';

// storeKey: continueStory or finishStory

const storeStory = async (story, storeKey) => {
  try {
    const value = await AsyncStorage.getItem(storeKey);

    // 第一次開啟app的時候會得到空值
    if (!value || value === null) {
      console.log('空值');
      // 如果是空值就存一個array進去
      await AsyncStorage.setItem(storeKey, JSON.stringify([story]));
    } else {
      // 找到故事名稱一樣的index
      let _value = JSON.parse(value);
      const idx = _value?.findIndex((v) => v.storyId === story.storyId);
      // 如果沒找到就是還沒有存這個故事，所以要push
      idx === -1 ? _value.push(story) : (_value[idx] = story);

      // console.log(_value);
      // console.log(_value.length);
      await AsyncStorage.setItem(storeKey, JSON.stringify(_value));
    }
  } catch (error) {
    console.log(error);
  }
};

const getStorys = async (storeKey) => {
  try {
    const value = await AsyncStorage.getItem(storeKey);
    // console.log("@@@@@@@", JSON.parse(value));
    return value !== null ? JSON.parse(value) : null;
  } catch (error) {
    console.log(error);
  }
};

const deleteStory = async (story, storeKey) => {
  try {
    const value = await AsyncStorage.getItem(storeKey);
    // 找到故事名稱一樣的index
    let _value = JSON.parse(value);
    let idx = _value?.findIndex((v) => v.storyId === story.storyId);

    // 故事結束，刪除此故事
    _value?.splice(idx, 1);

    await AsyncStorage.setItem(storeKey, JSON.stringify(_value));
  } catch (error) {
    console.log(error);
  }
};

const deleteAllStorage = async () => {
  AsyncStorage.clear();
};

// 本地購買書籍 ID 清單（API 失敗時仍可隱藏購買按鈕）
const LOCAL_PURCHASED_STORY_IDS_KEY = 'localPurchasedStoryIds';

const getLocalPurchasedStoryIds = async () => {
  try {
    const value = await AsyncStorage.getItem(LOCAL_PURCHASED_STORY_IDS_KEY);
    if (!value || value === null) return [];
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.log(error);
    return [];
  }
};

const addLocalPurchasedStoryId = async (storyId) => {
  try {
    const ids = await getLocalPurchasedStoryIds();
    const id = Number(storyId);
    if (Number.isNaN(id) || ids.includes(id)) return;
    ids.push(id);
    await AsyncStorage.setItem(LOCAL_PURCHASED_STORY_IDS_KEY, JSON.stringify(ids));
  } catch (error) {
    console.log(error);
  }
};

export default {
  storeStory,
  getStorys,
  deleteStory,
  deleteAllStorage,
  getLocalPurchasedStoryIds,
  addLocalPurchasedStoryId,
};
