import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { VoiceReviewItem } from '@services/voiceReviewService';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '@constants/theme';
import { translations } from '@constants/translations';
import { Language } from '@models';
import { 
  getReviewItemAccessibilityDescription,
  getConfidenceAccessibilityDescription 
} from '@utils/accessibility';

/**
 * VoiceReviewCard Component
 * 
 * Displays individual review item in the queue.
 * Features:
 * - Recording metadata (timestamp, duration, patient name)
 * - Urgency indicator for items >24 hours old
 * - Confidence score badge
 * - Transcript preview
 * - Tap handler to open review screen
 * 
 * Requirements: 8.3, 8.6
 */

interface VoiceReviewCardProps {
  item: VoiceReviewItem;
  language: Language;
  onPress: (reviewId: string) => void;
}

export default function VoiceReviewCard({ item, language, onPress }: VoiceReviewCardProps) {
  const t = (key: string) => translations[language][key] || key;

  // Check if item is urgent (>24 hours old)
  const isUrgent = (): boolean => {
    if (!item.createdAt) return false;
    const hoursSinceCreation = (Date.now() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60);
    return hoursSinceCreation > 24;
  };

  const urgent = isUrgent();

  // Format date
  const formattedDate = item.createdAt ? new Date(item.createdAt).toLocaleString(
    language === 'ja' ? 'ja-JP' : language === 'zh-TW' ? 'zh-TW' : 'en-US',
    {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }
  ) : 'Unknown date';

  // Format duration - handle null/undefined values gracefully
  const safeDuration = item.duration || 0;
  const durationMinutes = Math.floor(safeDuration / 60);
  const durationSeconds = safeDuration % 60;
  const durationText = safeDuration > 0 
    ? `${durationMinutes}:${durationSeconds.toString().padStart(2, '0')}`
    : '--:--'; // Show placeholder for missing duration

  // Create accessibility description
  const accessibilityDescription = getReviewItemAccessibilityDescription(
    { ...item, isUrgent: urgent, timeAgo: formattedDate },
    language
  );

  return (
    <TouchableOpacity
      style={[styles.card, urgent && styles.cardUrgent]}
      onPress={() => onPress(item.reviewId)}
      activeOpacity={0.7}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel="Review item"
      accessibilityHint="Tap to open voice review"
      accessibilityValue={{ text: accessibilityDescription }}
    >
      {/* Urgent badge */}
      {urgent && (
        <View 
          style={styles.urgentBadge}
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel="Urgent item"
          accessibilityHint="This item requires immediate attention"
        >
          <Text style={styles.urgentBadgeText}>{t('voiceReview.urgent')}</Text>
        </View>
      )}

      {/* Header: Patient name and duration */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.patientName}>
            {item.contextPatientName || t('voiceReview.globalRecording')}
          </Text>
          <Text style={styles.date}>{formattedDate}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.duration}>{durationText}</Text>
          <Text style={styles.durationLabel}>{t('voiceReview.duration')}</Text>
        </View>
      </View>

      {/* Metadata: Confidence and categories */}
      <View style={styles.meta}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>{t('voiceReview.confidence')}</Text>
          <View 
            style={[
              styles.confidenceBadge,
              (item.confidence || 0) > 0.8 ? styles.confidenceHigh :
              (item.confidence || 0) > 0.6 ? styles.confidenceMedium :
              styles.confidenceLow
            ]}
            accessible={true}
            accessibilityRole="text"
            accessibilityLabel="Confidence indicator"
            accessibilityValue={{
              text: getConfidenceAccessibilityDescription(item.confidence || 0, language)
            }}
          >
            <Text style={styles.confidenceBadgeText}>
              {Math.round((item.confidence || 0) * 100)}%
            </Text>
          </View>
        </View>

        {item.extractedData?.categories && Array.isArray(item.extractedData.categories) && (
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>{t('voiceReview.categories')}</Text>
            <Text style={styles.metaValue}>
              {item.extractedData.categories.length}
            </Text>
          </View>
        )}
      </View>

      {/* Footer: Transcript preview */}
      <View style={styles.footer}>
        <Text style={styles.transcriptPreview} numberOfLines={2}>
          {item.transcript || 'No transcript available'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  cardUrgent: {
    borderWidth: 2,
    borderColor: COLORS.warning,
  },
  urgentBadge: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    backgroundColor: COLORS.warning,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  urgentBadgeText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  patientName: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  date: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  duration: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.primary,
  },
  durationLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
  },
  meta: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
    gap: SPACING.lg,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  metaLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  metaValue: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  confidenceBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
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
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    paddingTop: SPACING.md,
  },
  transcriptPreview: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    lineHeight: TYPOGRAPHY.lineHeight.normal * TYPOGRAPHY.fontSize.sm,
  },
});
