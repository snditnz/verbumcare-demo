import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ActivityIndicator } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY } from '@constants/theme';

/**
 * LoadingSpinner Component
 * 
 * Enhanced loading spinner with customizable appearance and animations
 */

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  overlay?: boolean;
  message?: string;
  style?: any;
}

export function LoadingSpinner({
  size = 'medium',
  color = COLORS.primary,
  overlay = false,
  message,
  style,
}: LoadingSpinnerProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  const getSize = () => {
    switch (size) {
      case 'small':
        return 'small' as const;
      case 'large':
        return 'large' as const;
      default:
        return 'small' as const;
    }
  };

  const content = (
    <Animated.View
      style={[
        styles.container,
        overlay && styles.overlay,
        { opacity: fadeAnim },
        style,
      ]}
    >
      <View style={styles.spinnerContainer}>
        <ActivityIndicator size={getSize()} color={color} />
        {message && (
          <Animated.Text
            style={[
              styles.message,
              { color: overlay ? COLORS.white : COLORS.text.secondary },
            ]}
          >
            {message}
          </Animated.Text>
        )}
      </View>
    </Animated.View>
  );

  return content;
}

/**
 * ProcessingSpinner
 * 
 * Specialized spinner for voice processing with progress indication
 */
interface ProcessingSpinnerProps {
  phase: string;
  progress?: number;
  estimatedTime?: number;
  style?: any;
}

export function ProcessingSpinner({
  phase,
  progress,
  estimatedTime,
  style,
}: ProcessingSpinnerProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    pulse.start();

    return () => pulse.stop();
  }, []);

  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <View style={[styles.processingContainer, style]}>
      <Animated.View
        style={[
          styles.processingSpinner,
          { transform: [{ scale: pulseAnim }] },
        ]}
      >
        <ActivityIndicator size="large" color={COLORS.primary} />
      </Animated.View>
      
      <View style={styles.processingInfo}>
        <Animated.Text style={styles.processingPhase}>
          {phase}
        </Animated.Text>
        
        {progress !== undefined && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <Animated.View
                style={[
                  styles.progressFill,
                  { width: `${progress}%` },
                ]}
              />
            </View>
            <Animated.Text style={styles.progressText}>
              {Math.round(progress)}%
            </Animated.Text>
          </View>
        )}
        
        {estimatedTime && estimatedTime > 0 && (
          <Animated.Text style={styles.estimatedTime}>
            Est. {formatTime(estimatedTime)} remaining
          </Animated.Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.backdrop,
    zIndex: 9998,
  },
  spinnerContainer: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.xl,
    minWidth: 120,
  },
  message: {
    marginTop: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
  },
  processingContainer: {
    alignItems: 'center',
    padding: SPACING.xl,
  },
  processingSpinner: {
    marginBottom: SPACING.lg,
  },
  processingInfo: {
    alignItems: 'center',
    minWidth: 200,
  },
  processingPhase: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: SPACING.sm,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: SPACING.md,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.secondary,
    minWidth: 40,
    textAlign: 'right',
  },
  estimatedTime: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
});