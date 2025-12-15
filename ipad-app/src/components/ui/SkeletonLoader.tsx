import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '@constants/theme';

/**
 * SkeletonLoader Component
 * 
 * Provides skeleton loading placeholders with shimmer animation.
 * Used throughout the app for loading states.
 */

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export function SkeletonLoader({
  width = '100%',
  height = 20,
  borderRadius = BORDER_RADIUS.sm,
  style,
}: SkeletonLoaderProps) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    shimmer.start();

    return () => shimmer.stop();
  }, []);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
}

/**
 * ReviewQueueSkeleton
 * 
 * Skeleton loader specifically for review queue items
 */
export function ReviewQueueSkeleton() {
  return (
    <View style={styles.reviewCardSkeleton}>
      <View style={styles.reviewCardHeader}>
        <SkeletonLoader width={120} height={16} />
        <SkeletonLoader width={60} height={24} borderRadius={BORDER_RADIUS.full} />
      </View>
      <SkeletonLoader width="80%" height={14} style={{ marginTop: SPACING.sm }} />
      <SkeletonLoader width="60%" height={14} style={{ marginTop: SPACING.xs }} />
      <View style={styles.reviewCardFooter}>
        <SkeletonLoader width={80} height={12} />
        <SkeletonLoader width={100} height={12} />
      </View>
    </View>
  );
}

/**
 * ExtractedDataSkeleton
 * 
 * Skeleton loader for extracted data sections
 */
export function ExtractedDataSkeleton() {
  return (
    <View style={styles.extractedDataSkeleton}>
      <SkeletonLoader width={150} height={18} style={{ marginBottom: SPACING.md }} />
      <View style={styles.fieldGroup}>
        <SkeletonLoader width={80} height={14} />
        <SkeletonLoader width="100%" height={40} style={{ marginTop: SPACING.xs }} />
      </View>
      <View style={styles.fieldGroup}>
        <SkeletonLoader width={100} height={14} />
        <SkeletonLoader width="70%" height={40} style={{ marginTop: SPACING.xs }} />
      </View>
      <View style={styles.fieldGroup}>
        <SkeletonLoader width={90} height={14} />
        <SkeletonLoader width="85%" height={40} style={{ marginTop: SPACING.xs }} />
      </View>
    </View>
  );
}

/**
 * TranscriptSkeleton
 * 
 * Skeleton loader for transcript section
 */
export function TranscriptSkeleton() {
  return (
    <View style={styles.transcriptSkeleton}>
      <SkeletonLoader width={100} height={18} style={{ marginBottom: SPACING.md }} />
      <View style={styles.transcriptLines}>
        <SkeletonLoader width="95%" height={16} />
        <SkeletonLoader width="88%" height={16} style={{ marginTop: SPACING.sm }} />
        <SkeletonLoader width="92%" height={16} style={{ marginTop: SPACING.sm }} />
        <SkeletonLoader width="75%" height={16} style={{ marginTop: SPACING.sm }} />
        <SkeletonLoader width="85%" height={16} style={{ marginTop: SPACING.sm }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: COLORS.border,
  },
  reviewCardSkeleton: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  reviewCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.lg,
  },
  extractedDataSkeleton: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
  },
  fieldGroup: {
    marginBottom: SPACING.lg,
  },
  transcriptSkeleton: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
  },
  transcriptLines: {
    gap: SPACING.sm,
  },
});