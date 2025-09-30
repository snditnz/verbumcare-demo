import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '../translations/en.json';
import ja from '../translations/ja.json';
import zhTW from '../translations/zh-TW.json';

const resources = {
  en: { translation: en },
  ja: { translation: ja },
  'zh-TW': { translation: zhTW },
};

const savedLanguage = localStorage.getItem('language') || 'en';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;