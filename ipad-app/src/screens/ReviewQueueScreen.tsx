import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useVoiceReviewStore } from '@stores/voiceReviewStore';
import { useAuthStore } from '@stores/authStore';
import { useAssessmentStore } from '@stores/assessmentStore';
import VoiceReviewCard from '@components/VoiceReviewCard';
import { ServerStatusIndicator } from '@components/ServerStatusIndicator';
import { ReviewQueueSkeleton } from '@components/ui/SkeletonLoader';
import { FadeIn } from '@components/ui/AnimatedTransitions';
import { ErrorMessage } from '@components/ui/ErrorBoundary';
import { HelpButton, OnboardingModal } from '@components/ui/UserGuidance';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '@constants/theme';
import { translations } from '@constants/translations';
import { getHelpMessage } from '@utils/errorMessages';

/**
 * ReviewQueueScreen
 * 
 * Displays list of pending voice reviews awaiting user approval.
 * Features:
 * - Notification badge with count
 * - Chronological ordering (oldest first)
 * - Urgency highlighting for items >24 hours old
 * - Pull-to-refresh
 * - Empty state handling
 * 
 * Requirements: 8.2, 8.3, 8.6
 */

export default function ReviewQueueScreen() {
  const navigation = useNavigation();
  const { currentUser } = useAuthStore();
  const { language } = useAssessmentStore();
  const {
    reviewQueue,
    isLoading,
    error,
    loadQueue,
    queueCount,
    clearError,
  } = useVoiceReviewStore();

  const [refreshing, setRefreshing] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const t = (key: string) => translations[language][key] || key;

  // Load queue on mount
  useEffect(() => {
    if (currentUser?.userId) {
      loadQueue(currentUser.userId);
    }
  }, [currentUser?.userId]);

  // Handle pull-to-refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (currentUser?.userId) {
        await loadQueue(currentUser.userId);
      }
    } finally {
      setRefreshing(false);
    }
  };

  // Handle review item tap
  const handleReviewTap = (reviewId: string) => {
    (navigation as any).navigate('VoiceReview', { reviewId });
  };

  // Filter pending reviews only
  const pendingReviews = reviewQueue.filter(item => item.status === 'pending');

  // Render loading skeleton
  const renderLoadingSkeleton = () => {
    return (
      <View style={styles.skeletonContainer}>
        {Array.from({ length: 3 }).map((_, index) => (
          <FadeIn key={index} delay={index * 100}>
            <ReviewQueueSkeleton />
          </FadeIn>
        ))}
      </View>
    );
  };

  // Render empty state
  const renderEmptyState = () => {
    if (isLoading) {
      return renderLoadingSkeleton();
    }

    return (
      <FadeIn>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>✓</Text>
          <Text style={styles.emptyTitle}>{t('voiceReview.noReviews')}</Text>
          <Text style={styles.emptySubtitle}>{t('voiceReview.allCaughtUp')}</Text>
        </View>
      </FadeIn>
    );
  };

  // Render review item with animation
  const renderReviewItem = ({ item, index }: { item: any; index: number }) => {
    return (
      <FadeIn delay={index * 50}>
        <VoiceReviewCard
          item={item}
          language={language}
          onPress={handleReviewTap}
        />
      </FadeIn>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Back"
            accessibilityHint="Go back to previous screen"
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('voiceReview.title')}</Text>
        </View>
        <View style={styles.headerActions}>
          <ServerStatusIndicator compact />
          {queueCount() > 0 && (
            <View 
              style={styles.badge}
              accessible={true}
              accessibilityRole="text"
              accessibilityLabel={`${queueCount()} ${t('voiceReview.pendingReviews')}`}
            >
              <Text style={styles.badgeText}>{queueCount()}</Text>
            </View>
          )}
          <View
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Help"
            accessibilityHint="Show help information"
          >
            <HelpButton
              onPress={() => setShowOnboarding(true)}
              style={{ marginLeft: SPACING.sm }}
            />
          </View>
        </View>
      </View>

      {/* Error message */}
      {error && (
        <ErrorMessage
          message={error}
          type="error"
          onDismiss={clearError}
          actionText="Refresh"
          onAction={handleRefresh}
        />
      )}

      {/* Review list */}
      <FlatList
        data={pendingReviews}
        renderItem={({ item, index }) => renderReviewItem({ item, index })}
        keyExtractor={(item) => item.reviewId}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
            accessibilityLabel="Refresh"
          />
        }
        showsVerticalScrollIndicator={false}
        accessible={true}
        accessibilityRole="list"
        accessibilityLabel="Review queue list"
        accessibilityHint="Pull down to refresh"
      />

      {/* Onboarding Modal */}
      <OnboardingModal
        visible={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        title={t('voiceReview.helpTitle')}
        steps={[
          {
            title: t('voiceReview.helpStep1Title'),
            description: t('voiceReview.helpStep1Description'),
            tips: getHelpMessage('REVIEW_QUEUE', language)?.tips || [],
          },
          {
            title: t('voiceReview.helpStep2Title'),
            description: t('voiceReview.helpStep2Description'),
            tips: getHelpMessage('CONFIDENCE_SCORES', language)?.tips || [],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: SPACING.md,
    padding: SPACING.sm,
  },
  backButtonText: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    color: COLORS.primary,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  badge: {
    backgroundColor: COLORS.error,
    borderRadius: BORDER_RADIUS.full,
    minWidth: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
  },
  badgeText: {
    color: COLORS.white,
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
  errorText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.error,
  },
  errorDismiss: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: COLORS.error,
    paddingLeft: SPACING.md,
  },
  listContent: {
    padding: SPACING.lg,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING['4xl'],
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  emptySubtitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    marginTop: SPACING.md,
  },
  skeletonContainer: {
    padding: SPACING.lg,
  },
});
