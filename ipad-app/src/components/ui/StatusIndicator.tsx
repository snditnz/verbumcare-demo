import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS, ICON_SIZES } from '@constants/theme';

interface StatusIndicatorProps {
  status: 'normal' | 'warning' | 'critical' | 'neutral' | 'success' | 'error';
  label: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  size?: 'small' | 'medium' | 'large';
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  subtitle,
  icon,
  size = 'medium',
}) => {
  const statusColors = {
    normal: COLORS.status.normal,
    warning: COLORS.status.warning,
    critical: COLORS.status.critical,
    neutral: COLORS.status.neutral,
    success: COLORS.success,
    error: COLORS.error,
  };

  const statusIcons = {
    normal: 'checkmark-circle' as keyof typeof Ionicons.glyphMap,
    warning: 'warning' as keyof typeof Ionicons.glyphMap,
    critical: 'alert-circle' as keyof typeof Ionicons.glyphMap,
    neutral: 'remove-circle' as keyof typeof Ionicons.glyphMap,
    success: 'checkmark-circle' as keyof typeof Ionicons.glyphMap,
    error: 'close-circle' as keyof typeof Ionicons.glyphMap,
  };

  const backgroundColor = `${statusColors[status]}15`; // 15 = 8.5% opacity in hex
  const color = statusColors[status];
  const displayIcon = icon || statusIcons[status];

  return (
    <View style={[styles.container, { backgroundColor }, size === 'large' && styles.containerLarge]}>
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: color }]}>
          <Ionicons
            name={displayIcon}
            size={size === 'large' ? ICON_SIZES.md : ICON_SIZES.sm}
            color={COLORS.accent}
          />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.label, size === 'large' && styles.labelLarge]}>{label}</Text>
          {subtitle && (
            <Text style={[styles.subtitle, size === 'large' && styles.subtitleLarge]}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  containerLarge: {
    padding: SPACING.lg,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  labelLarge: {
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
  },
  subtitleLarge: {
    fontSize: TYPOGRAPHY.fontSize.base,
  },
});
