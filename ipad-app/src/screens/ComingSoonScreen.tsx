import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Button } from '@components/ui';
import { useAssessmentStore } from '@stores/assessmentStore';
import { translations } from '@constants/translations';
import { COLORS, TYPOGRAPHY, SPACING, ICON_SIZES } from '@constants/theme';

type RootStackParamList = {
  ComingSoon: { feature: string };
  PatientInfo: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ComingSoon'>;
  route: RouteProp<RootStackParamList, 'ComingSoon'>;
};

export default function ComingSoonScreen({ navigation, route }: Props) {
  const { language } = useAssessmentStore();
  const t = translations[language];
  const { feature } = route.params;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="construct" size={120} color={COLORS.text.disabled} />
        <Text style={styles.title}>
          {language === 'ja' ? '開発中' : 'Coming Soon'}
        </Text>
        <Text style={styles.featureName}>{feature}</Text>
        <Text style={styles.message}>
          {language === 'ja'
            ? `${feature}機能は開発中です`
            : `${feature} feature is under development`}
        </Text>
        <Button
          variant="primary"
          onPress={() => navigation.goBack()}
          style={styles.button}
        >
          {language === 'ja' ? '戻る' : 'Go Back'}
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    gap: SPACING.lg,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize['3xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    textAlign: 'center',
  },
  featureName: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.primary,
    textAlign: 'center',
  },
  message: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.fontSize.base * 1.5,
  },
  button: {
    marginTop: SPACING.lg,
    minWidth: 200,
  },
});
