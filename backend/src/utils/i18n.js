import translations from '../config/translations.json' with { type: 'json' };

export function getTranslation(key, language = 'en') {
  const supportedLanguages = ['en', 'ja', 'zh-TW'];
  const lang = supportedLanguages.includes(language) ? language : 'en';

  return translations[lang][key] || translations['en'][key] || key;
}

export function detectLanguage(req) {
  const acceptLanguage = req.headers['accept-language'];
  if (!acceptLanguage) return 'en';

  if (acceptLanguage.includes('ja')) return 'ja';
  if (acceptLanguage.includes('zh-TW') || acceptLanguage.includes('zh-Hant')) return 'zh-TW';
  if (acceptLanguage.includes('zh')) return 'zh-TW';
  return 'en';
}

export function translateResponse(data, language = 'en') {
  if (!data || typeof data !== 'object') return data;

  const translated = {};
  for (const [key, value] of Object.entries(data)) {
    if (translations[language] && translations[language][key]) {
      translated[key] = translations[language][key];
    } else {
      translated[key] = value;
    }
  }

  return { ...data, translations: translated, language };
}