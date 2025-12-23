/**
 * Responsive Layout Utilities
 * 
 * Provides dynamic spacing and layout calculations based on screen dimensions
 * for optimal iPad app experience across different device sizes.
 */

import { Dimensions, ScaledSize } from 'react-native';
import { SPACING } from '@constants/theme';

// iPad device type detection based on screen dimensions
export type iPadDeviceType = 'iPad-Mini' | 'iPad-Air' | 'iPad-Pro';

// Screen orientation
export type ScreenOrientation = 'portrait' | 'landscape';

// Screen dimensions interface
export interface ScreenDimensions {
  width: number;
  height: number;
  orientation: ScreenOrientation;
  deviceType: iPadDeviceType;
  fontScale?: number;
  safeAreaInsets?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

// Responsive spacing configuration
export interface ResponsiveSpacing {
  screenHeight: number;
  baseSpacing: number;
  scaleFactor: number;
  minSpacing: number;
  maxSpacing: number;
  section: number;
  component: number;
  text: number;
}

// Layout configuration for different sections
export interface LayoutConfig {
  headerHeight: number;
  actionsHeight: number;
  availableContentHeight: number;
  spacing: ResponsiveSpacing;
  flexWeights: {
    context: number;
    instructions: number;
    recorder: number;
  };
}

/**
 * Get current screen dimensions and device info
 */
export const getScreenDimensions = (): ScreenDimensions => {
  const { width, height, fontScale } = Dimensions.get('window');
  
  // Determine orientation (always use larger dimension as height reference)
  const isLandscape = width > height;
  const orientation: ScreenOrientation = isLandscape ? 'landscape' : 'portrait';
  
  // Use the larger dimension for device type detection
  const referenceHeight = Math.max(width, height);
  
  // Detect iPad device type based on screen dimensions
  let deviceType: iPadDeviceType;
  if (referenceHeight <= 1024) {
    deviceType = 'iPad-Mini'; // iPad Mini: 768x1024
  } else if (referenceHeight <= 1180) {
    deviceType = 'iPad-Air';  // iPad Air: 820x1180
  } else {
    deviceType = 'iPad-Pro';  // iPad Pro: 1024x1366+
  }
  
  return {
    width,
    height,
    orientation,
    deviceType,
    fontScale,
  };
};

/**
 * Calculate responsive spacing based on screen height
 */
export const calculateResponsiveSpacing = (screenHeight: number): ResponsiveSpacing => {
  // Reference height for iPad Air (most common)
  const referenceHeight = 1180;
  
  // Calculate scale factor with bounds
  const rawScaleFactor = screenHeight / referenceHeight;
  const scaleFactor = Math.max(0.7, Math.min(1.3, rawScaleFactor));
  
  // Base spacing from theme
  const baseSpacing = SPACING.lg;
  
  // Calculate scaled spacing values
  const scaledSpacing = Math.round(baseSpacing * scaleFactor);
  const minSpacing = SPACING.sm;
  const maxSpacing = SPACING.xl;
  
  // Ensure spacing stays within bounds
  const finalSpacing = Math.max(minSpacing, Math.min(maxSpacing, scaledSpacing));
  
  return {
    screenHeight,
    baseSpacing,
    scaleFactor,
    minSpacing,
    maxSpacing,
    section: finalSpacing,
    component: Math.round(finalSpacing * 0.75), // Slightly smaller for component spacing
    text: Math.round(finalSpacing * 0.5),       // Smaller for text spacing
  };
};

/**
 * Calculate layout configuration for the voice recorder screen
 */
export const calculateLayoutConfig = (dimensions?: ScreenDimensions): LayoutConfig => {
  const screenDims = dimensions || getScreenDimensions();
  const spacing = calculateResponsiveSpacing(screenDims.height);
  
  // Fixed heights for header and actions
  const headerHeight = 80; // Fixed header height
  const actionsHeight = 100; // Fixed action buttons area height
  
  // Calculate available content height
  const availableContentHeight = screenDims.height - headerHeight - actionsHeight;
  
  // Flex weights based on priority and content needs
  let flexWeights = {
    context: 1,      // Context card - minimal space
    instructions: 2, // Instructions - moderate space
    recorder: 3,     // Recorder controls - priority space
  };
  
  // Adjust flex weights for smaller screens
  if (screenDims.deviceType === 'iPad-Mini') {
    flexWeights = {
      context: 1,
      instructions: 1.5, // Reduce instructions space on smaller screens
      recorder: 3.5,     // Give more space to recorder
    };
  }
  
  return {
    headerHeight,
    actionsHeight,
    availableContentHeight,
    spacing,
    flexWeights,
  };
};

/**
 * Get optimized spacing for specific screen size
 */
export const getResponsiveSpacing = (screenDimensions: ScreenDimensions) => {
  const { width, height, fontScale = 1 } = screenDimensions;
  
  // Handle invalid fontScale values
  const validFontScale = isNaN(fontScale) || fontScale <= 0 ? 1 : fontScale;
  
  // Base spacing values
  let horizontal = 16; // SPACING.lg
  let vertical = 12;   // SPACING.md
  
  // Scale based on screen size (use larger dimension for consistency)
  const largerDimension = Math.max(width, height);
  if (largerDimension > 1000) {
    horizontal = Math.min(24, Math.round(horizontal * 1.5)); // Cap at SPACING.xl
    vertical = Math.min(16, Math.round(vertical * 1.5));     // Cap at SPACING.lg
  }
  
  // Adjust for font scale - linear scaling for predictability
  if (validFontScale > 1.0) {
    const fontScaleMultiplier = Math.min(1.5, validFontScale); // Cap at 1.5x
    horizontal = Math.round(horizontal * fontScaleMultiplier);
    vertical = Math.round(vertical * fontScaleMultiplier);
  }
  
  return {
    horizontal: Math.round(horizontal),
    vertical: Math.round(vertical),
  };
};

/**
 * Check if content fits within viewport
 */
export const checkViewportFit = (
  contentHeight: number,
  availableHeight: number,
  threshold: number = 0.95 // 95% of available height
): boolean => {
  return contentHeight <= (availableHeight * threshold);
};

/**
 * Hook for responsive layout (React Native doesn't have hooks, but this provides the pattern)
 */
export const useResponsiveLayout = () => {
  const dimensions = getScreenDimensions();
  const layoutConfig = calculateLayoutConfig(dimensions);
  
  return {
    dimensions,
    layoutConfig,
    spacing: layoutConfig.spacing,
    isCompactScreen: dimensions.deviceType === 'iPad-Mini',
    isLandscape: dimensions.orientation === 'landscape',
  };
};

/**
 * Orientation change handler
 */
export const handleOrientationChange = (callback: (dimensions: ScreenDimensions) => void) => {
  const subscription = Dimensions.addEventListener('change', ({ window }) => {
    // Small delay to ensure dimensions are updated
    setTimeout(() => {
      const newDimensions = getScreenDimensions();
      callback(newDimensions);
    }, 100);
  });
  
  return subscription;
};

/**
 * Get optimized spacing for specific screen size (legacy compatibility)
 */
export const getOptimizedSpacing = (screenHeight: number) => {
  const spacing = calculateResponsiveSpacing(screenHeight);
  
  return {
    section: spacing.section,
    component: spacing.component,
    text: spacing.text,
    // Convenience getters
    get small() { return this.text; },
    get medium() { return this.component; },
    get large() { return this.section; },
  };
};