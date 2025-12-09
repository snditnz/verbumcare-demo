// Server configuration
export const API_CONFIG = {
  BASE_URL: 'https://verbumcare-lab.local/api',
  WS_URL: 'wss://verbumcare-lab.local',
  TIMEOUT: 60000, // 60 seconds - increased for demo reliability
  RETRY_ATTEMPTS: 3,
};

// Facility configuration
export const FACILITY_ID = '550e8400-e29b-41d4-a716-446655440001';
export const STAFF_ID = '550e8400-e29b-41d4-a716-446655440101'; // Demo nurse
export const DEMO_STAFF_ID = STAFF_ID; // Alias for demo purposes

// Voice processing configuration
export const VOICE_CONFIG = {
  MAX_DURATION: 120000, // 120 seconds (2 minutes)
  FORMAT: 'm4a',
  SAMPLE_RATE: 44100,
  CHANNELS: 1,
  BITRATE: 128000,
};

// BLE configuration
export const BLE_CONFIG = {
  SCAN_TIMEOUT: 60000, // 60 seconds - long enough to take a BP reading
  CONNECT_TIMEOUT: 5000, // 5 seconds
  RETRY_DELAY: 2000, // 2 seconds
  MAX_RETRIES: 3,
};

// UI configuration
export const UI_CONFIG = {
  MIN_TOUCH_SIZE: 48,
  CARD_BORDER_RADIUS: 12,
  SPACING: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  COLORS: {
    primary: '#3D5A6C',        // Navy/Slate (from logo)
    secondary: '#5B8558',      // Healthcare Green (from logo)
    success: '#5B8558',        // Healthcare Green
    successLight: '#8BBF69',   // Fresh Lime
    warning: '#FFA726',        // Warm Amber
    error: '#EF5350',          // Medical Red
    errorLight: '#FFEBEE',
    info: '#5A7A8C',          // Navy Light
    background: '#F5F5F5',
    surface: '#FFFFFF',
    text: '#212121',
    textSecondary: '#757575',
    border: '#E0E0E0',
  },
  STATUS_COLORS: {
    green: '#5B8558',         // Healthcare Green
    yellow: '#FFA726',        // Warm Amber
    red: '#EF5350',          // Medical Red
  },
};

// Export UI colors separately for easier access
export const UI_COLORS = UI_CONFIG.COLORS;

// Session configuration
export const SESSION_CONFIG = {
  // Time in hours after which session badges/ticks are hidden (data persists)
  BADGE_TIMEOUT_HOURS: 4,
};

// Workflow steps configuration
export const WORKFLOW_STEPS = [
  'patient-list',
  'patient-scan',
  'vitals-capture',
  'adl-voice',
  'incident-report',
  'review-confirm',
] as const;
