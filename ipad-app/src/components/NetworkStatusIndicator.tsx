/**
 * Network Status Indicator
 *
 * Subtle visual indicator showing online/offline status
 * Shows in app header - doesn't block functionality
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetworkStatus } from '@services/networkStatus';
import { COLORS, TYPOGRAPHY, SPACING } from '@constants/theme';

interface NetworkStatusIndicatorProps {
  showLabel?: boolean;
  compact?: boolean;
}

export const NetworkStatusIndicator: React.FC<NetworkStatusIndicatorProps> = ({
  showLabel = false,
  compact = true,
}) => {
  const { isConnected } = useNetworkStatus();

  if (compact) {
    // Just a small dot indicator
    return (
      <View style={styles.compactContainer}>
        <View style={[styles.dot, isConnected ? styles.dotOnline : styles.dotOffline]} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Ionicons
        name={isConnected ? 'cloud-done-outline' : 'cloud-offline-outline'}
        size={16}
        color={isConnected ? COLORS.success : COLORS.text.disabled}
      />
      {showLabel && (
        <Text style={[styles.label, isConnected ? styles.labelOnline : styles.labelOffline]}>
          {isConnected ? 'Online' : 'Offline'}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  compactContainer: {
    paddingHorizontal: SPACING.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotOnline: {
    backgroundColor: COLORS.success,
  },
  dotOffline: {
    backgroundColor: COLORS.text.disabled,
  },
  label: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  labelOnline: {
    color: COLORS.success,
  },
  labelOffline: {
    color: COLORS.text.disabled,
  },
});
