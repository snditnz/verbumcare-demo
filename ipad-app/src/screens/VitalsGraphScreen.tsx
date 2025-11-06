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
import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SPACING } from '@/constants/theme';
import { useVitalsHistoryStore } from '@/stores/vitalsHistoryStore';
import { useAssessmentStore } from '@/stores/assessmentStore';
import { VitalDetailedGraph } from '@/components/vitals/VitalDetailedGraph';
import { VitalStatsCard } from '@/components/vitals/VitalStatsCard';
import { DateRangeSelector } from '@/components/vitals/DateRangeSelector';
import { APIVitalSigns } from '@/models/api';

type RootStackParamList = {
  VitalsGraph: {
    patientId: string;
    vitalType?: 'heart_rate' | 'blood_pressure' | 'temperature' | 'spo2';
  };
};

type VitalsGraphScreenRouteProp = RouteProp<RootStackParamList, 'VitalsGraph'>;
type VitalsGraphScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'VitalsGraph'>;

export const VitalsGraphScreen: React.FC = () => {
  const route = useRoute<VitalsGraphScreenRouteProp>();
  const navigation = useNavigation<VitalsGraphScreenNavigationProp>();
  const { patientId, vitalType = 'heart_rate' } = route.params;

  // Stores
  const vitalsHistory = useVitalsHistoryStore();
  const { currentPatient } = useAssessmentStore();

  // Local state
  const [selectedReading, setSelectedReading] = useState<APIVitalSigns | null>(null);

  // Patient should match the patientId parameter
  const patient = currentPatient?.patient_id === patientId ? currentPatient : null;

  // Load data on mount and when date range changes
  useEffect(() => {
    vitalsHistory.loadHistory(patientId, vitalType);
    vitalsHistory.loadStatistics(patientId, vitalType);
  }, [patientId, vitalType]);

  // Reload data when screen gains focus (e.g., after adding new vitals)
  useFocusEffect(
    React.useCallback(() => {
      console.log('[VitalsGraph] Screen focused, reloading data...');
      vitalsHistory.loadHistory(patientId, vitalType);
      vitalsHistory.loadStatistics(patientId, vitalType);
    }, [patientId, vitalType])
  );

  // Get chart data
  const chartData = vitalsHistory.getChartData();

  // Get vital type display info
  const getVitalInfo = () => {
    switch (vitalType) {
      case 'heart_rate':
        return { title: 'Heart Rate', unit: 'bpm' };
      case 'blood_pressure':
        return { title: 'Blood Pressure', unit: 'mmHg' };
      case 'temperature':
        return { title: 'Temperature', unit: '°C' };
      case 'spo2':
        return { title: 'Oxygen Saturation', unit: '%' };
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
    vitalsHistory.setDateRangePreset(preset);
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
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{vitalInfo.title} History</Text>
          <Text style={styles.headerSubtitle}>
            {patient?.family_name} {patient?.given_name}
          </Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Statistics Card */}
        {vitalsHistory.statistics && !vitalsHistory.isLoading && (
          <VitalStatsCard
            min={vitalsHistory.statistics.min}
            max={vitalsHistory.statistics.max}
            avg={vitalsHistory.statistics.avg}
            trend={vitalsHistory.statistics.trend}
            unit={vitalInfo.unit}
            count={vitalsHistory.statistics.count}
            label={`${vitalInfo.title} Statistics`}
          />
        )}

        {/* Date Range Selector */}
        <DateRangeSelector
          selectedPreset={vitalsHistory.selectedPreset}
          onPresetChange={handleDateRangeChange}
        />

        {/* Loading State */}
        {vitalsHistory.isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading vitals history...</Text>
          </View>
        )}

        {/* Error State */}
        {vitalsHistory.error && !vitalsHistory.isLoading && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{vitalsHistory.error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                vitalsHistory.loadHistory(patientId, vitalType);
                vitalsHistory.loadStatistics(patientId, vitalType);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Graph */}
        {!vitalsHistory.isLoading && !vitalsHistory.error && chartData.length > 0 && (
          <VitalDetailedGraph
            data={chartData}
            vitalType={vitalType}
            patientAge={patient?.age}
            patientGender={patient?.gender}
            onDataPointPress={handleDataPointPress}
            title={`${vitalInfo.title} Trend`}
          />
        )}

        {/* Data Table */}
        {!vitalsHistory.isLoading && !vitalsHistory.error && vitalsHistory.vitalsHistory.length > 0 && (
          <View style={styles.dataTableContainer}>
            <Text style={styles.dataTableTitle}>Reading Details ({vitalsHistory.vitalsHistory.length} total)</Text>

            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.colDateTime]}>Date & Time</Text>
              <Text style={[styles.tableHeaderText, styles.colValue]}>Value</Text>
              <Text style={[styles.tableHeaderText, styles.colMethod]}>Method</Text>
              <Text style={[styles.tableHeaderText, styles.colRecordedBy]}>Recorded By</Text>
            </View>

            {/* Table Rows */}
            {vitalsHistory.vitalsHistory.map((reading, index) => {
              const value = vitalType === 'heart_rate' ? reading.heart_rate :
                           vitalType === 'blood_pressure' ? `${reading.blood_pressure_systolic}/${reading.blood_pressure_diastolic}` :
                           vitalType === 'temperature' ? reading.temperature_celsius :
                           vitalType === 'spo2' ? reading.oxygen_saturation : null;

              if (!value) return null;

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
                    {reading.input_method === 'iot_sensor' ? 'BLE' :
                     reading.input_method === 'voice' ? 'Voice' : 'Manual'}
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
        {!vitalsHistory.isLoading && !vitalsHistory.error && chartData.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>No Data Available</Text>
            <Text style={styles.emptyText}>
              No {vitalInfo.title.toLowerCase()} readings found for this time period.
            </Text>
            <Text style={styles.emptyHint}>
              Try selecting a different date range or capture new vitals.
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
              <Text style={styles.modalTitle}>{vitalInfo.title} Reading</Text>

              <View style={styles.modalBody}>
                {/* Heart Rate Value */}
                {selectedReading.heart_rate && (
                  <View style={styles.modalValueContainer}>
                    <Text style={styles.modalValue}>
                      {selectedReading.heart_rate}{' '}
                      <Text style={styles.modalUnit}>bpm</Text>
                    </Text>
                  </View>
                )}

                {/* Details */}
                <View style={styles.modalDetails}>
                  <View style={styles.modalDetailRow}>
                    <Text style={styles.modalDetailLabel}>Date & Time:</Text>
                    <Text style={styles.modalDetailValue}>
                      {new Date(selectedReading.measured_at).toLocaleString()}
                    </Text>
                  </View>

                  {selectedReading.recorded_by_name && (
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.modalDetailLabel}>Recorded by:</Text>
                      <Text style={styles.modalDetailValue}>
                        {selectedReading.recorded_by_name}
                      </Text>
                    </View>
                  )}

                  <View style={styles.modalDetailRow}>
                    <Text style={styles.modalDetailLabel}>Method:</Text>
                    <Text style={styles.modalDetailValue}>
                      {selectedReading.input_method === 'iot_sensor'
                        ? 'BLE Device'
                        : selectedReading.input_method === 'voice'
                        ? 'Voice'
                        : 'Manual'}
                    </Text>
                  </View>

                  {selectedReading.device_id && (
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.modalDetailLabel}>Device:</Text>
                      <Text style={styles.modalDetailValue}>
                        {selectedReading.device_id}
                      </Text>
                    </View>
                  )}

                  {/* Show BP if available */}
                  {selectedReading.blood_pressure_systolic && (
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.modalDetailLabel}>Blood Pressure:</Text>
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
                <Text style={styles.modalCloseButtonText}>Close</Text>
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
    padding: SPACING.sm,
  },
  backButtonText: {
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
