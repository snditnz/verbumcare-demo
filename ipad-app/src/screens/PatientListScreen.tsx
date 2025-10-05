import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAssessmentStore } from '@stores/assessmentStore';
import { PatientCard, WorkflowProgress, LanguageToggle } from '@components';
import { DEMO_PATIENTS } from '@constants/demoPatients';
import { Patient } from '@types';
import { apiService } from '@services';
import { translations } from '@constants/translations';
import { UI_COLORS } from '@constants/config';

type RootStackParamList = {
  PatientList: undefined;
  PatientScan: undefined;
  VitalsCapture: undefined;
  ADLVoice: undefined;
  IncidentReport: undefined;
  ReviewConfirm: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'PatientList'>;
};

export default function PatientListScreen({ navigation }: Props) {
  const { setCurrentPatient, setCurrentStep, language } = useAssessmentStore();
  const [patients, setPatients] = useState<Patient[]>(DEMO_PATIENTS);
  const [loading, setLoading] = useState(false);
  const t = translations[language];

  useEffect(() => {
    setCurrentStep('patient-list');
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      setLoading(true);
      const response = await apiService.getPatients();
      if (response.length > 0) {
        setPatients(response);
      }
    } catch (error) {
      console.log('Using demo patients, API unavailable:', error);
      // Fall back to DEMO_PATIENTS
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPatient = (patient: Patient) => {
    setCurrentPatient(patient);
    navigation.navigate('PatientScan');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <WorkflowProgress />
        <View style={styles.headerRight}>
          <LanguageToggle />
        </View>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.title}>{t['patient.selectPatient']}</Text>
        <Text style={styles.subtitle}>{t['patient.selectHint']}</Text>

        {patients.map((patient) => (
          <PatientCard
            key={patient.patient_id}
            patient={patient}
            onPress={() => handleSelectPatient(patient)}
          />
        ))}
      </ScrollView>
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: UI_COLORS.text,
    marginTop: 24,
    marginHorizontal: 16,
  },
  subtitle: {
    fontSize: 16,
    color: UI_COLORS.textSecondary,
    marginTop: 8,
    marginBottom: 16,
    marginHorizontal: 16,
  },
});
