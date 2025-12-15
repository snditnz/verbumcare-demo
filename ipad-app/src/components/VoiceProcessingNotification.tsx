import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS, ANIMATION } from '@constants/theme';
import { translations } from '@constants/translations';
import { Language } from '@models';

const SCREEN_WIDTH = Dimensions.get('window').width;
const NOTIFICATION_HEIGHT = 100;

/**
 * VoiceProcessingNotification Component
 * 
 * Toast/banner notification for voice processing status.
 * Features:
 * - Progress indicator for long operations (>30 seconds)
 * - Queue position display when multiple recordings are processing
 * - Tap to open review screen
 * - Auto-dismiss on completion
 * - Error state with retry option
 * 
 * Requirements: 9.1, 9.2, 9.4, 9.5
 */

export interface ProcessingStatus {
  recordingId: string;
  status: 'processing' | 'completed' | 'failed';
  phase: 'transcription' | 'extraction' | 'translation' | 'saving' | 'done';
  message: string;
  progress?: number; // 0-100
  queuePosition?: number; // Position in queue (1-based)
  queueTotal?: number; // Total items in queue
  estimatedTimeRemaining?: number; // Seconds
  error?: string;
  reviewId?: string; // Available when completed
}

interface VoiceProcessingNotificationProps {
  status: ProcessingStatus | null;
  language: Language;
  onTap?: (reviewId?: string) => void;
  onDismiss?: () => void;
  onRetry?: (recordingId: string) => void;
}

export default function VoiceProcessingNotification({
  status,
  language,
  onTap,
  onDismiss,
  onRetry,
}: VoiceProcessingNotificationProps) {
  const [slideAnim] = useState(new Animated.Value(-NOTIFICATION_HEIGHT));
  const [visible, setVisible] = useState(false);
  const [autoDismissTimer, setAutoDismissTimer] = useState<NodeJS.Timeout | null>(null);

  const t = (key: string) => translations[language][key] || key;

  // Show/hide animation
  useEffect(() => {
    if (status) {
      setVisible(true);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 60,
        friction: 10,
        velocity: 0.5,
      }).start();

      // Auto-dismiss on completion after 4 seconds (longer for better UX)
      if (status.status === 'completed') {
        const timer = setTimeout(() => {
          handleDismiss();
        }, 4000);
        setAutoDismissTimer(timer);
      }
    } else {
      Animated.timing(slideAnim, {
        toValue: -NOTIFICATION_HEIGHT,
        duration: ANIMATION.slow,
        useNativeDriver: true,
      }).start(() => {
        setVisible(false);
      });
    }

    return () => {
      if (autoDismissTimer) {
        clearTimeout(autoDismissTimer);
      }
    };
  }, [status]);

  const handleDismiss = () => {
    if (autoDismissTimer) {
      clearTimeout(autoDismissTimer);
      setAutoDismissTimer(null);
    }

    Animated.timing(slideAnim, {
      toValue: -NOTIFICATION_HEIGHT,
      duration: ANIMATION.slow,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      onDismiss?.();
    });
  };

  const handleTap = () => {
    if (status?.status === 'completed' && status.reviewId) {
      onTap?.(status.reviewId);
      handleDismiss();
    } else if (status?.status === 'processing') {
      // Allow tapping during processing to see details
      onTap?.();
    }
  };

  const handleRetry = () => {
    if (status?.recordingId) {
      onRetry?.(status.recordingId);
      handleDismiss();
    }
  };

  if (!visible || !status) {
    return null;
  }

  // Determine background color based on status
  const getBackgroundColor = (): string => {
    switch (status.status) {
      case 'completed':
        return COLORS.success;
      case 'failed':
        return COLORS.error;
      case 'processing':
      default:
        return COLORS.primary;
    }
  };

  // Get status icon/indicator
  const renderStatusIndicator = () => {
    if (status.status === 'processing') {
      return <ActivityIndicator size="small" color={COLORS.white} />;
    } else if (status.status === 'completed') {
      return (
        <View style={styles.checkmark}>
          <Text style={styles.checkmarkText}>✓</Text>
        </View>
      );
    } else if (status.status === 'failed') {
      return (
        <View style={styles.errorIcon}>
          <Text style={styles.errorIconText}>✕</Text>
        </View>
      );
    }
    return null;
  };

  // Format estimated time remaining
  const formatTimeRemaining = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.round(seconds)}${t('voiceProcessing.seconds')}`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}${t('voiceProcessing.minutes')} ${remainingSeconds}${t('voiceProcessing.seconds')}`;
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: getBackgroundColor(),
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.content}
        onPress={handleTap}
        activeOpacity={0.9}
        disabled={status.status === 'failed'}
      >
        {/* Status indicator */}
        <View style={styles.indicatorContainer}>
          {renderStatusIndicator()}
        </View>

        {/* Content */}
        <View style={styles.textContainer}>
          {/* Main message */}
          <Text style={styles.message} numberOfLines={2}>
            {status.message}
          </Text>

          {/* Queue position (if multiple items) */}
          {status.status === 'processing' && status.queuePosition && status.queueTotal && status.queueTotal > 1 && (
            <Text style={styles.queueInfo}>
              {t('voiceProcessing.queuePosition')
                .replace('{position}', status.queuePosition.toString())
                .replace('{total}', status.queueTotal.toString())}
            </Text>
          )}

          {/* Progress bar for long operations */}
          {status.status === 'processing' && status.progress !== undefined && (
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBarBackground}>
                <Animated.View
                  style={[
                    styles.progressBarFill,
                    { width: `${status.progress}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>{Math.round(status.progress)}%</Text>
            </View>
          )}

          {/* Estimated time remaining */}
          {status.status === 'processing' && status.estimatedTimeRemaining && status.estimatedTimeRemaining > 30 && (
            <Text style={styles.timeRemaining}>
              {t('voiceProcessing.estimatedTime')}: {formatTimeRemaining(status.estimatedTimeRemaining)}
            </Text>
          )}

          {/* Error message */}
          {status.status === 'failed' && status.error && (
            <Text style={styles.errorMessage} numberOfLines={2}>
              {status.error}
            </Text>
          )}

          {/* Tap hint */}
          {status.status === 'completed' && (
            <Text style={styles.tapHint}>
              {t('voiceProcessing.tapToReview')}
            </Text>
          )}
        </View>

        {/* Retry button for failed status */}
        {status.status === 'failed' && (
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRetry}
            activeOpacity={0.7}
          >
            <Text style={styles.retryButtonText}>{t('voiceProcessing.retry')}</Text>
          </TouchableOpacity>
        )}

        {/* Dismiss button */}
        {status.status !== 'processing' && (
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={handleDismiss}
            activeOpacity={0.7}
          >
            <Text style={styles.dismissButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    minHeight: NOTIFICATION_HEIGHT,
    zIndex: 9999,
    ...SHADOWS.lg,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    paddingTop: SPACING.xl + 40, // Account for status bar
  },
  indicatorContainer: {
    marginRight: SPACING.md,
  },
  checkmark: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.white + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  errorIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.white + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorIconText: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  textContainer: {
    flex: 1,
  },
  message: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.white,
    marginBottom: SPACING.xs,
  },
  queueInfo: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.white + 'CC',
    marginBottom: SPACING.xs,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  progressBarBackground: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.white + '30',
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.sm,
  },
  progressText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.white,
    minWidth: 40,
    textAlign: 'right',
  },
  timeRemaining: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.white + 'CC',
    marginTop: SPACING.xs,
  },
  errorMessage: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.white + 'EE',
    marginTop: SPACING.xs,
  },
  tapHint: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.white + 'CC',
    marginTop: SPACING.xs,
    fontStyle: 'italic',
  },
  retryButton: {
    backgroundColor: COLORS.white + '30',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    marginLeft: SPACING.sm,
  },
  retryButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.white,
  },
  dismissButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.sm,
  },
  dismissButtonText: {
    fontSize: 20,
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
});
