/**
 * VitalDetailedGraph Component
 *
 * Displays a detailed line graph for a specific vital sign with clinical zones.
 * Currently optimized for heart rate visualization with gender-specific thresholds.
 *
 * Features:
 * - Line chart with time-series data
 * - Clinical zones (green/yellow/red background)
 * - Interactive data point selection
 * - Responsive layout for iPad landscape
 *
 * @example
 * <VitalDetailedGraph
 *   data={chartData}
 *   vitalType="heart_rate"
 *   patientAge={68}
 *   patientGender="male"
 *   onDataPointPress={(reading) => showDetailModal(reading)}
 * />
 */

import React from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { COLORS, SPACING } from '@/constants/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - (SPACING.xl * 2);

interface VitalReading {
  vital_sign_id: string;
  measured_at: string;
  heart_rate?: number;
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  patient_id: string;
  recorded_by?: string;
  recorded_by_name?: string;
  input_method?: string;
  device_id?: string;
}

interface ChartDataPoint {
  x: Date;
  y: number;
  reading: VitalReading;
}

interface Props {
  data: ChartDataPoint[];
  vitalType: 'heart_rate' | 'blood_pressure' | 'temperature' | 'spo2';
  patientAge?: number;
  patientGender?: 'male' | 'female';
  onDataPointPress?: (reading: VitalReading) => void;
  title?: string;
}

/**
 * Get clinical thresholds for heart rate based on gender
 */
const getHeartRateThresholds = (gender: 'male' | 'female' = 'male') => {
  if (gender === 'male') {
    return {
      normalMin: 60,
      normalMax: 90,
      warningMin: 45,
      warningMax: 105,
      criticalMin: 0,
      criticalMax: 200,
    };
  } else {
    return {
      normalMin: 65,
      normalMax: 95,
      warningMin: 50,
      warningMax: 110,
      criticalMin: 0,
      criticalMax: 200,
    };
  }
};

export const VitalDetailedGraph: React.FC<Props> = ({
  data,
  vitalType,
  patientAge,
  patientGender = 'male',
  onDataPointPress,
  title = 'Heart Rate',
}) => {
  if (!data || data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No data available for this time period</Text>
      </View>
    );
  }

  // Prepare data for LineChart
  const isBP = vitalType === 'blood_pressure';

  const chartData = {
    labels: data.map((point, index) => {
      // Show date label for every 2nd point to avoid overcrowding
      if (index % 2 === 0) {
        const date = new Date(point.x);
        return `${date.getMonth() + 1}/${date.getDate()}`;
      }
      return '';
    }),
    datasets: isBP ? [
      {
        data: data.map(point => point.y), // Systolic
        color: (opacity = 1) => `rgba(255, 87, 34, ${opacity})`, // Deep Orange for systolic
        strokeWidth: 2,
      },
      {
        data: data.map(point => point.reading.blood_pressure_diastolic || 0), // Diastolic
        color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`, // Blue for diastolic
        strokeWidth: 2,
      },
    ] : [
      {
        data: data.map(point => point.y),
        color: (opacity = 1) => `rgba(255, 87, 34, ${opacity})`, // Deep Orange
        strokeWidth: 2,
      },
    ],
    legend: isBP ? ['Systolic', 'Diastolic'] : undefined,
  };

  // Get thresholds based on vital type
  const thresholds = vitalType === 'blood_pressure'
    ? { normalMin: 90, normalMax: 140, warningMin: 80, warningMax: 160, criticalMin: 0, criticalMax: 200 }
    : getHeartRateThresholds(patientGender);

  // Calculate Y-axis range with padding
  const allValues = vitalType === 'blood_pressure'
    ? data.flatMap(point => [point.y, point.reading.blood_pressure_diastolic || 0])
    : data.map(point => point.y);
  const minValue = Math.min(...allValues, thresholds.normalMin - 10);
  const maxValue = Math.max(...allValues, thresholds.normalMax + 10);

  return (
    <View style={styles.container}>
      {/* Title */}
      <Text style={styles.title}>{title}</Text>

      {/* Clinical Zones Legend */}
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: COLORS.success }]} />
          <Text style={styles.legendText}>
            Normal ({thresholds.normalMin}-{thresholds.normalMax} {vitalType === 'blood_pressure' ? 'mmHg' : 'bpm'})
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: COLORS.warning }]} />
          <Text style={styles.legendText}>Warning</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: COLORS.error }]} />
          <Text style={styles.legendText}>Critical</Text>
        </View>
      </View>

      {/* Chart */}
      <LineChart
        data={chartData}
        width={CHART_WIDTH}
        height={150}
        yAxisSuffix={vitalType === 'blood_pressure' ? '' : ' bpm'}
        yAxisInterval={1}
        chartConfig={{
          backgroundColor: COLORS.surface,
          backgroundGradientFrom: COLORS.surface,
          backgroundGradientTo: COLORS.surface,
          decimalPlaces: 0,
          color: (opacity = 1) => `rgba(255, 87, 34, ${opacity})`,
          labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
          style: {
            borderRadius: 16,
          },
          propsForDots: {
            r: '5',
            strokeWidth: '2',
            stroke: COLORS.primary,
          },
          propsForBackgroundLines: {
            strokeDasharray: '', // solid line
            stroke: COLORS.border,
            strokeWidth: 1,
          },
        }}
        bezier
        style={styles.chart}
        onDataPointClick={({ index }) => {
          if (onDataPointPress && data[index]) {
            onDataPointPress(data[index].reading);
          }
        }}
        fromZero={false}
        segments={5}
      />

      {/* Zone Indicators (below chart) */}
      <View style={styles.zoneIndicatorsContainer}>
        <View style={styles.zoneIndicator}>
          <View style={[styles.zoneBar, styles.criticalZone]} />
          <Text style={styles.zoneLabel}>&lt; {thresholds.warningMin}</Text>
        </View>
        <View style={styles.zoneIndicator}>
          <View style={[styles.zoneBar, styles.warningZone]} />
          <Text style={styles.zoneLabel}>{thresholds.warningMin}-{thresholds.normalMin - 1}</Text>
        </View>
        <View style={styles.zoneIndicator}>
          <View style={[styles.zoneBar, styles.normalZone]} />
          <Text style={styles.zoneLabel}>{thresholds.normalMin}-{thresholds.normalMax}</Text>
        </View>
        <View style={styles.zoneIndicator}>
          <View style={[styles.zoneBar, styles.warningZone]} />
          <Text style={styles.zoneLabel}>{thresholds.normalMax + 1}-{thresholds.warningMax}</Text>
        </View>
        <View style={styles.zoneIndicator}>
          <View style={[styles.zoneBar, styles.criticalZone]} />
          <Text style={styles.zoneLabel}>&gt; {thresholds.warningMax}</Text>
        </View>
      </View>

      {/* Instructions */}
      <Text style={styles.instructions}>Tap any data point to see details</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
  },
  emptyContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: SPACING.xs,
  },
  legendText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  chart: {
    marginVertical: SPACING.md,
    borderRadius: 16,
  },
  zoneIndicatorsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  zoneIndicator: {
    alignItems: 'center',
  },
  zoneBar: {
    width: 40,
    height: 8,
    borderRadius: 4,
    marginBottom: SPACING.xs,
  },
  normalZone: {
    backgroundColor: COLORS.success,
  },
  warningZone: {
    backgroundColor: COLORS.warning,
  },
  criticalZone: {
    backgroundColor: COLORS.error,
  },
  zoneLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  instructions: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.md,
    fontStyle: 'italic',
  },
});
