import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS } from '@constants/theme';
import { NoteType } from '@stores/clinicalNotesStore';

interface NoteBadgeProps {
  noteType: NoteType;
  authorRole?: string;
  size?: 'small' | 'medium';
  style?: ViewStyle;
}

export const NoteBadge: React.FC<NoteBadgeProps> = ({
  noteType,
  authorRole,
  size = 'medium',
  style,
}) => {
  const getBadgeConfig = () => {
    switch (noteType) {
      case 'nurse_note':
        return {
          backgroundColor: COLORS.secondary, // Healthcare Green
          textColor: COLORS.white,
          labelEn: 'Nurse',
          labelJa: '看護師',
          icon: '👩‍⚕️',
        };
      case 'doctor_note':
        return {
          backgroundColor: COLORS.primary, // Navy/Slate
          textColor: COLORS.white,
          labelEn: 'Doctor',
          labelJa: '医師',
          icon: '👨‍⚕️',
        };
      case 'care_note':
        return {
          backgroundColor: COLORS.accent, // Fresh Lime
          textColor: COLORS.primary,
          labelEn: 'Care',
          labelJa: '介護',
          icon: '🤝',
        };
      default:
        return {
          backgroundColor: COLORS.neutral,
          textColor: COLORS.white,
          labelEn: 'Note',
          labelJa: '記録',
          icon: '📝',
        };
    }
  };

  const config = getBadgeConfig();
  const sizeStyle = size === 'small' ? styles.small : styles.medium;

  return (
    <View
      style={[
        styles.badge,
        sizeStyle,
        { backgroundColor: config.backgroundColor },
        style,
      ]}
    >
      {size === 'medium' && (
        <Text style={[styles.icon, styles.iconMedium]}>{config.icon}</Text>
      )}
      <Text
        style={[
          styles.text,
          { color: config.textColor },
          size === 'small' ? styles.textSmall : styles.textMedium,
        ]}
      >
        {config.labelJa}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.full,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    alignSelf: 'flex-start',
  },
  small: {
    paddingVertical: SPACING.xs / 2,
    paddingHorizontal: SPACING.xs,
  },
  medium: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  icon: {
    marginRight: SPACING.xs,
  },
  iconMedium: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  text: {
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  textSmall: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  textMedium: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
});
