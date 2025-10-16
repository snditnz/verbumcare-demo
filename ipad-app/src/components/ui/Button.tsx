import React, { ReactNode } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS, ANIMATION } from '@constants/theme';

interface ButtonProps {
  onPress: () => void;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'accent' | 'outline' | 'text';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export const Button: React.FC<ButtonProps> = ({
  onPress,
  children,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
}) => {
  const buttonStyles: ViewStyle[] = [
    styles.base,
    styles[variant],
    styles[`size_${size}`],
    fullWidth && styles.fullWidth,
    (disabled || loading) && styles.disabled,
    style,
  ].filter(Boolean) as ViewStyle[];

  const textStyles: TextStyle[] = [
    styles.textBase,
    styles[`text_${variant}`],
    styles[`text_${size}`],
  ].filter(Boolean) as TextStyle[];

  const getLoadingColor = () => {
    switch (variant) {
      case 'primary':
      case 'secondary':
      case 'success':
        return COLORS.white;
      case 'accent':
        return COLORS.primary;
      default:
        return COLORS.primary;
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={buttonStyles}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
    >
      {loading ? (
        <ActivityIndicator
          color={getLoadingColor()}
          size="small"
        />
      ) : typeof children === 'string' ? (
        <Text style={textStyles}>{children}</Text>
      ) : (
        children
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.xl,
    minHeight: SPACING.touchTarget.comfortable,
  },
  primary: {
    backgroundColor: COLORS.primary,
  },
  secondary: {
    backgroundColor: COLORS.secondary,
  },
  success: {
    backgroundColor: COLORS.success,
  },
  accent: {
    backgroundColor: COLORS.accent,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  text: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.5,
  },
  fullWidth: {
    width: '100%',
  },

  // Sizes
  size_small: {
    paddingHorizontal: SPACING.lg,
    minHeight: SPACING.touchTarget.min,
  },
  size_medium: {
    paddingHorizontal: SPACING.xl,
    minHeight: SPACING.touchTarget.comfortable,
  },
  size_large: {
    paddingHorizontal: SPACING['2xl'],
    minHeight: SPACING.touchTarget.large,
  },

  // Text Styles
  textBase: {
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  text_primary: {
    color: COLORS.text.inverse,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  text_secondary: {
    color: COLORS.text.inverse,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  text_success: {
    color: COLORS.text.inverse,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  text_accent: {
    color: COLORS.primary,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  text_outline: {
    color: COLORS.primary,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  text_text: {
    color: COLORS.primary,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  text_small: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  text_medium: {
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  text_large: {
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
});
