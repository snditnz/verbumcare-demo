import { create } from 'zustand';
import { APIVitalSigns } from '@models/api';
import { apiService } from '@services/api';

/**
 * Chart data point for vitals visualization
 */
export interface VitalChartDataPoint {
  x: Date;
  y: number;
  reading: APIVitalSigns;
}

/**
 * Statistics for a vital type over a date range
 */
export interface VitalStatistics {
  vital_type: string;
  min: number;
  max: number;
  avg: number;
  stddev: number | null;
  count: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  trend_data: {
    first_half_avg: number | null;
    second_half_avg: number | null;
  };
  date_range: {
    start: string;
    end: string;
  };
}

/**
 * Date range preset
 */
export type DateRangePreset = '7d' | '30d' | '90d' | 'all';

interface VitalsHistoryStore {
  // State
  vitalsHistory: APIVitalSigns[];
  statistics: VitalStatistics | null;
  isLoading: boolean;
  error: string | null;

  // Date range
  dateRange: {
    start: Date;
    end: Date;
  };
  selectedPreset: DateRangePreset;

  // Current patient and vital type
  currentPatientId: string | null;
  currentVitalType: string;

  // Actions
  loadHistory: (patientId: string, vitalType?: string) => Promise<void>;
  loadStatistics: (patientId: string, vitalType?: string) => Promise<void>;
  setDateRange: (start: Date, end: Date) => void;
  setDateRangePreset: (preset: DateRangePreset) => void;
  setVitalType: (vitalType: string) => void;
  clearError: () => void;
  clearStore: () => void;

  // Computed
  getChartData: () => VitalChartDataPoint[];
}

/**
 * Calculate date range from preset
 */
const getDateRangeFromPreset = (preset: DateRangePreset): { start: Date; end: Date } => {
  const end = new Date();
  const start = new Date();

  switch (preset) {
    case '7d':
      start.setDate(start.getDate() - 7);
      break;
    case '30d':
      start.setDate(start.getDate() - 30);
      break;
    case '90d':
      start.setDate(start.getDate() - 90);
      break;
    case 'all':
      start.setFullYear(2000, 0, 1); // Far past
      break;
  }

  return { start, end };
};

/**
 * Extract vital value from reading based on vital type
 */
const extractVitalValue = (reading: APIVitalSigns, vitalType: string): number | null => {
  let value: any = null;

  switch (vitalType) {
    case 'hr':
    case 'heart_rate':
      value = reading.heart_rate;
      break;
    case 'blood_pressure':
      // For BP graph, use systolic as the primary value
      value = reading.blood_pressure_systolic;
      break;
    case 'bp_systolic':
      value = reading.blood_pressure_systolic;
      break;
    case 'bp_diastolic':
      value = reading.blood_pressure_diastolic;
      break;
    case 'temp':
    case 'temperature':
      value = reading.temperature_celsius;
      break;
    case 'spo2':
    case 'oxygen_saturation':
      value = reading.oxygen_saturation;
      break;
    case 'rr':
    case 'respiratory_rate':
      value = reading.respiratory_rate;
      break;
    case 'glucose':
    case 'blood_glucose':
      value = reading.blood_glucose_mg_dl;
      break;
    case 'weight':
      value = reading.weight_kg;
      break;
    case 'pain':
      return reading.pain_score !== undefined ? reading.pain_score : null;
    default:
      return null;
  }

  // Parse value to number if it's a string
  if (value == null) return null;

  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  // Return null if parsing resulted in NaN
  return isNaN(numValue) ? null : numValue;
};

export const useVitalsHistoryStore = create<VitalsHistoryStore>((set, get) => ({
  // Initial state
  vitalsHistory: [],
  statistics: null,
  isLoading: false,
  error: null,

  dateRange: getDateRangeFromPreset('7d'),
  selectedPreset: '7d',

  currentPatientId: null,
  currentVitalType: 'hr',

  /**
   * Load vitals history for a patient
   */
  loadHistory: async (patientId: string, vitalType?: string) => {
    try {
      set({ isLoading: true, error: null, currentPatientId: patientId });

      const state = get();
      const type = vitalType || state.currentVitalType;
      const { start, end } = state.dateRange;

      // Map vital type to API parameter
      let vitalTypeParam = type;
      if (type === 'hr' || type === 'heart_rate') {
        vitalTypeParam = 'hr';
      } else if (type === 'blood_pressure') {
        // For BP history, we don't pass a specific vital_types filter
        // This will return all vitals, and we'll filter them client-side
        vitalTypeParam = '';
      } else if (type === 'temperature') {
        vitalTypeParam = 'temp';
      } else if (type === 'spo2') {
        vitalTypeParam = 'spo2';
      } else if (type === 'respiratory_rate') {
        vitalTypeParam = 'rr';
      } else if (type === 'blood_glucose') {
        vitalTypeParam = 'glucose';
      } else if (type === 'weight') {
        vitalTypeParam = 'weight';
      } else if (type === 'consciousness') {
        vitalTypeParam = 'consciousness';
      }

      const vitals = await apiService.getVitalsHistory(
        patientId,
        start.toISOString(),
        end.toISOString(),
        vitalTypeParam || undefined
      );

      console.log(`[VitalsHistoryStore] Loaded ${vitals.length} vitals for patient ${patientId}`);
      set({
        vitalsHistory: vitals,
        isLoading: false,
        currentVitalType: type,
      });
    } catch (error) {
      console.error('Failed to load vitals history:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to load vitals history',
        isLoading: false,
      });
    }
  },

  /**
   * Load statistics for a vital type
   */
  loadStatistics: async (patientId: string, vitalType?: string) => {
    try {
      const state = get();
      const type = vitalType || state.currentVitalType;
      const { start, end } = state.dateRange;

      // Map vital type to API parameter
      let vitalTypeParam = type;
      if (type === 'hr' || type === 'heart_rate') {
        vitalTypeParam = 'hr';
      } else if (type === 'blood_pressure') {
        // For BP, use bp_systolic for statistics
        vitalTypeParam = 'bp_systolic';
      } else if (type === 'temperature') {
        vitalTypeParam = 'temp';
      } else if (type === 'spo2') {
        vitalTypeParam = 'spo2';
      } else if (type === 'respiratory_rate') {
        vitalTypeParam = 'rr';
      } else if (type === 'blood_glucose') {
        vitalTypeParam = 'glucose';
      } else if (type === 'weight') {
        vitalTypeParam = 'weight';
      } else if (type === 'consciousness') {
        vitalTypeParam = 'consciousness';
      }

      const stats = await apiService.getVitalsStatistics(
        patientId,
        start.toISOString(),
        end.toISOString(),
        vitalTypeParam
      );

      set({ statistics: stats });
    } catch (error) {
      console.error('Failed to load vitals statistics:', error);
      // Don't set error state for statistics failure - it's not critical
    }
  },

  /**
   * Set custom date range
   */
  setDateRange: (start: Date, end: Date) => {
    set({
      dateRange: { start, end },
      selectedPreset: 'all', // Custom range = no preset
    });

    // Reload data if patient is set
    const state = get();
    if (state.currentPatientId) {
      state.loadHistory(state.currentPatientId);
      state.loadStatistics(state.currentPatientId);
    }
  },

  /**
   * Set date range from preset (7d, 30d, 90d, all)
   */
  setDateRangePreset: (preset: DateRangePreset) => {
    const range = getDateRangeFromPreset(preset);
    set({
      dateRange: range,
      selectedPreset: preset,
    });

    // Reload data if patient is set
    const state = get();
    if (state.currentPatientId) {
      state.loadHistory(state.currentPatientId);
      state.loadStatistics(state.currentPatientId);
    }
  },

  /**
   * Change vital type being viewed
   */
  setVitalType: (vitalType: string) => {
    set({ currentVitalType: vitalType });

    // Reload data if patient is set
    const state = get();
    if (state.currentPatientId) {
      state.loadHistory(state.currentPatientId, vitalType);
      state.loadStatistics(state.currentPatientId, vitalType);
    }
  },

  /**
   * Clear error state
   */
  clearError: () => {
    set({ error: null });
  },

  /**
   * Clear all store data
   */
  clearStore: () => {
    set({
      vitalsHistory: [],
      statistics: null,
      isLoading: false,
      error: null,
      dateRange: getDateRangeFromPreset('7d'),
      selectedPreset: '7d',
      currentPatientId: null,
      currentVitalType: 'hr',
    });
  },

  /**
   * Get chart-ready data from vitals history
   */
  getChartData: () => {
    const state = get();
    const { vitalsHistory, currentVitalType } = state;

    const chartData = vitalsHistory
      .map((reading) => {
        const value = extractVitalValue(reading, currentVitalType);
        if (value === null) return null;

        // For blood pressure, also include diastolic value
        const dataPoint: VitalChartDataPoint = {
          x: new Date(reading.measured_at),
          y: value,
          reading,
        };

        return dataPoint;
      })
      .filter((point): point is VitalChartDataPoint => point !== null)
      .sort((a, b) => a.x.getTime() - b.x.getTime()); // Sort by date ascending

    console.log(`[VitalsHistoryStore] getChartData: ${chartData.length} points from ${vitalsHistory.length} readings`);
    return chartData;
  },
}));
