import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useVoiceReviewStore } from '@stores/voiceReviewStore';
import { useAssessmentStore } from '@stores/assessmentStore';
import { VoiceReviewItem, ExtractedData, DataCategory } from '@services/voiceReviewService';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '@constants/theme';
import { translations, t as translate } from '@constants/translations';
import { ExtractedDataEditor } from '@components';
import { LoadingSpinner } from '@components/ui/LoadingSpinner';
import { TranscriptSkeleton, ExtractedDataSkeleton } from '@components/ui/SkeletonLoader';
import { FadeIn, SlideIn, ProgressiveReveal } from '@components/ui/AnimatedTransitions';
import { ErrorMessage } from '@components/ui/ErrorBoundary';
import { HelpButton, ConfidenceTooltip } from '@components/ui/UserGuidance';
import { getUserFriendlyError, getHelpMessage } from '@utils/errorMessages';
import { 
  getVoiceReviewAccessibility, 
  getVoiceReviewHints, 
  getAccessibilityState,
  getConfidenceAccessibilityDescription 
} from '@utils/accessibility';

/**
 * VoiceReviewScreen
 * 
 * Main review interface for voice recordings.
 * Features:
 * - Editable transcript with re-analyze button
 * - Extracted data displayed in categorized sections
 * - Confidence indicators for each field
 * - Confirm & Save and Discard buttons
 * - Loading and error states
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8
 */

export default function VoiceReviewScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { reviewId } = route.params as { reviewId: string };
  
  const { language } = useAssessmentStore();
  const {
    reviewQueue,
    currentReview,
    isLoading,
    error,
    setCurrentReview,
    reanalyzeTranscript,
    confirmReview,
    discardReview,
    clearError,
  } = useVoiceReviewStore();

  const [editedTranscript, setEditedTranscript] = useState('');
  const [transcriptModified, setTranscriptModified] = useState(false);
  const [editedData, setEditedData] = useState<ExtractedData | null>(null);
  const [showConfidenceHelp, setShowConfidenceHelp] = useState(false);
  const [showTranscriptHelp, setShowTranscriptHelp] = useState(false);

  const t = (key: string) => translate(key, language);
  const a11yLabels = getVoiceReviewAccessibility(language);
  const a11yHints = getVoiceReviewHints(language);

  // Load review item on mount
  useEffect(() => {
    setCurrentReview(reviewId);
  }, [reviewId]);

  // Initialize edited transcript and data when review loads
  useEffect(() => {
    if (currentReview) {
      setEditedTranscript(currentReview.transcript);
      setEditedData(currentReview.extractedData);
      setTranscriptModified(false);
    }
  }, [currentReview]);

  // Handle transcript change
  const handleTranscriptChange = (text: string) => {
    setEditedTranscript(text);
    setTranscriptModified(text !== currentReview?.transcript);
  };

  // Handle re-analyze
  const handleReanalyze = async () => {
    if (!currentReview || !transcriptModified) return;

    try {
      await reanalyzeTranscript(reviewId, editedTranscript);
      setTranscriptModified(false);
      Alert.alert(t('common.success'), t('voiceReview.reanalyzeSuccess'));
    } catch (error: any) {
      const friendlyError = getUserFriendlyError('CATEGORIZATION_FAILED', language);
      Alert.alert(friendlyError.title, friendlyError.message);
    }
  };

  // Handle data field edit
  const handleDataEdit = (categoryIndex: number, field: string, value: any) => {
    if (!editedData) return;

    const newData = { ...editedData };
    newData.categories[categoryIndex].data[field] = value;
    setEditedData(newData);
  };

  // Handle confirm
  const handleConfirm = () => {
    Alert.alert(
      t('voiceReview.confirmTitle'),
      t('voiceReview.confirmMessage'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('voiceReview.confirmSave'),
          onPress: async () => {
            try {
              if (!editedData) return;
              await confirmReview(reviewId, editedData);
              Alert.alert(
                t('common.success'),
                t('voiceReview.confirmSuccess'),
                [
                  {
                    text: t('common.ok'),
                    onPress: () => navigation.goBack(),
                  },
                ]
              );
            } catch (error: any) {
              Alert.alert(t('common.error'), error.message || t('voiceReview.confirmFailed'));
            }
          },
        },
      ]
    );
  };

  // Handle discard
  const handleDiscard = () => {
    Alert.alert(
      t('voiceReview.discardTitle'),
      t('voiceReview.discardMessage'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('common.discard'),
          style: 'destructive',
          onPress: async () => {
            try {
              await discardReview(reviewId);
              Alert.alert(
                t('common.success'),
                t('voiceReview.discardSuccess'),
                [
                  {
                    text: t('common.ok'),
                    onPress: () => navigation.goBack(),
                  },
                ]
              );
            } catch (error: any) {
              Alert.alert(t('common.error'), error.message || t('voiceReview.discardFailed'));
            }
          },
        },
      ]
    );
  };

  // Render loading state
  if (isLoading && !currentReview) {
    return (
      <View style={styles.container}>
        <LoadingSpinner
          size="large"
          message={t('voiceReview.loadingReview')}
          overlay={false}
          style={styles.loadingContainer}
        />
      </View>
    );
  }

  // Render error state
  if (!currentReview) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>{t('voiceReview.notFound')}</Text>
          <Text style={styles.errorMessage}>{t('voiceReview.notFoundMessage')}</Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.errorButtonText}>{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={a11yLabels.backButton}
          accessibilityHint={a11yHints.backButton}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t('voiceReview.reviewTitle')}</Text>
          <Text style={styles.headerSubtitle}>
            {currentReview.contextPatientName || t('voiceReview.globalRecording')}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[
              styles.confidenceBadge,
              currentReview.confidence > 0.8 ? styles.confidenceHigh :
              currentReview.confidence > 0.6 ? styles.confidenceMedium :
              styles.confidenceLow
            ]}
            onPress={() => setShowConfidenceHelp(true)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={a11yLabels.confidenceBadge}
            accessibilityHint={a11yHints.confidenceBadge}
            accessibilityValue={{
              text: getConfidenceAccessibilityDescription(currentReview.confidence, language)
            }}
          >
            <Text style={styles.confidenceBadgeText}>
              {Math.round(currentReview.confidence * 100)}%
            </Text>
          </TouchableOpacity>
          <View
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={a11yLabels.helpButton}
            accessibilityHint={a11yHints.helpButton}
          >
            <HelpButton
              onPress={() => setShowTranscriptHelp(true)}
              style={{ marginLeft: SPACING.sm }}
            />
          </View>
        </View>
      </View>

      {/* Error banner */}
      {error && (
        <ErrorMessage
          message={error}
          type="error"
          onDismiss={clearError}
          actionText="Retry"
          onAction={() => {
            clearError();
            // Retry the last failed operation
            if (currentReview) {
              setCurrentReview(reviewId);
            }
          }}
        />
      )}

      {/* Confidence Help Tooltip */}
      {currentReview && (
        <ConfidenceTooltip
          confidence={currentReview.confidence}
          visible={showConfidenceHelp}
          onClose={() => setShowConfidenceHelp(false)}
        />
      )}

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Transcript Section */}
        <SlideIn direction="up" delay={100}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('voiceReview.transcript')}</Text>
              {transcriptModified && (
                <FadeIn>
                  <TouchableOpacity
                    style={styles.reanalyzeButton}
                    onPress={handleReanalyze}
                    disabled={isLoading}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={a11yLabels.reanalyzeButton}
                    accessibilityHint={a11yHints.reanalyzeButton}
                    accessibilityState={getAccessibilityState({ disabled: isLoading, loading: isLoading })}
                  >
                    {isLoading ? (
                      <ActivityIndicator 
                        size="small" 
                        color={COLORS.white}
                        accessible={true}
                        accessibilityLabel={a11yLabels.loadingSpinner}
                      />
                    ) : (
                      <Text style={styles.reanalyzeButtonText}>{t('voiceReview.reanalyze')}</Text>
                    )}
                  </TouchableOpacity>
                </FadeIn>
              )}
            </View>
            
            <ProgressiveReveal
              isReady={!!currentReview?.transcript}
              placeholder={<TranscriptSkeleton />}
            >
              <TextInput
                style={styles.transcriptInput}
                value={editedTranscript}
                onChangeText={handleTranscriptChange}
                multiline
                placeholder={t('voiceReview.transcriptPlaceholder')}
                placeholderTextColor={COLORS.text.disabled}
                editable={!isLoading}
                accessible={true}
                accessibilityRole="text"
                accessibilityLabel={a11yLabels.transcriptEditor}
                accessibilityHint={a11yHints.transcriptEditor}
                accessibilityState={getAccessibilityState({ disabled: isLoading })}
              />
            </ProgressiveReveal>
            
            <Text style={styles.transcriptHint}>
              {t('voiceReview.transcriptHint')}
            </Text>
          </View>
        </SlideIn>

        {/* Extracted Data Section */}
        <SlideIn direction="up" delay={200}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('voiceReview.extractedData')}</Text>
            
            <ProgressiveReveal
              isReady={!!editedData}
              placeholder={<ExtractedDataSkeleton />}
            >
              {editedData ? (
                <ExtractedDataEditor
                  extractedData={editedData}
                  language={language}
                  disabled={isLoading}
                  onDataChange={handleDataEdit}
                />
              ) : (
                <View style={styles.noDataContainer}>
                  <Text style={styles.noDataText}>{t('voiceReview.noExtractedData')}</Text>
                </View>
              )}
            </ProgressiveReveal>
          </View>
        </SlideIn>

        {/* Metadata Section */}
        <SlideIn direction="up" delay={300}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('voiceReview.metadata')}</Text>
            <View style={styles.metadataGrid}>
              <FadeIn delay={350}>
                <View style={styles.metadataItem}>
                  <Text style={styles.metadataLabel}>{t('voiceReview.recordedAt')}</Text>
                  <Text style={styles.metadataValue}>
                    {new Date(currentReview.recordedAt).toLocaleString(
                      language === 'ja' ? 'ja-JP' : language === 'zh-TW' ? 'zh-TW' : 'en-US'
                    )}
                  </Text>
                </View>
              </FadeIn>
              <FadeIn delay={400}>
                <View style={styles.metadataItem}>
                  <Text style={styles.metadataLabel}>{t('voiceReview.duration')}</Text>
                  <Text style={styles.metadataValue}>
                    {Math.floor(currentReview.duration / 60)}:{(currentReview.duration % 60).toString().padStart(2, '0')}
                  </Text>
                </View>
              </FadeIn>
              <FadeIn delay={450}>
                <View style={styles.metadataItem}>
                  <Text style={styles.metadataLabel}>{t('voiceReview.language')}</Text>
                  <Text style={styles.metadataValue}>
                    {currentReview.transcriptLanguage.toUpperCase()}
                  </Text>
                </View>
              </FadeIn>
              <FadeIn delay={500}>
                <View style={styles.metadataItem}>
                  <Text style={styles.metadataLabel}>{t('voiceReview.processingTime')}</Text>
                  <Text style={styles.metadataValue}>
                    {(currentReview.processingTime / 1000).toFixed(1)}s
                  </Text>
                </View>
              </FadeIn>
            </View>
          </View>
        </SlideIn>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.discardButton]}
          onPress={handleDiscard}
          disabled={isLoading}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={a11yLabels.discardButton}
          accessibilityHint={a11yHints.discardButton}
          accessibilityState={getAccessibilityState({ disabled: isLoading })}
        >
          <Text style={styles.discardButtonText}>{t('common.discard')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.confirmButton]}
          onPress={handleConfirm}
          disabled={isLoading}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={a11yLabels.confirmButton}
          accessibilityHint={a11yHints.confirmButton}
          accessibilityState={getAccessibilityState({ disabled: isLoading, loading: isLoading })}
        >
          {isLoading ? (
            <ActivityIndicator 
              size="small" 
              color={COLORS.white}
              accessible={true}
              accessibilityLabel={a11yLabels.loadingSpinner}
            />
          ) : (
            <Text style={styles.confirmButtonText}>{t('voiceReview.confirmSave')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: SPACING.lg,
  },
  errorTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  errorMessage: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  errorButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  errorButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: SPACING.sm,
  },
  backButtonText: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    color: COLORS.primary,
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: SPACING.md,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  headerSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  confidenceBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
  },
  confidenceHigh: {
    backgroundColor: COLORS.success + '20',
  },
  confidenceMedium: {
    backgroundColor: COLORS.warning + '20',
  },
  confidenceLow: {
    backgroundColor: COLORS.error + '20',
  },
  confidenceBadgeText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.error + '20',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.error + '40',
  },
  errorBannerText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.error,
  },
  errorDismiss: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: COLORS.error,
    paddingLeft: SPACING.md,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: SPACING.lg,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
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
  },
  reanalyzeButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  transcriptInput: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    minHeight: 150,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  transcriptHint: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginTop: SPACING.sm,
    fontStyle: 'italic',
  },
  noDataContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  noDataText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
  },
  metadataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  metadataItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  metadataLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
  },
  metadataValue: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  actions: {
    flexDirection: 'row',
    padding: SPACING.lg,
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionButton: {
    flex: 1,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: SPACING.touchTarget.comfortable,
  },
  discardButton: {
    backgroundColor: COLORS.background,
    borderWidth: 2,
    borderColor: COLORS.error,
  },
  discardButtonText: {
    color: COLORS.error,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  confirmButton: {
    backgroundColor: COLORS.primary,
  },
  confirmButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
});
