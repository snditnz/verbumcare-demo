import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useAssessmentStore } from '@stores/assessmentStore';
import { Language } from '@models';
import { UI_COLORS } from '@constants/config';

export const LanguageToggle: React.FC = () => {
  const { language, setLanguage } = useAssessmentStore();

  const handleToggle = () => {
    setLanguage(language === 'ja' ? 'en' : 'ja');
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.button,
          language === 'ja' && styles.buttonActive,
        ]}
        onPress={() => setLanguage('ja')}
        accessibilityLabel="Switch to Japanese"
      >
        <Text style={[styles.text, language === 'ja' && styles.textActive]}>
          日本語
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.button,
          language === 'en' && styles.buttonActive,
        ]}
        onPress={() => setLanguage('en')}
        accessibilityLabel="Switch to English"
      >
        <Text style={[styles.text, language === 'en' && styles.textActive]}>
          EN
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: UI_COLORS.border,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: UI_COLORS.background,
  },
  buttonActive: {
    backgroundColor: UI_COLORS.primary,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    color: UI_COLORS.textSecondary,
  },
  textActive: {
    color: '#FFFFFF',
  },
});
