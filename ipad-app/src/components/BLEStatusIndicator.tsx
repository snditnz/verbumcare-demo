import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { BLEConnectionStatus } from '@models/ble';
import { UI_COLORS } from '@constants/config';
import { useAssessmentStore } from '@stores/assessmentStore';
import { translations } from '@constants/translations';

interface BLEStatusIndicatorProps {
  status: BLEConnectionStatus;
}

export const BLEStatusIndicator: React.FC<BLEStatusIndicatorProps> = ({ status }) => {
  const { language } = useAssessmentStore();
  const t = translations[language];

  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          color: UI_COLORS.success,
          icon: '●',
          text: t['ble.connected'],
          showSpinner: false,
        };
      case 'connecting':
        return {
          color: UI_COLORS.warning,
          icon: '○',
          text: t['ble.connecting'],
          showSpinner: true,
        };
      case 'pairing':
        return {
          color: UI_COLORS.warning,
          icon: '○',
          text: t['ble.pairing'] || 'Pairing... Enter PIN: 0000',
          showSpinner: true,
        };
      case 'scanning':
        return {
          color: UI_COLORS.primary,
          icon: '○',
          text: t['ble.scanning'],
          showSpinner: true,
        };
      case 'disconnected':
        return {
          color: UI_COLORS.textSecondary,
          icon: '○',
          text: t['ble.disconnected'],
          showSpinner: false,
        };
      case 'error':
        return {
          color: UI_COLORS.error,
          icon: '✕',
          text: t['ble.error'],
          showSpinner: false,
        };
      default:
        return {
          color: UI_COLORS.textSecondary,
          icon: '○',
          text: t['ble.disconnected'],
          showSpinner: false,
        };
    }
  };

  const config = getStatusConfig();

  return (
    <View style={styles.container}>
      <View style={styles.statusRow}>
        {config.showSpinner ? (
          <ActivityIndicator size="small" color={config.color} />
        ) : (
          <Text style={[styles.icon, { color: config.color }]}>
            {config.icon}
          </Text>
        )}

        <Text style={[styles.text, { color: config.color }]}>
          {config.text}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    fontSize: 20,
    fontWeight: '700',
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
});
