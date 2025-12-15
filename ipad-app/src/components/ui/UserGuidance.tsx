import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '@constants/theme';
import { FadeIn, SlideIn } from './AnimatedTransitions';

/**
 * UserGuidance Components
 * 
 * Provides contextual help and guidance for first-time users
 */

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  visible?: boolean;
  onVisibilityChange?: (visible: boolean) => void;
}

export function Tooltip({
  content,
  children,
  position = 'top',
  visible: controlledVisible,
  onVisibilityChange,
}: TooltipProps) {
  const [internalVisible, setInternalVisible] = useState(false);
  
  const visible = controlledVisible !== undefined ? controlledVisible : internalVisible;
  
  const handlePress = () => {
    const newVisible = !visible;
    if (controlledVisible === undefined) {
      setInternalVisible(newVisible);
    }
    onVisibilityChange?.(newVisible);
  };

  const getTooltipStyle = () => {
    const baseStyle = styles.tooltip;
    switch (position) {
      case 'bottom':
        return [baseStyle, styles.tooltipBottom];
      case 'left':
        return [baseStyle, styles.tooltipLeft];
      case 'right':
        return [baseStyle, styles.tooltipRight];
      default:
        return [baseStyle, styles.tooltipTop];
    }
  };

  return (
    <View style={styles.tooltipContainer}>
      <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
        {children}
      </TouchableOpacity>
      
      {visible && (
        <FadeIn duration={200}>
          <View style={getTooltipStyle()}>
            <Text style={styles.tooltipText}>{content}</Text>
            <View style={[styles.tooltipArrow, getArrowStyle(position)]} />
          </View>
        </FadeIn>
      )}
    </View>
  );
}

function getArrowStyle(position: string) {
  switch (position) {
    case 'bottom':
      return styles.arrowTop;
    case 'left':
      return styles.arrowRight;
    case 'right':
      return styles.arrowLeft;
    default:
      return styles.arrowBottom;
  }
}

/**
 * HelpButton Component
 * 
 * Floating help button that shows contextual guidance
 */
interface HelpButtonProps {
  onPress?: () => void;
  style?: any;
}

export function HelpButton({ onPress, style }: HelpButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.helpButton, style]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={styles.helpButtonText}>?</Text>
    </TouchableOpacity>
  );
}

/**
 * OnboardingModal Component
 * 
 * Modal that shows step-by-step guidance for new features
 */
interface OnboardingStep {
  title: string;
  description: string;
  image?: string;
  tips?: string[];
}

interface OnboardingModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  steps: OnboardingStep[];
}

export function OnboardingModal({
  visible,
  onClose,
  title,
  steps,
}: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  const currentStepData = steps[currentStep];

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <SlideIn direction="up" duration={300}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{title}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Progress indicator */}
            <View style={styles.progressContainer}>
              {steps.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.progressDot,
                    index === currentStep && styles.progressDotActive,
                    index < currentStep && styles.progressDotCompleted,
                  ]}
                />
              ))}
            </View>

            {/* Content */}
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <FadeIn key={currentStep}>
                <Text style={styles.stepTitle}>{currentStepData.title}</Text>
                <Text style={styles.stepDescription}>{currentStepData.description}</Text>
                
                {currentStepData.tips && currentStepData.tips.length > 0 && (
                  <View style={styles.tipsContainer}>
                    <Text style={styles.tipsTitle}>💡 Tips:</Text>
                    {currentStepData.tips.map((tip, index) => (
                      <Text key={index} style={styles.tipText}>
                        • {tip}
                      </Text>
                    ))}
                  </View>
                )}
              </FadeIn>
            </ScrollView>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
                <Text style={styles.skipButtonText}>Skip</Text>
              </TouchableOpacity>
              
              <View style={styles.navigationButtons}>
                {currentStep > 0 && (
                  <TouchableOpacity onPress={handlePrevious} style={styles.previousButton}>
                    <Text style={styles.previousButtonText}>Previous</Text>
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity onPress={handleNext} style={styles.nextButton}>
                  <Text style={styles.nextButtonText}>
                    {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </SlideIn>
      </View>
    </Modal>
  );
}

/**
 * ConfidenceTooltip Component
 * 
 * Specialized tooltip for explaining confidence scores
 */
interface ConfidenceTooltipProps {
  confidence: number;
  visible: boolean;
  onClose: () => void;
}

export function ConfidenceTooltip({
  confidence,
  visible,
  onClose,
}: ConfidenceTooltipProps) {
  const getConfidenceExplanation = (score: number): string => {
    if (score >= 0.8) {
      return "High confidence: The AI is very sure about this extraction. You can likely trust this data as-is.";
    } else if (score >= 0.6) {
      return "Medium confidence: The AI has some uncertainty. Please review this data carefully before confirming.";
    } else {
      return "Low confidence: The AI is unsure about this extraction. Please verify and edit as needed before saving.";
    }
  };

  const getConfidenceColor = (score: number): string => {
    if (score >= 0.8) return COLORS.success;
    if (score >= 0.6) return COLORS.warning;
    return COLORS.error;
  };

  if (!visible) return null;

  return (
    <FadeIn>
      <View style={styles.confidenceTooltip}>
        <View style={styles.confidenceHeader}>
          <Text style={styles.confidenceTitle}>
            Confidence Score: {Math.round(confidence * 100)}%
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.confidenceClose}>✕</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.confidenceBar}>
          <View
            style={[
              styles.confidenceFill,
              {
                width: `${confidence * 100}%`,
                backgroundColor: getConfidenceColor(confidence),
              },
            ]}
          />
        </View>
        
        <Text style={styles.confidenceExplanation}>
          {getConfidenceExplanation(confidence)}
        </Text>
      </View>
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  tooltipContainer: {
    position: 'relative',
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: COLORS.text.primary,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.md,
    maxWidth: 250,
    zIndex: 1000,
    ...SHADOWS.lg,
  },
  tooltipTop: {
    bottom: '100%',
    marginBottom: SPACING.sm,
  },
  tooltipBottom: {
    top: '100%',
    marginTop: SPACING.sm,
  },
  tooltipLeft: {
    right: '100%',
    marginRight: SPACING.sm,
  },
  tooltipRight: {
    left: '100%',
    marginLeft: SPACING.sm,
  },
  tooltipText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.lineHeight.normal,
  },
  tooltipArrow: {
    position: 'absolute',
    width: 0,
    height: 0,
  },
  arrowBottom: {
    top: '100%',
    left: '50%',
    marginLeft: -6,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: COLORS.text.primary,
  },
  arrowTop: {
    bottom: '100%',
    left: '50%',
    marginLeft: -6,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: COLORS.text.primary,
  },
  arrowLeft: {
    top: '50%',
    right: '100%',
    marginTop: -6,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderRightWidth: 6,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: COLORS.text.primary,
  },
  arrowRight: {
    top: '50%',
    left: '100%',
    marginTop: -6,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftWidth: 6,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: COLORS.text.primary,
  },
  helpButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.md,
  },
  helpButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.backdrop,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    ...SHADOWS.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.xl,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  closeButton: {
    padding: SPACING.sm,
  },
  closeButtonText: {
    fontSize: 20,
    color: COLORS.text.secondary,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
  },
  progressDotActive: {
    backgroundColor: COLORS.primary,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  progressDotCompleted: {
    backgroundColor: COLORS.success,
  },
  modalBody: {
    flex: 1,
    padding: SPACING.xl,
  },
  stepTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },
  stepDescription: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    lineHeight: TYPOGRAPHY.lineHeight.relaxed,
    marginBottom: SPACING.lg,
  },
  tipsContainer: {
    backgroundColor: COLORS.accentLight,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
  },
  tipsTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  tipText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    lineHeight: TYPOGRAPHY.lineHeight.normal,
    marginBottom: SPACING.xs,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.xl,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  skipButton: {
    padding: SPACING.md,
  },
  skipButtonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
  },
  navigationButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  previousButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  previousButtonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  nextButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  nextButtonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  confidenceTooltip: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    margin: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.md,
  },
  confidenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  confidenceTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  confidenceClose: {
    fontSize: 16,
    color: COLORS.text.secondary,
    padding: SPACING.xs,
  },
  confidenceBar: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 3,
  },
  confidenceExplanation: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    lineHeight: TYPOGRAPHY.lineHeight.normal,
  },
});