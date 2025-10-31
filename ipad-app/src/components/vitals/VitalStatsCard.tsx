/**
 * VitalStatsCard Component
 *
 * Displays statistical summary for a vital type over a date range.
 * Shows min, max, average, and trend indicators.
 *
 * @example
 * <VitalStatsCard
 *   min={72}
 *   max={88}
 *   avg={76.5}
 *   trend="stable"
 *   unit="bpm"
 *   count={14}
 * />
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING } from '@/constants/theme';

interface Props {
  min: number;
  max: number;
  avg: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  unit: string;
  count?: number;
  label?: string;
}

/**
 * Get trend icon and color
 */
const getTrendDisplay = (trend: 'increasing' | 'decreasing' | 'stable') => {
  switch (trend) {
    case 'increasing':
      return { icon: '↗', color: COLORS.warning, label: 'Increasing' };
    case 'decreasing':
      return { icon: '↘', color: COLORS.info, label: 'Decreasing' };
    case 'stable':
      return { icon: '→', color: COLORS.success, label: 'Stable' };
  }
};

export const VitalStatsCard: React.FC<Props> = ({
  min,
  max,
  avg,
  trend,
  unit,
  count,
  label = 'Statistics',
}) => {
  const trendDisplay = getTrendDisplay(trend);

  // Handle null/undefined values
  if (min == null || max == null || avg == null) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <Text style={styles.header}>{label}</Text>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        {/* Min */}
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Min</Text>
          <Text style={styles.statValue}>
            {min} <Text style={styles.unit}>{unit}</Text>
          </Text>
        </View>

        {/* Avg */}
        <View style={[styles.statItem, styles.statItemCenter]}>
          <Text style={styles.statLabel}>Avg</Text>
          <Text style={[styles.statValue, styles.statValueLarge]}>
            {avg.toFixed(1)} <Text style={styles.unit}>{unit}</Text>
          </Text>
        </View>

        {/* Max */}
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Max</Text>
          <Text style={styles.statValue}>
            {max} <Text style={styles.unit}>{unit}</Text>
          </Text>
        </View>

        {/* Trend */}
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Trend</Text>
          <View style={styles.trendContainer}>
            <Text style={[styles.trendIcon, { color: trendDisplay.color }]}>
              {trendDisplay.icon}
            </Text>
            <Text style={[styles.trendText, { color: trendDisplay.color }]}>
              {trendDisplay.label}
            </Text>
          </View>
        </View>
      </View>

      {/* Footer */}
      {count !== undefined && (
        <Text style={styles.footer}>
          Based on {count} reading{count !== 1 ? 's' : ''}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statItemCenter: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: COLORS.border,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  statValueLarge: {
    fontSize: 28,
    color: COLORS.primary,
  },
  unit: {
    fontSize: 14,
    fontWeight: '400',
    color: COLORS.textSecondary,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendIcon: {
    fontSize: 20,
    fontWeight: '700',
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    fontStyle: 'italic',
  },
});
