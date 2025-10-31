/**
 * DateRangeSelector Component
 *
 * Allows users to select a preset date range for vitals history.
 * Supports 7 days, 30 days, 90 days, or all time.
 *
 * @example
 * <DateRangeSelector
 *   selectedPreset="7d"
 *   onPresetChange={(preset) => setPreset(preset)}
 * />
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SPACING } from '@/constants/theme';
import { DateRangePreset } from '@/stores/vitalsHistoryStore';

interface Props {
  selectedPreset: DateRangePreset;
  onPresetChange: (preset: DateRangePreset) => void;
}

const PRESETS: Array<{ key: DateRangePreset; label: string }> = [
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: '90d', label: '90 Days' },
  { key: 'all', label: 'All Time' },
];

export const DateRangeSelector: React.FC<Props> = ({
  selectedPreset,
  onPresetChange,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Date Range</Text>
      <View style={styles.buttonsRow}>
        {PRESETS.map(({ key, label }) => {
          const isSelected = selectedPreset === key;
          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.button,
                isSelected && styles.buttonSelected,
              ]}
              onPress={() => onPresetChange(key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.buttonText,
                  isSelected && styles.buttonTextSelected,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  button: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  buttonTextSelected: {
    color: '#FFFFFF',
  },
});
