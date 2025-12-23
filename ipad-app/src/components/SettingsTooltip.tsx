/**
 * Settings Tooltip Component
 * 
 * Provides contextual tooltips for settings screen elements.
 * Includes help text for server switching, connection testing, and other settings features.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS, SHADOWS } from '@constants/theme';
import { Tooltip } from '@components/ui/UserGuidance';
import { translations } from '@constants/translations';
import { Language } from '@types/app';

interface SettingsTooltipProps {
  type: 'serverSelector' | 'connectionTest' | 'languageSelector' | 'healthCheck' | 'debugLogs';
  children: React.ReactNode;
  language: Language;
  visible?: boolean;
  onVisibilityChange?: (visible: boolean) => void;
}

export function SettingsTooltip({
  type,
  children,
  language,
  visible,
  onVisibilityChange,
}: SettingsTooltipProps) {
  const t = translations[language];
  
  const getTooltipContent = (): string => {
    switch (type) {
      case 'serverSelector':
        return t['settings.tooltip.serverSelector'];
      case 'connectionTest':
        return t['settings.tooltip.connectionTest'];
      case 'languageSelector':
        return t['settings.tooltip.languageSelector'];
      case 'healthCheck':
        return t['settings.tooltip.healthCheck'];
      case 'debugLogs':
        return t['settings.tooltip.debugLogs'];
      default:
        return '';
    }
  };

  return (
    <Tooltip
      content={getTooltipContent()}
      position="bottom"
      visible={visible}
      onVisibilityChange={onVisibilityChange}
    >
      {children}
    </Tooltip>
  );
}

/**
 * Help Icon Component
 * 
 * Small help icon that can be placed next to settings elements
 */
interface HelpIconProps {
  onPress: () => void;
  size?: number;
  color?: string;
}

export function HelpIcon({ onPress, size = 16, color = COLORS.text.secondary }: HelpIconProps) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.helpIcon} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Ionicons name="help-circle" size={size} color={color} />
    </TouchableOpacity>
  );
}

/**
 * Info Card Component
 * 
 * Displays informational content with an icon and description
 */
interface InfoCardProps {
  icon: string;
  title: string;
  description: string;
  color?: string;
  onPress?: () => void;
}

export function InfoCard({ icon, title, description, color = COLORS.info, onPress }: InfoCardProps) {
  const Component = onPress ? TouchableOpacity : View;
  
  return (
    <Component style={styles.infoCard} onPress={onPress}>
      <View style={[styles.infoIcon, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoTitle}>{title}</Text>
        <Text style={styles.infoDescription}>{description}</Text>
      </View>
      {onPress && (
        <Ionicons name="chevron-forward" size={16} color={COLORS.text.secondary} />
      )}
    </Component>
  );
}

/**
 * Quick Help Banner Component
 * 
 * Displays a dismissible banner with quick help information
 */
interface QuickHelpBannerProps {
  title: string;
  message: string;
  onDismiss: () => void;
  onLearnMore?: () => void;
  language: Language;
}

export function QuickHelpBanner({ title, message, onDismiss, onLearnMore, language }: QuickHelpBannerProps) {
  return (
    <View style={styles.helpBanner}>
      <View style={styles.helpBannerIcon}>
        <Ionicons name="information-circle" size={20} color={COLORS.info} />
      </View>
      <View style={styles.helpBannerContent}>
        <Text style={styles.helpBannerTitle}>{title}</Text>
        <Text style={styles.helpBannerMessage}>{message}</Text>
        {onLearnMore && (
          <TouchableOpacity onPress={onLearnMore} style={styles.learnMoreButton}>
            <Text style={styles.learnMoreText}>
              {language === 'ja' ? '詳細を見る' : language === 'zh-TW' ? '了解更多' : 'Learn More'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity onPress={onDismiss} style={styles.dismissButton}>
        <Ionicons name="close" size={16} color={COLORS.text.secondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  helpIcon: {
    padding: SPACING.xs,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginVertical: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  infoDescription: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    lineHeight: TYPOGRAPHY.lineHeight.normal,
  },
  helpBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: `${COLORS.info}10`,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginVertical: SPACING.sm,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.info,
  },
  helpBannerIcon: {
    marginRight: SPACING.sm,
    marginTop: 2,
  },
  helpBannerContent: {
    flex: 1,
  },
  helpBannerTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  helpBannerMessage: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    lineHeight: TYPOGRAPHY.lineHeight.normal,
    marginBottom: SPACING.sm,
  },
  learnMoreButton: {
    alignSelf: 'flex-start',
  },
  learnMoreText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.info,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  dismissButton: {
    padding: SPACING.xs,
    marginLeft: SPACING.sm,
  },
});