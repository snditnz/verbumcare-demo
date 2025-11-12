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
  t: Record<string, string>; // Translation object
  dateRangePreset?: '7d' | '30d' | '90d' | 'all';
}

/**
 * Format date label based on date range preset
 */
const formatDateLabel = (date: Date, preset: '7d' | '30d' | '90d' | 'all', index: number, totalDays: number): string => {
  const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
  const month = date.getMonth() + 1;
  const day = date.getDate();

  if (preset === '7d') {
    // Show day of week and date for 7-day view
    return `${dayOfWeek}\n${month}/${day}`;
  } else if (preset === '30d') {
    // Show date for every day, but emphasize week starts
    const isWeekStart = date.getDay() === 0; // Sunday
    if (isWeekStart) {
      return `${month}/${day}`;
    }
    // Show small markers for other days
    return `${day}`;
  } else {
    // For 90d and 'all', show abbreviated date
    return `${month}/${day}`;
  }
};

/**
 * Check if this day should be a week marker (Sunday)
 */
const isWeekMarker = (date: Date): boolean => {
  return date.getDay() === 0; // Sunday
};

/**
 * Get the appropriate unit suffix for a vital type
 */
const getVitalUnitSuffix = (vitalType: string): string => {
  switch (vitalType) {
    case 'heart_rate':
      return ' bpm';
    case 'blood_pressure':
      return ' mmHg';
    case 'temperature':
      return '°C';
    case 'spo2':
      return '%';
    case 'respiratory_rate':
      return ' /min';
    default:
      return '';
  }
};

/**
 * Get the color for a vital value based on clinical thresholds
 */
const getVitalColor = (value: number, thresholds: any): string => {
  if (value >= thresholds.normalMin && value <= thresholds.normalMax) {
    return 'rgba(76, 175, 80, 0.8)'; // Green - Normal
  } else if (value >= thresholds.warningMin && value <= thresholds.warningMax) {
    return 'rgba(255, 193, 7, 0.8)'; // Yellow - Warning
  } else {
    return 'rgba(244, 67, 54, 0.8)'; // Red - Critical
  }
};

/**
 * Get clinical thresholds for any vital type
 */
const getVitalThresholds = (vitalType: string, gender: 'male' | 'female' = 'male') => {
  switch (vitalType) {
    case 'heart_rate':
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

    case 'blood_pressure':
      return {
        normalMin: 90,
        normalMax: 140,
        warningMin: 80,
        warningMax: 160,
        criticalMin: 0,
        criticalMax: 200,
      };

    case 'temperature':
      return {
        normalMin: 36.0,
        normalMax: 37.5,
        warningMin: 35.0,
        warningMax: 38.5,
        criticalMin: 32.0,
        criticalMax: 42.0,
      };

    case 'spo2':
      return {
        normalMin: 95,
        normalMax: 100,
        warningMin: 90,
        warningMax: 100,
        criticalMin: 0,
        criticalMax: 100,
      };

    case 'respiratory_rate':
      return {
        normalMin: 12,
        normalMax: 20,
        warningMin: 8,
        warningMax: 25,
        criticalMin: 0,
        criticalMax: 60,
      };

    default:
      return {
        normalMin: 0,
        normalMax: 100,
        warningMin: 0,
        warningMax: 100,
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
  t,
  dateRangePreset = '7d',
}) => {
  console.log('[VitalDetailedGraph] Received data points:', data?.length, 'for vitalType:', vitalType);

  if (!data || data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{t['vitals.noDataForPeriod']}</Text>
      </View>
    );
  }

  // Get thresholds based on vital type
  const thresholds = getVitalThresholds(vitalType, patientGender);

  // Generate full date range for the selected preset
  const generateFullDateRange = () => {
    const today = new Date();
    const dates: Date[] = [];

    let daysToGenerate = 7;
    if (dateRangePreset === '30d') daysToGenerate = 30;
    else if (dateRangePreset === '90d') daysToGenerate = 90;
    else if (dateRangePreset === 'all') {
      // For 'all', we'll use the data range instead
      if (data.length === 0) return dates;
      const minDate = new Date(Math.min(...data.map(d => d.x.getTime())));
      const maxDate = new Date(Math.max(...data.map(d => d.x.getTime())));
      const daysDiff = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      daysToGenerate = daysDiff;

      for (let i = 0; i < daysToGenerate; i++) {
        const date = new Date(minDate);
        date.setDate(date.getDate() + i);
        dates.push(new Date(date.getFullYear(), date.getMonth(), date.getDate()));
      }
      return dates;
    }

    for (let i = daysToGenerate - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      dates.push(new Date(date.getFullYear(), date.getMonth(), date.getDate()));
    }

    return dates;
  };

  const fullDateRange = generateFullDateRange();

  // Create a day-grouped structure for consistent sizing
  const dayGroupedData = (() => {
    // Create a map of readings by date
    const readingsByDate: Map<string, typeof data> = new Map();
    data
      .filter(point => point.y != null && !isNaN(point.y) && isFinite(point.y))
      .forEach(point => {
        const date = new Date(point.x);
        const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
        if (!readingsByDate.has(dayKey)) {
          readingsByDate.set(dayKey, []);
        }
        readingsByDate.get(dayKey)!.push(point);
      });

    // Generate day groups for all days in the range
    return fullDateRange.map(date => {
      const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const dayReadings = readingsByDate.get(dayKey) || [];

      if (dateRangePreset === '7d' && dayReadings.length > 0) {
        // For 7d view, keep individual readings
        return {
          date: date,
          readings: dayReadings.sort((a, b) => a.x.getTime() - b.x.getTime()).map(point => ({
            date: point.x,
            value: point.y,
            reading: point.reading,
          })),
          isEmpty: false,
        };
      } else if (dayReadings.length > 0) {
        // For other views, aggregate to daily average
        const sum = dayReadings.reduce((acc, point) => acc + point.y, 0);
        const avg = sum / dayReadings.length;
        return {
          date: date,
          readings: [{
            date: date,
            value: avg,
            reading: null,
          }],
          count: dayReadings.length,
          isEmpty: false,
        };
      } else {
        // Empty day
        return {
          date: date,
          readings: [],
          isEmpty: true,
        };
      }
    });
  })();

  // If no data, show empty state
  if (dayGroupedData.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{t['vitals.noDataForPeriod']}</Text>
      </View>
    );
  }

  // Calculate min/max for scaling from all readings
  const allValues: number[] = [];
  dayGroupedData.forEach(dayGroup => {
    dayGroup.readings.forEach(reading => {
      if (reading.value != null && !isNaN(reading.value) && isFinite(reading.value)) {
        allValues.push(reading.value);
      }
    });
  });
  const minValue = allValues.length > 0 ? Math.min(...allValues, thresholds.normalMin - 5) : thresholds.normalMin - 5;
  const maxValue = allValues.length > 0 ? Math.max(...allValues, thresholds.normalMax + 5) : thresholds.normalMax + 5;
  const valueRange = maxValue - minValue || 1; // Prevent division by zero

  return (
    <View style={styles.container}>
      {/* Title */}
      <Text style={styles.title}>{title}</Text>

      {/* Clinical Zones Legend */}
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: COLORS.success }]} />
          <Text style={styles.legendText}>
            {t['vitals.normal']} ({thresholds.normalMin}-{thresholds.normalMax}{getVitalUnitSuffix(vitalType)})
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: COLORS.warning }]} />
          <Text style={styles.legendText}>{t['vitals.warning']}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: COLORS.error }]} />
          <Text style={styles.legendText}>{t['vitals.critical']}</Text>
        </View>
      </View>

      {/* Custom Bar Chart with colored bars */}
      <View style={styles.customChart}>
        <View style={styles.chartContent}>
          {/* Y-axis labels */}
          <View style={styles.yAxis}>
            <Text style={styles.yAxisLabel}>{maxValue.toFixed(1)}</Text>
            <Text style={styles.yAxisLabel}>{((maxValue + minValue) / 2).toFixed(1)}</Text>
            <Text style={styles.yAxisLabel}>{minValue.toFixed(1)}</Text>
          </View>

          {/* Bars container - each day gets equal flex space */}
          <View style={styles.barsRow}>
            {dayGroupedData.map((dayGroup, dayIndex) => {
              const date = dayGroup.date;
              const dayLabel = `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()]}\n${date.getMonth() + 1}/${date.getDate()}`;

              return (
                <View
                  key={`day-${dayIndex}`}
                  style={styles.dayColumn}
                >
                  {/* Day container with equal flex */}
                  <View style={styles.dayBarsContainer}>
                    {dayGroup.isEmpty ? (
                      // Empty day placeholder
                      <View style={styles.emptyDayPlaceholder}>
                        <View style={styles.emptyBar} />
                      </View>
                    ) : (
                      // Render bars for this day
                      dayGroup.readings.map((reading, readingIndex) => {
                        // Check if this is a blood pressure reading
                        const isBP = vitalType === 'blood_pressure' &&
                                    reading.reading?.blood_pressure_systolic != null &&
                                    reading.reading?.blood_pressure_diastolic != null;

                        if (isBP) {
                          // For BP: render a bar from diastolic (bottom) to systolic (top)
                          const systolic = reading.reading.blood_pressure_systolic!;
                          const diastolic = reading.reading.blood_pressure_diastolic!;

                          const barBottom = ((diastolic - minValue) / valueRange) * 100;
                          const barTop = ((systolic - minValue) / valueRange) * 100;
                          const barHeight = Math.max(barTop - barBottom, 2);

                          // Determine color based on systolic value
                          const isNormal = systolic >= thresholds.normalMin && systolic <= thresholds.normalMax;
                          const isWarning = systolic >= thresholds.warningMin && systolic <= thresholds.warningMax;

                          return (
                            <View
                              key={`reading-${readingIndex}`}
                              style={styles.barInDay}
                            >
                              <Text style={styles.valueLabel}>{systolic}/{diastolic}</Text>
                              <View style={styles.barContainer}>
                                <View
                                  style={[
                                    styles.barFill,
                                    {
                                      height: `${barHeight}%`,
                                      bottom: `${barBottom}%`,
                                      position: 'absolute',
                                      width: '100%',
                                    },
                                    isNormal ? styles.barNormal : isWarning ? styles.barWarning : styles.barCritical
                                  ]}
                                />
                              </View>
                            </View>
                          );
                        } else {
                          // For non-BP vitals: render regular bar from bottom
                          const barHeight = Math.max(((reading.value - minValue) / valueRange) * 100, 2);
                          const isNormal = reading.value >= thresholds.normalMin && reading.value <= thresholds.normalMax;
                          const isWarning = reading.value >= thresholds.warningMin && reading.value <= thresholds.warningMax;

                          return (
                            <View
                              key={`reading-${readingIndex}`}
                              style={styles.barInDay}
                            >
                              <Text style={styles.valueLabel}>{reading.value.toFixed(1)}</Text>
                              <View style={styles.barContainer}>
                                <View
                                  style={[
                                    styles.barFill,
                                    { height: `${barHeight}%` },
                                    isNormal ? styles.barNormal : isWarning ? styles.barWarning : styles.barCritical
                                  ]}
                                />
                              </View>
                            </View>
                          );
                        }
                      })
                    )}
                  </View>

                  {/* Day label below */}
                  <Text style={styles.dayLabel}>{dayLabel}</Text>

                  {/* Show count badge for aggregated views */}
                  {!dayGroup.isEmpty && (dayGroup as any).count > 1 && (
                    <Text style={styles.countBadge}>×{(dayGroup as any).count}</Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      </View>

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
      <Text style={styles.instructions}>{t['vitals.tapDataPoint']}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: SPACING.md,
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
  customChart: {
    marginVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.sm,
  },
  chartContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: SPACING.sm,
  },
  yAxis: {
    height: 120,
    width: 40,
    justifyContent: 'space-between',
    marginRight: SPACING.sm,
    paddingBottom: 20,
  },
  yAxisLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'right',
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flex: 1,
  },
  dayColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 2,
  },
  dayBarsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 100,
    width: '100%',
    gap: 2,
  },
  barInDay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 20,
    maxWidth: 50,
  },
  emptyDayPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.3,
  },
  dayLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 12,
  },
  barWrapper: {
    alignItems: 'center',
    marginHorizontal: 6,
    minWidth: 40,
  },
  dayStartWrapper: {
    marginLeft: 16,
    borderLeftWidth: 1,
    borderLeftColor: COLORS.border,
    paddingLeft: 8,
  },
  daySeparatorLine: {
    position: 'absolute',
    left: -9,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: COLORS.border,
  },
  barContainer: {
    height: '100%',
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  barFill: {
    width: '100%',
    borderRadius: 4,
    minHeight: 2,
  },
  barNormal: {
    backgroundColor: 'rgba(76, 175, 80, 0.8)',
  },
  barWarning: {
    backgroundColor: 'rgba(255, 193, 7, 0.8)',
  },
  barCritical: {
    backgroundColor: 'rgba(244, 67, 54, 0.8)',
  },
  valueLabel: {
    fontSize: 10,
    color: COLORS.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  countBadge: {
    fontSize: 9,
    color: COLORS.primary,
    marginTop: 2,
    fontWeight: '600',
  },
  emptyBarWrapper: {
    opacity: 0.3,
  },
  emptyBar: {
    width: '100%',
    height: 2,
    backgroundColor: COLORS.border,
    borderRadius: 4,
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
