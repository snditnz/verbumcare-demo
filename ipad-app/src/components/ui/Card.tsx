import React from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '@constants/theme';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: 'default' | 'elevated' | 'outlined';
  statusColor?: string; // For left border status indicator
  style?: ViewStyle;
  padding?: keyof typeof SPACING;
}

export const Card: React.FC<CardProps> = ({
  children,
  onPress,
  variant = 'default',
  statusColor,
  style,
  padding = 'lg',
}) => {
  const cardStyles: ViewStyle[] = [
    styles.base,
    styles[variant],
    { padding: SPACING[padding] },
    statusColor && { borderLeftWidth: 4, borderLeftColor: statusColor },
    style,
  ].filter(Boolean) as ViewStyle[];

  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      onPress={onPress}
      style={cardStyles}
      activeOpacity={onPress ? 0.7 : 1}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      {children}
    </Container>
  );
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.lg,
  },
  default: {
    ...SHADOWS.sm,
  },
  elevated: {
    ...SHADOWS.md,
  },
  outlined: {
    borderWidth: 1,
    borderColor: COLORS.border,
  },
});
