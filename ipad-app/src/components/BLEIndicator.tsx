import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BLEConnectionStatus } from '@models/ble';
import { COLORS, ICON_SIZES } from '@constants/theme';

interface BLEIndicatorProps {
  status: BLEConnectionStatus;
  isTransmitting?: boolean; // New prop to indicate data transmission
}

export function BLEIndicator({ status, isTransmitting = false }: BLEIndicatorProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isTransmitting) {
      // Fast flashing animation during data transmission
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.2,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      // Stop animation and reset to solid
      pulseAnim.stopAnimation();
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isTransmitting]);

  const getIconConfig = () => {
    // Greyed out when not connected
    if (status === 'disconnected' || status === 'scanning' || status === 'error') {
      return {
        name: 'bluetooth' as const,
        color: COLORS.text.disabled, // Grey
      };
    }

    // Blue when connected (solid or flashing based on isTransmitting)
    if (status === 'connected' || status === 'connecting') {
      return {
        name: 'bluetooth' as const,
        color: COLORS.info, // Blue
      };
    }

    // Default fallback
    return {
      name: 'bluetooth' as const,
      color: COLORS.text.disabled,
    };
  };

  const iconConfig = getIconConfig();

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity: pulseAnim }}>
        <Ionicons
          name={iconConfig.name}
          size={ICON_SIZES.md}
          color={iconConfig.color}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
});
