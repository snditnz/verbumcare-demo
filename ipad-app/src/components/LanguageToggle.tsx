import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useSettingsStore } from '@stores/settingsStore';
import { Language } from '@models';
import { UI_COLORS } from '@constants/config';

export const LanguageToggle: React.FC = () => {
  const { currentLanguage, setLanguage } = useSettingsStore();

  // Cycle through languages: ja -> en -> zh-TW -> ja
  const getNextLanguage = (current: Language): Language => {
    switch (current) {
      case 'ja': return 'en';
      case 'en': return 'zh-TW';
      case 'zh-TW': return 'ja';
      default: return 'ja';
    }
  };

  const getLanguageDisplay = (lang: Language): string => {
    switch (lang) {
      case 'ja': return '日本語';
      case 'en': return 'EN';
      case 'zh-TW': return '中文';
      default: return 'EN';
    }
  };

  const handleToggle = () => {
    const nextLanguage = getNextLanguage(currentLanguage);
    setLanguage(nextLanguage);
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handleToggle}
      accessibilityLabel={`Current language: ${getLanguageDisplay(currentLanguage)}. Tap to change language.`}
    >
      <Text style={styles.text}>
        {getLanguageDisplay(currentLanguage)}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    backgroundColor: UI_COLORS.background,
    minWidth: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    color: UI_COLORS.primary,
  },
});
