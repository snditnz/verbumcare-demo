import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useVoiceReviewStore } from '@stores/voiceReviewStore';
import { useAuthStore } from '@stores/authStore';
import { useAssessmentStore } from '@stores/assessmentStore';
import VoiceReviewCard from '@components/VoiceReviewCard';
import { ServerStatusIndicator } from '@components/ServerStatusIndicator';
import { LanguageToggle } from '@components';
import { Button } from '@components/ui';
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
    <SafeAreaView style={styles.container}>
      {/* Header - Three Section Layout */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerNavButtons}>
            <Button variant="text" onPress={() => navigation.goBack()}>
              {`← ${t('common.back')}`}
            </Button>
            <TouchableOpacity 
              style={styles.homeButton}
              onPress={() => (navigation as any).navigate('Dashboard')}
            >
              <Ionicons name="home" size={20} color={COLORS.primary} />
              <Text style={styles.homeButtonText}>
                {language === 'ja' ? 'ホーム' : 'Home'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.screenTitle}>{t('voiceReview.title')}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.headerRightContent}>
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
            <ServerStatusIndicator compact />
            <LanguageToggle />
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
    </SafeAreaView>
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
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerNavButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  homeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  homeButtonText: {
    marginLeft: SPACING.xs,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  headerCenter: {
    flex: 2,
    alignItems: 'center',
  },
  screenTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  headerRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  headerRightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
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
