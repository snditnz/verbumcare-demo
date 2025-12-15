import { COLORS as DEFAULT_COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS, SHADOWS } from '@constants/theme';

/**
 * High Contrast Theme
 * 
 * Provides high contrast colors and styles for accessibility compliance
 */

export const HIGH_CONTRAST_COLORS = {
  // High contrast backgrounds
  background: '#000000',
  surface: '#1a1a1a',
  surfaceNavy: '#2a2a2a',

  // High contrast text
  text: {
    primary: '#ffffff',
    secondary: '#e0e0e0',
    disabled: '#808080',
    inverse: '#000000',
  },

  // High contrast brand colors
  primary: '#00aaff',        // Brighter blue
  primaryDark: '#0088cc',    
  primaryLight: '#33bbff',   

  secondary: '#00ff88',      // Brighter green
  accent: '#ffff00',         // Bright yellow
  accentLight: '#333300',    // Dark yellow background

  white: '#ffffff',

  // High contrast semantic colors
  success: '#00ff00',        // Bright green
  successLight: '#00aa00',   
  warning: '#ffaa00',        // Bright orange
  error: '#ff0000',          // Bright red
  info: '#00aaff',          // Bright blue

  // High contrast status colors
  status: {
    normal: '#00ff00',       // Bright green
    warning: '#ffaa00',      // Bright orange
    critical: '#ff0000',     // Bright red
    neutral: '#cccccc',      // Light gray
  },

  // High contrast borders
  border: '#ffffff',
  divider: '#666666',

  // High contrast overlays
  overlay: 'rgba(255, 255, 255, 0.9)',
  backdrop: 'rgba(0, 0, 0, 0.95)',
};

/**
 * High contrast theme object
 */
export const HIGH_CONTRAST_THEME = {
  colors: HIGH_CONTRAST_COLORS,
  typography: TYPOGRAPHY,
  spacing: SPACING,
  borderRadius: BORDER_RADIUS,
  shadows: {
    // Enhanced shadows for high contrast
    sm: {
      shadowColor: '#ffffff',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.3,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#ffffff',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 4,
      elevation: 3,
    },
    lg: {
      shadowColor: '#ffffff',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 8,
      elevation: 5,
    },
  },
};

/**
 * Theme context for switching between normal and high contrast
 */
export interface ThemeContextType {
  colors: typeof DEFAULT_COLORS | typeof HIGH_CONTRAST_COLORS;
  isHighContrast: boolean;
  toggleHighContrast: () => void;
}

/**
 * Get appropriate colors based on high contrast setting
 */
export function getThemeColors(isHighContrast: boolean) {
  return isHighContrast ? HIGH_CONTRAST_COLORS : DEFAULT_COLORS;
}

/**
 * High contrast style overrides for specific components
 */
export const HIGH_CONTRAST_OVERRIDES = {
  // Button styles
  button: {
    primary: {
      backgroundColor: HIGH_CONTRAST_COLORS.primary,
      borderWidth: 2,
      borderColor: HIGH_CONTRAST_COLORS.white,
    },
    secondary: {
      backgroundColor: HIGH_CONTRAST_COLORS.surface,
      borderWidth: 2,
      borderColor: HIGH_CONTRAST_COLORS.primary,
    },
    text: {
      color: HIGH_CONTRAST_COLORS.text.primary,
      fontWeight: '700' as const,
    },
  },

  // Input styles
  input: {
    backgroundColor: HIGH_CONTRAST_COLORS.surface,
    borderWidth: 2,
    borderColor: HIGH_CONTRAST_COLORS.white,
    color: HIGH_CONTRAST_COLORS.text.primary,
  },

  // Card styles
  card: {
    backgroundColor: HIGH_CONTRAST_COLORS.surface,
    borderWidth: 2,
    borderColor: HIGH_CONTRAST_COLORS.border,
  },

  // Badge styles
  badge: {
    success: {
      backgroundColor: HIGH_CONTRAST_COLORS.success,
      color: HIGH_CONTRAST_COLORS.text.inverse,
      borderWidth: 1,
      borderColor: HIGH_CONTRAST_COLORS.white,
    },
    warning: {
      backgroundColor: HIGH_CONTRAST_COLORS.warning,
      color: HIGH_CONTRAST_COLORS.text.inverse,
      borderWidth: 1,
      borderColor: HIGH_CONTRAST_COLORS.white,
    },
    error: {
      backgroundColor: HIGH_CONTRAST_COLORS.error,
      color: HIGH_CONTRAST_COLORS.white,
      borderWidth: 1,
      borderColor: HIGH_CONTRAST_COLORS.white,
    },
  },

  // Loading spinner
  spinner: {
    color: HIGH_CONTRAST_COLORS.primary,
  },

  // Progress bar
  progressBar: {
    backgroundColor: HIGH_CONTRAST_COLORS.surface,
    borderWidth: 1,
    borderColor: HIGH_CONTRAST_COLORS.white,
    fill: {
      backgroundColor: HIGH_CONTRAST_COLORS.primary,
    },
  },
};

/**
 * Apply high contrast styles to a component
 */
export function applyHighContrastStyles(
  baseStyles: any,
  highContrastOverrides: any,
  isHighContrast: boolean
) {
  if (!isHighContrast) {
    return baseStyles;
  }

  return {
    ...baseStyles,
    ...highContrastOverrides,
  };
}