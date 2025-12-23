/**
 * VitalsGraphScreen
 *
 * Displays detailed vitals history with interactive graphs and statistics.
 * Currently optimized for heart rate visualization (MVP).
 *
 * Features:
 * - Line chart with clinical zones
 * - Statistics summary (min/max/avg/trend)
 * - Date range selector (7d, 30d, 90d, all)
 * - Interactive data points
 * - Loading and error states
 *
 * Future: Expand to all 9 vital types
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SPACING } from '@/constants/theme';
import { useVitalsHistoryStore } from '@/stores/vitalsHistoryStore';
import { useAssessmentStore } from '@/stores/assessmentStore';
import { VitalDetailedGraph } from '@/components/vitals/VitalDetailedGraph';
import { VitalStatsCard } from '@/components/vitals/VitalStatsCard';
import { DateRangeSelector } from '@/components/vitals/DateRangeSelector';
import { APIVitalSigns } from '@/models/api';
import apiService from '@/services/api';
import { translations } from '@/constants/translations';
import { LanguageToggle } from '@/components';
import { ServerStatusIndicator } from '@/components/ServerStatusIndicator';

type RootStackParamList = {
  VitalsGraph: {
    patientId: string;
    vitalType?: 'heart_rate' | 'blood_pressure' | 'temperature' | 'spo2' | 'respiratory_rate' | 'blood_glucose' | 'weight' | 'consciousness';
  };
};

type VitalsGraphScreenRouteProp = RouteProp<RootStackParamList, 'VitalsGraph'>;
type VitalsGraphScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'VitalsGraph'>;

export const VitalsGraphScreen: React.FC = () => {
  const route = useRoute<VitalsGraphScreenRouteProp>();
  const navigation = useNavigation<VitalsGraphScreenNavigationProp>();
  const { patientId, vitalType = 'heart_rate' } = route.params;

  // Stores
  const vitalsHistoryStore = useVitalsHistoryStore();
  const { currentPatient, language } = useAssessmentStore();
  const t = translations[language];

  // Subscribe to store state changes
  const vitalsHistory = useVitalsHistoryStore((state) => state.vitalsHistory);
  const isLoading = useVitalsHistoryStore((state) => state.isLoading);
  const error = useVitalsHistoryStore((state) => state.error);
  const statistics = useVitalsHistoryStore((state) => state.statistics);
  const currentVitalType = useVitalsHistoryStore((state) => state.currentVitalType);

  // Local state
  const [selectedReading, setSelectedReading] = useState<APIVitalSigns | null>(null);
  const [diastolicStats, setDiastolicStats] = useState<any>(null);

  // Patient should match the patientId parameter
  const patient = currentPatient?.patient_id === patientId ? currentPatient : null;

  // Reload data when screen gains focus (includes initial mount)
  useFocusEffect(
    React.useCallback(() => {
      console.log('[VitalsGraph] Screen focused, reloading data...');
      vitalsHistoryStore.loadHistory(patientId, vitalType);
      vitalsHistoryStore.loadStatistics(patientId, vitalType);

      // For BP, also load diastolic statistics
      if (vitalType === 'blood_pressure') {
        const loadDiastolicStats = async () => {
          try {
            const stats = await apiService.getVitalsStatistics(
              patientId,
              vitalsHistoryStore.dateRange.start.toISOString(),
              vitalsHistoryStore.dateRange.end.toISOString(),
              'bp_diastolic'
            );
            setDiastolicStats(stats);
          } catch (error) {
            console.error('Failed to load diastolic statistics:', error);
          }
        };
        loadDiastolicStats();
      }
    }, [patientId, vitalType])
  );

  // Get chart data (recomputed when vitalsHistory changes)
  const chartData = vitalsHistoryStore.getChartData();

  // Get vital type display info
  const getVitalInfo = () => {
    switch (vitalType) {
      case 'heart_rate':
        return { title: t['vitals.heartRate'], unit: 'bpm' };
      case 'blood_pressure':
        return { title: t['vitals.bloodPressure'], unit: 'mmHg' };
      case 'temperature':
        return { title: t['vitals.temperature'], unit: '°C' };
      case 'spo2':
        return { title: t['vitals.oxygenSaturation'], unit: '%' };
      case 'respiratory_rate':
        return { title: t['vitals.respiratoryRate'], unit: '/min' };
      case 'blood_glucose':
        return { title: t['vitals.bloodGlucose'], unit: 'mg/dL' };
      case 'weight':
        return { title: t['vitals.weight'], unit: 'kg' };
      case 'consciousness':
        return { title: t['vitals.consciousness'], unit: '' };
      default:
        return { title: 'Vital Signs', unit: '' };
    }
  };

  const vitalInfo = getVitalInfo();

  // Handle data point press
  const handleDataPointPress = (reading: APIVitalSigns) => {
    setSelectedReading(reading);
  };

  // Handle date range change
  const handleDateRangeChange = (preset: '7d' | '30d' | '90d' | 'all') => {
    vitalsHistoryStore.setDateRangePreset(preset);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
          <Text style={styles.backText}>{t['common.back']}</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{vitalInfo.title} {t['vitals.history']}</Text>
          <Text style={styles.headerSubtitle}>
            {patient?.family_name} {patient?.given_name}
          </Text>
        </View>
        <View style={styles.headerRightContainer}>
          <ServerStatusIndicator compact />
          <LanguageToggle />
        </View>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Statistics Card(s) */}
        {vitalType === 'blood_pressure' && statistics && diastolicStats && !isLoading ? (
          <View style={styles.bpStatsContainer}>
            <Text style={styles.bpStatsHeader}>{t['vitals.bloodPressure']} {t['vitals.statistics']}</Text>
            <View style={styles.bpStatsRow}>
              {/* Systolic */}
              <View style={styles.bpStatsSection}>
                <Text style={styles.bpStatsLabel}>{t['vitals.systolic']}</Text>
                <View style={styles.bpStatsValues}>
                  <View style={styles.bpStatItem}>
                    <Text style={styles.bpStatLabel}>{t['vitals.min']}</Text>
                    <Text style={styles.bpStatValue}>{statistics.min}</Text>
                  </View>
                  <View style={styles.bpStatItem}>
                    <Text style={styles.bpStatLabel}>{t['vitals.avg']}</Text>
                    <Text style={[styles.bpStatValue, styles.bpStatValueLarge]}>{statistics.avg.toFixed(1)}</Text>
                  </View>
                  <View style={styles.bpStatItem}>
                    <Text style={styles.bpStatLabel}>{t['vitals.max']}</Text>
                    <Text style={styles.bpStatValue}>{statistics.max}</Text>
                  </View>
                </View>
              </View>

              {/* Divider */}
              <View style={styles.bpStatsDivider} />

              {/* Diastolic */}
              <View style={styles.bpStatsSection}>
                <Text style={styles.bpStatsLabel}>{t['vitals.diastolic']}</Text>
                <View style={styles.bpStatsValues}>
                  <View style={styles.bpStatItem}>
                    <Text style={styles.bpStatLabel}>{t['vitals.min']}</Text>
                    <Text style={styles.bpStatValue}>{diastolicStats.min}</Text>
                  </View>
                  <View style={styles.bpStatItem}>
                    <Text style={styles.bpStatLabel}>{t['vitals.avg']}</Text>
                    <Text style={[styles.bpStatValue, styles.bpStatValueLarge]}>{diastolicStats.avg.toFixed(1)}</Text>
                  </View>
                  <View style={styles.bpStatItem}>
                    <Text style={styles.bpStatLabel}>{t['vitals.max']}</Text>
                    <Text style={styles.bpStatValue}>{diastolicStats.max}</Text>
                  </View>
                </View>
              </View>
            </View>
            <Text style={styles.bpStatsFooter}>
              {(t['vitals.basedOnReadings'] || '').replace('{count}', statistics.count.toString())}
            </Text>
          </View>
        ) : statistics && !isLoading ? (
          <VitalStatsCard
            min={statistics.min}
            max={statistics.max}
            avg={statistics.avg}
            trend={statistics.trend}
            unit={vitalInfo.unit}
            count={statistics.count}
            label={`${vitalInfo.title} Statistics`}
          />
        ) : null}

        {/* Date Range Selector */}
        <DateRangeSelector
          selectedPreset={vitalsHistoryStore.selectedPreset}
          onPresetChange={handleDateRangeChange}
        />

        {/* Loading State */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>{t['vitals.loading']}</Text>
          </View>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                vitalsHistoryStore.loadHistory(patientId, vitalType);
                vitalsHistoryStore.loadStatistics(patientId, vitalType);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.retryButtonText}>{t['vitals.retry']}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Graph */}
        {!isLoading && !error && chartData.length > 0 && (
          <VitalDetailedGraph
            data={chartData}
            vitalType={vitalType}
            patientAge={patient?.age}
            patientGender={patient?.gender}
            onDataPointPress={handleDataPointPress}
            title={`${vitalInfo.title} ${t['vitals.trend']}`}
            t={t}
            dateRangePreset={vitalsHistoryStore.selectedPreset}
          />
        )}

        {/* Data Table */}
        {!isLoading && !error && vitalsHistory && vitalsHistory.length > 0 && (
          <View style={styles.dataTableContainer}>
            <Text style={styles.dataTableTitle}>{t['vitals.readingDetails']} ({(t['vitals.totalReadings'] || '').replace('{count}', vitalsHistory.length.toString())})</Text>

            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.colDateTime]}>{t['vitals.dateTime']}</Text>
              <Text style={[styles.tableHeaderText, styles.colValue]}>{t['vitals.value']}</Text>
              <Text style={[styles.tableHeaderText, styles.colMethod]}>{t['vitals.method']}</Text>
              <Text style={[styles.tableHeaderText, styles.colRecordedBy]}>{t['vitals.recordedBy']}</Text>
            </View>

            {/* Table Rows */}
            {vitalsHistory.map((reading, index) => {
              // Check if the specific vital type has a value
              let value: string | number | null = null;

              if (vitalType === 'heart_rate') {
                value = reading.heart_rate;
              } else if (vitalType === 'blood_pressure') {
                // Only show BP if both systolic and diastolic are present
                if (reading.blood_pressure_systolic != null && reading.blood_pressure_diastolic != null) {
                  value = `${reading.blood_pressure_systolic}/${reading.blood_pressure_diastolic}`;
                }
              } else if (vitalType === 'temperature') {
                value = reading.temperature_celsius;
              } else if (vitalType === 'spo2') {
                value = reading.oxygen_saturation;
              }

              if (value == null) return null;

              return (
                <TouchableOpacity
                  key={reading.vital_sign_id || index}
                  style={[styles.tableRow, index % 2 === 0 && styles.tableRowEven]}
                  onPress={() => setSelectedReading(reading)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tableCell, styles.colDateTime]}>
                    {new Date(reading.measured_at).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                  <Text style={[styles.tableCell, styles.colValue, styles.tableCellBold]}>
                    {value} {vitalInfo.unit}
                  </Text>
                  <Text style={[styles.tableCell, styles.colMethod]}>
                    {reading.input_method === 'iot_sensor' ? t['vitals.ble'] :
                     reading.input_method === 'voice' ? t['vitals.voice'] : t['vitals.manual']}
                  </Text>
                  <Text style={[styles.tableCell, styles.colRecordedBy]} numberOfLines={1}>
                    {reading.recorded_by_name || 'N/A'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Empty State */}
        {!isLoading && !error && chartData.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>{t['vitals.noData']}</Text>
            <Text style={styles.emptyText}>
              {(t['vitals.noDataDescription'] || '').replace('{vital}', vitalInfo.title.toLowerCase())}
            </Text>
            <Text style={styles.emptyHint}>
              {t['vitals.noDataHint']}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Reading Detail Modal */}
      {selectedReading && (
        <Modal
          visible={true}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedReading(null)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setSelectedReading(null)}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{vitalInfo.title} {t['vitals.reading']}</Text>

              <View style={styles.modalBody}>
                {/* Vital Value Display */}
                {(() => {
                  let value, unit;
                  if (vitalType === 'heart_rate' && selectedReading.heart_rate) {
                    value = selectedReading.heart_rate;
                    unit = 'bpm';
                  } else if (vitalType === 'blood_pressure' && selectedReading.blood_pressure_systolic) {
                    value = `${selectedReading.blood_pressure_systolic}/${selectedReading.blood_pressure_diastolic}`;
                    unit = 'mmHg';
                  } else if (vitalType === 'temperature' && selectedReading.temperature_celsius) {
                    value = selectedReading.temperature_celsius;
                    unit = '°C';
                  } else if (vitalType === 'spo2' && selectedReading.oxygen_saturation) {
                    value = selectedReading.oxygen_saturation;
                    unit = '%';
                  } else if (vitalType === 'respiratory_rate' && selectedReading.respiratory_rate) {
                    value = selectedReading.respiratory_rate;
                    unit = '/min';
                  }

                  if (value != null) {
                    return (
                      <View style={styles.modalValueContainer}>
                        <Text style={styles.modalValue}>
                          {value}{' '}
                          <Text style={styles.modalUnit}>{unit}</Text>
                        </Text>
                      </View>
                    );
                  }
                  return null;
                })()}

                {/* Details */}
                <View style={styles.modalDetails}>
                  <View style={styles.modalDetailRow}>
                    <Text style={styles.modalDetailLabel}>{t['vitals.dateTime']}:</Text>
                    <Text style={styles.modalDetailValue}>
                      {new Date(selectedReading.measured_at).toLocaleString()}
                    </Text>
                  </View>

                  {selectedReading.recorded_by_name && (
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.modalDetailLabel}>{t['vitals.recordedBy']}:</Text>
                      <Text style={styles.modalDetailValue}>
                        {selectedReading.recorded_by_name}
                      </Text>
                    </View>
                  )}

                  <View style={styles.modalDetailRow}>
                    <Text style={styles.modalDetailLabel}>{t['vitals.method']}:</Text>
                    <Text style={styles.modalDetailValue}>
                      {selectedReading.input_method === 'iot_sensor'
                        ? t['vitals.bleDevice']
                        : selectedReading.input_method === 'voice'
                        ? t['vitals.voice']
                        : t['vitals.manual']}
                    </Text>
                  </View>

                  {selectedReading.device_id && (
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.modalDetailLabel}>{t['vitals.device']}:</Text>
                      <Text style={styles.modalDetailValue}>
                        {selectedReading.device_id}
                      </Text>
                    </View>
                  )}

                  {/* Show BP if available */}
                  {selectedReading.blood_pressure_systolic && (
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.modalDetailLabel}>{t['vitals.bloodPressure']}:</Text>
                      <Text style={styles.modalDetailValue}>
                        {selectedReading.blood_pressure_systolic}/
                        {selectedReading.blood_pressure_diastolic} mmHg
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setSelectedReading(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCloseButtonText}>{t['vitals.close']}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    padding: SPACING.sm,
  },
  backText: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '600',
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: SPACING.xl,
  },
  loadingContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  errorContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.error,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  emptyHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  modalBody: {
    marginBottom: SPACING.lg,
  },
  modalValueContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
    marginBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalValue: {
    fontSize: 48,
    fontWeight: '700',
    color: COLORS.primary,
  },
  modalUnit: {
    fontSize: 24,
    fontWeight: '400',
    color: COLORS.textSecondary,
  },
  modalDetails: {
    gap: SPACING.sm,
  },
  modalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
  },
  modalDetailLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  modalDetailValue: {
    fontSize: 14,
    color: COLORS.text,
  },
  modalCloseButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // BP Stats Styles
  bpStatsContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bpStatsHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  bpStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bpStatsSection: {
    flex: 1,
    alignItems: 'center',
  },
  bpStatsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  bpStatsValues: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  bpStatItem: {
    alignItems: 'center',
  },
  bpStatLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  bpStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  bpStatValueLarge: {
    fontSize: 24,
    color: COLORS.primary,
  },
  bpStatsDivider: {
    width: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.md,
  },
  bpStatsFooter: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    fontStyle: 'italic',
  },
  // Data Table Styles
  dataTableContainer: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    marginBottom: SPACING.xl,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dataTableTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    padding: SPACING.md,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary + '10',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tableRowEven: {
    backgroundColor: COLORS.background,
  },
  tableCell: {
    fontSize: 13,
    color: COLORS.text,
  },
  tableCellBold: {
    fontWeight: '600',
    color: COLORS.primary,
  },
  // Column widths
  colDateTime: {
    flex: 2.5,
  },
  colValue: {
    flex: 1.5,
  },
  colMethod: {
    flex: 1,
  },
  colRecordedBy: {
    flex: 2,
  },
});
