import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../constants/theme';

interface ConfidenceIndicatorProps {
  confidence: number; // 0.0 to 1.0
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  style?: any;
}

/**
 * ConfidenceIndicator Component
 * 
 * Displays a visual confidence indicator with color-coded feedback:
 * - Green: High confidence (>0.8)
 * - Yellow: Medium confidence (0.6-0.8)
 * - Orange: Low confidence (<0.6)
 * 
 * Includes a tooltip that shows the exact confidence score when tapped.
 * 
 * Requirements: 4.4, 5.5
 */
const ConfidenceIndicator: React.FC<ConfidenceIndicatorProps> = ({
  confidence,
  size = 'medium',
  showLabel = false,
  style,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  // Determine color based on confidence level
  const getConfidenceColor = (): string => {
    if (confidence > 0.8) {
      return COLORS.success; // Green for high confidence
    } else if (confidence >= 0.6) {
      return '#FDD835'; // Yellow for medium confidence
    } else {
      return COLORS.warning; // Orange for low confidence
    }
  };

  // Get confidence level text
  const getConfidenceLevel = (): string => {
    if (confidence > 0.8) {
      return '高';
    } else if (confidence >= 0.6) {
      return '中';
    } else {
      return '低';
    }
  };

  // Get size-specific dimensions
  const getSizeDimensions = () => {
    switch (size) {
      case 'small':
        return { width: 40, height: 6, fontSize: 12 };
      case 'large':
        return { width: 80, height: 10, fontSize: 16 };
      case 'medium':
      default:
        return { width: 60, height: 8, fontSize: 14 };
    }
  };

  const dimensions = getSizeDimensions();
  const confidenceColor = getConfidenceColor();
  const confidenceLevel = getConfidenceLevel();
  const confidencePercentage = Math.round(confidence * 100);

  return (
    <>
      <TouchableOpacity
        onPress={() => setShowTooltip(true)}
        activeOpacity={0.7}
        style={[styles.container, style]}
      >
        {/* Color bar indicator */}
        <View
          style={[
            styles.barContainer,
            {
              width: dimensions.width,
              height: dimensions.height,
            },
          ]}
        >
          <View
            style={[
              styles.barFill,
              {
                width: `${confidencePercentage}%`,
                backgroundColor: confidenceColor,
              },
            ]}
          />
        </View>

        {/* Optional label */}
        {showLabel && (
          <Text
            style={[
              styles.label,
              {
                fontSize: dimensions.fontSize,
                color: confidenceColor,
              },
            ]}
          >
            {confidenceLevel}
          </Text>
        )}
      </TouchableOpacity>

      {/* Tooltip Modal */}
      <Modal
        visible={showTooltip}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTooltip(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowTooltip(false)}
        >
          <View style={styles.tooltip}>
            <Text style={styles.tooltipTitle}>信頼度スコア</Text>
            <Text style={styles.tooltipScore}>{confidencePercentage}%</Text>
            <Text style={styles.tooltipDescription}>
              {confidence > 0.8
                ? '高い信頼度 - データは正確である可能性が高い'
                : confidence >= 0.6
                ? '中程度の信頼度 - データを確認してください'
                : '低い信頼度 - データを慎重に確認してください'}
            </Text>
            <View
              style={[
                styles.tooltipIndicator,
                { backgroundColor: confidenceColor },
              ]}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  barContainer: {
    backgroundColor: COLORS.divider,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: BORDER_RADIUS.sm,
  },
  label: {
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.backdrop,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tooltip: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.xl,
    minWidth: 280,
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  tooltipTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
  },
  tooltipScore: {
    fontSize: TYPOGRAPHY.fontSize['3xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },
  tooltipDescription: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    lineHeight: TYPOGRAPHY.lineHeight.relaxed * TYPOGRAPHY.fontSize.sm,
    marginBottom: SPACING.lg,
  },
  tooltipIndicator: {
    height: 4,
    borderRadius: BORDER_RADIUS.sm,
    marginTop: SPACING.sm,
  },
});

export default ConfidenceIndicator;
