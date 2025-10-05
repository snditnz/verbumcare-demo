import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAssessmentStore } from '@stores/assessmentStore';
import { WorkflowProgress, LanguageToggle } from '@components';
import { translations } from '@constants/translations';
import { UI_COLORS } from '@constants/config';

type RootStackParamList = {
  IncidentReport: undefined;
  ReviewConfirm: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'IncidentReport'>;
};

export default function IncidentReportScreen({ navigation }: Props) {
  const { setCurrentStep, language } = useAssessmentStore();
  const t = translations[language];

  useEffect(() => {
    setCurrentStep('incident-report');
  }, []);

  const handleSkip = () => {
    navigation.navigate('ReviewConfirm');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <WorkflowProgress />
        <LanguageToggle />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>{t['incident.title']}</Text>
        <Text style={styles.subtitle}>{t['incident.instruction']}</Text>

        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>{t['incident.comingSoon']}</Text>
          <Text style={styles.placeholderSubtext}>
            {t['incident.features']}
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.button}
            onPress={handleSkip}
          >
            <Text style={styles.buttonText}>{t['common.continue']}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI_COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: UI_COLORS.border,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: UI_COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: UI_COLORS.textSecondary,
    marginBottom: 24,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  placeholderText: {
    fontSize: 24,
    fontWeight: '700',
    color: UI_COLORS.textSecondary,
    marginBottom: 16,
  },
  placeholderSubtext: {
    fontSize: 16,
    color: UI_COLORS.textSecondary,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    marginTop: 'auto',
  },
  button: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
    backgroundColor: UI_COLORS.primary,
    minWidth: 120,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
