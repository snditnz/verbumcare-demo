import React, { useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
} from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '@constants/theme';
import { translations } from '@constants/translations';
import { Language } from '@models';

/**
 * ProgressiveTranscript Component
 * 
 * Displays real-time transcription with confidence indicators.
 * Features:
 * - Real-time text display with auto-scroll
 * - Confidence-based styling (uncertain segments in italic/lighter)
 * - Smooth segment updates without flickering
 * - Visual indicator for streaming status
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */

export interface TranscriptSegment {
  id: string;
  text: string;
  confidence: number;
  timestamp?: number;
  isFinal: boolean;
  isUncertain?: boolean;
}

interface ProgressiveTranscriptProps {
  /** Array of transcription segments */
  segments: TranscriptSegment[];
  /** Whether streaming is currently active */
  isStreaming: boolean;
  /** Whether to show confidence indicators */
  showConfidence?: boolean;
  /** Whether to auto-scroll to bottom */
  autoScroll?: boolean;
  /** Current language for translations */
  language: Language;
  /** Callback when user edits a segment (optional) */
  onSegmentEdit?: (segmentId: string, newText: string) => void;
}

export default function ProgressiveTranscript({
  segments,
  isStreaming,
  showConfidence = true,
  autoScroll = true,
  language,
  onSegmentEdit,
}: ProgressiveTranscriptProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(0)).current;

  const t = useCallback((key: string) => translations[language][key] || key, [language]);

  // Pulse animation for streaming indicator
  useEffect(() => {
    if (isStreaming) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      pulseAnim.setValue(0);
    }
  }, [isStreaming, pulseAnim]);

  // Auto-scroll to bottom when new segments arrive
  useEffect(() => {
    if (autoScroll && scrollViewRef.current && segments.length > 0) {
      // Small delay to ensure content is rendered
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [segments, autoScroll]);

  // Determine if a segment should be styled as uncertain
  const isSegmentUncertain = (segment: TranscriptSegment): boolean => {
    // Requirement 2.3: Mark segments with confidence < 0.7 as uncertain
    if (segment.isUncertain !== undefined) {
      return segment.isUncertain;
    }
    return segment.confidence < 0.7;
  };

  // Get confidence color based on score
  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.9) return COLORS.success;
    if (confidence >= 0.7) return COLORS.primary;
    if (confidence >= 0.5) return COLORS.warning;
    return COLORS.error;
  };

  // Render a single segment
  const renderSegment = (segment: TranscriptSegment, index: number) => {
    const isUncertain = isSegmentUncertain(segment);
    const isLast = index === segments.length - 1;

    return (
      <View key={segment.id} style={styles.segmentContainer}>
        <Text
          style={[
            styles.segmentText,
            isUncertain && styles.uncertainText,
            !segment.isFinal && styles.pendingText,
          ]}
        >
          {segment.text}
          {!segment.isFinal && isLast && (
            <Text style={styles.cursor}>|</Text>
          )}
        </Text>
        
        {showConfidence && (
          <View style={styles.confidenceContainer}>
            <View
              style={[
                styles.confidenceDot,
                { backgroundColor: getConfidenceColor(segment.confidence) },
              ]}
            />
            <Text style={styles.confidenceText}>
              {Math.round(segment.confidence * 100)}%
            </Text>
          </View>
        )}
      </View>
    );
  };

  // Calculate overall confidence
  const overallConfidence = segments.length > 0
    ? segments.reduce((sum, s) => sum + s.confidence, 0) / segments.length
    : 0;

  return (
    <View style={styles.container}>
      {/* Header with streaming indicator */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{t('voiceReview.transcript')}</Text>
          {isStreaming && (
            <Animated.View
              style={[
                styles.streamingIndicator,
                {
                  opacity: pulseAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.4, 1],
                  }),
                },
              ]}
            >
              <View style={styles.streamingDot} />
              <Text style={styles.streamingText}>
                {t('streaming.recording') || 'Recording...'}
              </Text>
            </Animated.View>
          )}
        </View>
        
        {segments.length > 0 && showConfidence && (
          <View style={styles.overallConfidence}>
            <Text style={styles.confidenceLabel}>
              {t('voiceReview.confidence') || 'Confidence'}:
            </Text>
            <Text
              style={[
                styles.confidenceValue,
                { color: getConfidenceColor(overallConfidence) },
              ]}
            >
              {Math.round(overallConfidence * 100)}%
            </Text>
          </View>
        )}
      </View>

      {/* Transcript content */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        {segments.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {isStreaming
                ? (t('streaming.waitingForSpeech') || 'Listening...')
                : (t('streaming.noTranscript') || 'No transcript yet')}
            </Text>
          </View>
        ) : (
          <View style={styles.segmentsContainer}>
            {segments.map((segment, index) => renderSegment(segment, index))}
          </View>
        )}
      </ScrollView>

      {/* Footer with legend */}
      {showConfidence && segments.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.success }]} />
              <Text style={styles.legendText}>
                {t('streaming.highConfidence') || 'High (≥90%)'}
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.primary }]} />
              <Text style={styles.legendText}>
                {t('streaming.mediumConfidence') || 'Medium (70-89%)'}
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.warning }]} />
              <Text style={styles.legendText}>
                {t('streaming.lowConfidence') || 'Low (<70%)'}
              </Text>
            </View>
          </View>
          <Text style={styles.uncertainHint}>
            {t('streaming.uncertainHint') || 'Italic text indicates uncertain transcription'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    backgroundColor: COLORS.surfaceNavy,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  streamingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.error + '15',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  streamingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.error,
  },
  streamingText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.error,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  overallConfidence: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  confidenceLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  confidenceValue: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  scrollView: {
    flex: 1,
    minHeight: 150,
    maxHeight: 300,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING['2xl'],
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    fontStyle: 'italic',
  },
  segmentsContainer: {
    gap: SPACING.sm,
  },
  segmentContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  segmentText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    lineHeight: TYPOGRAPHY.lineHeight.relaxed * TYPOGRAPHY.fontSize.base,
  },
  uncertainText: {
    fontStyle: 'italic',
    color: COLORS.text.secondary,
  },
  pendingText: {
    color: COLORS.primary,
  },
  cursor: {
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    minWidth: 50,
  },
  confidenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
  },
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    backgroundColor: COLORS.surfaceNavy,
  },
  legend: {
    flexDirection: 'row',
    gap: SPACING.lg,
    marginBottom: SPACING.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
  },
  uncertainHint: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
    fontStyle: 'italic',
  },
});
