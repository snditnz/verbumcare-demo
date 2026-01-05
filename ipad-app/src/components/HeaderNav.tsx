import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Button } from '@components/ui';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS } from '@constants/theme';
import { translations } from '@constants/translations';
import { useAssessmentStore } from '@stores/assessmentStore';

interface HeaderNavProps {
  /** Custom back action - if not provided, uses navigation.goBack() */
  onBack?: () => void;
  /** Custom back label - if not provided, uses translated "Back" */
  backLabel?: string;
  /** Show home button - defaults to true */
  showHome?: boolean;
  /** Custom home action - if not provided, navigates to Dashboard */
  onHome?: () => void;
}

/**
 * Reusable header navigation component with Back and Home buttons
 * Provides consistent navigation across all sub-screens
 */
export function HeaderNav({ 
  onBack, 
  backLabel, 
  showHome = true,
  onHome 
}: HeaderNavProps) {
  const navigation = useNavigation<any>();
  const { language } = useAssessmentStore();
  const t = translations[language];

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigation.goBack();
    }
  };

  const handleHome = () => {
    if (onHome) {
      onHome();
    } else {
      navigation.navigate('Dashboard');
    }
  };

  return (
    <View style={styles.container}>
      <Button variant="text" onPress={handleBack}>
        {backLabel || `← ${t['common.back']}`}
      </Button>
      
      {showHome && (
        <TouchableOpacity style={styles.homeButton} onPress={handleHome}>
          <Ionicons name="home" size={20} color={COLORS.primary} />
          <Text style={styles.homeButtonText}>
            {language === 'ja' ? 'ホーム' : 'Home'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  homeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  homeButtonText: {
    marginLeft: SPACING.xs,
    color: COLORS.primary,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '500',
  },
});

export default HeaderNav;
