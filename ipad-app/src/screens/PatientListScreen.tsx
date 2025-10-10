import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TextInput, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAssessmentStore } from '@stores/assessmentStore';
import { PatientCard, LanguageToggle } from '@components';
import { Patient } from '@models';
import { apiService } from '@services';
import { translations } from '@constants/translations';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS, ICON_SIZES, SHADOWS } from '@constants/theme';
import { debugStorage } from '../utils/debugStorage';

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
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const t = translations[language];

  useEffect(() => {
    setCurrentStep('patient-list');
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      setLoading(true);
      setError(null);
      // Use API with caching (cache-first strategy)
      const data = await apiService.getPatients(true);
      setPatients(data);
    } catch (err: any) {
      console.error('Error loading patients:', err);
      setError(err.message || 'Failed to load patients');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPatient = (patient: Patient) => {
    setCurrentPatient(patient);
    // Go to Patient Info hub after selecting patient
    navigation.navigate('PatientInfo' as any);
  };

  const handleBarcodePress = () => {
    // Clear current patient and scan to select a new one
    setCurrentPatient(null);
    navigation.navigate('PatientScan');
  };

  // Get unique rooms for filter chips
  const rooms = Array.from(new Set(patients.map(p => p.room).filter((room): room is string => !!room)));

  // Filter patients based on search and room
  const filteredPatients = patients.filter(patient => {
    const japaneseName = `${patient.family_name} ${patient.given_name}`;
    const englishName = `${patient.family_name_en || ''} ${patient.given_name_en || ''}`;

    const matchesSearch = searchQuery === '' ||
      japaneseName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      englishName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.mrn.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRoom = selectedRoom === null || patient.room === selectedRoom;

    return matchesSearch && matchesRoom;
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>VerbumCare</Text>
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
          <TouchableOpacity onPress={() => debugStorage()}>
            <Ionicons name="bug-outline" size={24} color={COLORS.accent} />
          </TouchableOpacity>
          <LanguageToggle />
        </View>
      </View>

      {/* Search Section */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={ICON_SIZES.md} color={COLORS.text.secondary} />
          <TextInput
            style={styles.searchInput}
            placeholder={language === 'ja' ? '患者を検索' : 'Search patient'}
            placeholderTextColor={COLORS.text.disabled}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={ICON_SIZES.md} color={COLORS.text.secondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Room Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.roomFilters}
          contentContainerStyle={styles.roomFiltersContent}
        >
          <TouchableOpacity
            style={[styles.roomChip, selectedRoom === null && styles.roomChipActive]}
            onPress={() => setSelectedRoom(null)}
          >
            <Text style={[styles.roomChipText, selectedRoom === null && styles.roomChipTextActive]}>
              {t['patient.allRooms'] || 'All Rooms'}
            </Text>
          </TouchableOpacity>
          {rooms.map((room) => (
            <TouchableOpacity
              key={room}
              style={[styles.roomChip, selectedRoom === room && styles.roomChipActive]}
              onPress={() => setSelectedRoom(room)}
            >
              <Text style={[styles.roomChipText, selectedRoom === room && styles.roomChipTextActive]}>
                {room}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Patient List */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {loading && (
          <View style={styles.centerMessage}>
            <Text style={styles.messageText}>{t['common.loading'] || 'Loading...'}</Text>
          </View>
        )}

        {error && (
          <View style={styles.centerMessage}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadPatients}>
              <Text style={styles.retryButtonText}>{t['common.retry'] || 'Retry'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !error && filteredPatients.length === 0 && (
          <View style={styles.centerMessage}>
            <Text style={styles.messageText}>
              {searchQuery || selectedRoom
                ? (t['patient.noResults'] || 'No patients found')
                : (t['patient.noPatients'] || 'No patients')}
            </Text>
          </View>
        )}

        {!loading && !error && filteredPatients.map((patient) => (
          <PatientCard
            key={patient.patient_id}
            patient={patient}
            onPress={() => handleSelectPatient(patient)}
          />
        ))}
      </ScrollView>

      {/* Floating Barcode Button */}
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={handleBarcodePress}
        accessibilityLabel={t['scan.scanBarcode'] || 'Scan barcode'}
      >
        <Ionicons name="barcode-outline" size={ICON_SIZES.lg} color={COLORS.accent} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    height: 64,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.primary,
    ...SHADOWS.sm,
  },
  logo: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.accent,
  },
  searchSection: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    backgroundColor: COLORS.surface,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg,
    minHeight: SPACING.touchTarget.min,
    gap: SPACING.md,
  },
  searchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
  },
  roomFilters: {
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  roomFiltersContent: {
    gap: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  roomChip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  roomChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  roomChipText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.secondary,
  },
  roomChipTextActive: {
    color: COLORS.accent,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: SPACING.lg,
  },
  floatingButton: {
    position: 'absolute',
    bottom: SPACING['3xl'],
    right: SPACING.xl,
    width: SPACING.touchTarget.large,
    height: SPACING.touchTarget.large,
    borderRadius: SPACING.touchTarget.large / 2,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.lg,
  },
  centerMessage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING['3xl'],
  },
  messageText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
  errorText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.status.critical,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  retryButton: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
  },
  retryButtonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.accent,
  },
});
