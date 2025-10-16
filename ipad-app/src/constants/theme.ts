// VerbumCare Design System
// Brand identity colors, typography, and spacing standards for iPad nurse app

export const COLORS = {
  // Brand Colors (from VerbumCare logo)
  primary: '#3D5A6C',        // Navy/Slate (from logo left swoosh)
  primaryDark: '#2A3F4F',    // Navy Dark (active states, emphasis)
  primaryLight: '#5A7A8C',   // Navy Light (secondary elements, borders)

  secondary: '#5B8558',      // Healthcare Green (from logo middle swoosh)
  accent: '#8BBF69',         // Fresh Lime (from logo right swoosh)
  accentLight: '#E8F4E3',    // Mint Tint (success backgrounds)

  white: '#FFFFFF',          // Medical Cross White

  // Backgrounds
  background: '#F8F6F3',     // Soft Cream
  surface: '#FFFFFF',        // Card backgrounds
  surfaceNavy: '#F5F7F8',    // Navy 5% tint for subtle sections

  // Semantic Colors
  success: '#5B8558',        // Healthcare Green - confirmed actions, normal vitals
  successLight: '#8BBF69',   // Fresh Lime - positive feedback, accents
  warning: '#FFA726',        // Warm Amber - attention needed, drafts
  error: '#E57373',          // Medical Red - critical alerts
  info: '#5A7A8C',          // Navy Light - informational states

  // Text Colors
  text: {
    primary: '#2C3E50',      // Dark Gray
    secondary: '#6B7280',    // Warmer Gray
    disabled: '#BDC3C7',
    inverse: '#FFFFFF',
  },

  // Status Colors (for vitals, alerts)
  status: {
    normal: '#5B8558',       // Healthcare Green - within normal range
    warning: '#FFA726',      // Amber - attention needed
    critical: '#E57373',     // Red - urgent attention
    neutral: '#95A5A6',      // Gray - no data/inactive
  },

  // Borders & Dividers
  border: '#E0E0E0',
  divider: '#F0F0F0',

  // Overlays
  overlay: 'rgba(61, 90, 108, 0.6)',  // Navy with transparency
  backdrop: 'rgba(0, 0, 0, 0.4)',
} as const;

export const TYPOGRAPHY = {
  // Font Families
  fontFamily: {
    japanese: 'NotoSansJP',  // Will use system Japanese font as fallback
    english: 'System',       // iOS SF Pro
    mono: 'Menlo',           // Monospace for codes
  },

  // Font Sizes (minimum 16pt for accessibility)
  fontSize: {
    xs: 14,    // Small labels only
    sm: 16,    // Body text minimum
    base: 18,  // Body text comfortable
    lg: 20,    // Section labels
    xl: 24,    // Screen titles
    '2xl': 28, // Patient names, important data
    '3xl': 32, // Vital signs values
    '4xl': 40, // Hero numbers
  },

  // Font Weights
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },

  // Line Heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.8,
  },
} as const;

export const SPACING = {
  // Base spacing unit: 4pt
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,

  // Touch Targets (glove-friendly)
  touchTarget: {
    min: 52,      // Minimum touch target
    comfortable: 56,  // Comfortable button height
    large: 72,     // Large floating action button
    xl: 88,        // Extra large (patient cards)
  },
} as const;

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
} as const;

// Icon sizes standardized
export const ICON_SIZES = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 48,
  '2xl': 64,
} as const;

// Animation durations (keep minimal as per requirements)
export const ANIMATION = {
  fast: 100,
  normal: 200,
  slow: 300,
} as const;
