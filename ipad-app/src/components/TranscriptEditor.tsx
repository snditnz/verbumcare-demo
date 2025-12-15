import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '@constants/theme';
import { translations } from '@constants/translations';
import { Language } from '@models';

/**
 * TranscriptEditor Component
 * 
 * Editable multiline text input for voice transcripts.
 * Features:
 * - Editable multiline text input
 * - Character count display
 * - "Re-analyze" button (enabled after edit)
 * - Loading indicator during re-analysis
 * 
 * Requirements: 5.2, 5.3
 */

interface TranscriptEditorProps {
  transcript: string;
  language: Language;
  isLoading?: boolean;
  disabled?: boolean;
  onTranscriptChange: (text: string) => void;
  onReanalyze: () => void;
}

export default function TranscriptEditor({
  transcript,
  language,
  isLoading = false,
  disabled = false,
  onTranscriptChange,
  onReanalyze,
}: TranscriptEditorProps) {
  const [editedText, setEditedText] = useState(transcript);
  const [isModified, setIsModified] = useState(false);

  const t = (key: string) => translations[language][key] || key;

  // Update local state when transcript prop changes
  useEffect(() => {
    setEditedText(transcript);
    setIsModified(false);
  }, [transcript]);

  // Handle text change
  const handleTextChange = (text: string) => {
    setEditedText(text);
    setIsModified(text !== transcript);
    onTranscriptChange(text);
  };

  // Handle re-analyze button press
  const handleReanalyze = () => {
    if (isModified && !isLoading && !disabled) {
      onReanalyze();
    }
  };

  // Calculate character count
  const characterCount = editedText.length;

  return (
    <View style={styles.container}>
      {/* Header with title and re-analyze button */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('voiceReview.transcript')}</Text>
        {isModified && (
          <TouchableOpacity
            style={[
              styles.reanalyzeButton,
              (isLoading || disabled) && styles.reanalyzeButtonDisabled
            ]}
            onPress={handleReanalyze}
            disabled={isLoading || disabled}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.reanalyzeButtonText}>
                {t('voiceReview.reanalyze')}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Text input */}
      <TextInput
        style={[
          styles.textInput,
          isModified && styles.textInputModified,
          disabled && styles.textInputDisabled
        ]}
        value={editedText}
        onChangeText={handleTextChange}
        multiline
        placeholder={t('voiceReview.transcriptPlaceholder')}
        placeholderTextColor={COLORS.text.disabled}
        editable={!disabled && !isLoading}
        textAlignVertical="top"
      />

      {/* Footer with character count and hint */}
      <View style={styles.footer}>
        <Text style={styles.hint}>
          {isModified
            ? t('voiceReview.transcriptModifiedHint')
            : t('voiceReview.transcriptHint')}
        </Text>
        <Text style={styles.characterCount}>
          {characterCount.toLocaleString(
            language === 'ja' ? 'ja-JP' : language === 'zh-TW' ? 'zh-TW' : 'en-US'
          )}{' '}
          {t('voiceReview.characters')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  reanalyzeButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: SPACING.touchTarget.min,
  },
  reanalyzeButtonDisabled: {
    backgroundColor: COLORS.text.disabled,
    opacity: 0.6,
  },
  reanalyzeButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  textInput: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    minHeight: 150,
    maxHeight: 300,
    borderWidth: 1,
    borderColor: COLORS.border,
    lineHeight: TYPOGRAPHY.lineHeight.relaxed * TYPOGRAPHY.fontSize.base,
  },
  textInputModified: {
    borderColor: COLORS.primary,
    borderWidth: 2,
    backgroundColor: COLORS.primaryLight + '05',
  },
  textInputDisabled: {
    backgroundColor: COLORS.background,
    color: COLORS.text.disabled,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  hint: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    fontStyle: 'italic',
  },
  characterCount: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginLeft: SPACING.md,
  },
});
