// Server configuration
export const API_CONFIG = {
  BASE_URL: 'https://verbumcare-lab.local/api',
  WS_URL: 'wss://verbumcare-lab.local',
  FALLBACK_IP: '192.168.0.208',
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
};

// Facility configuration
export const FACILITY_ID = '550e8400-e29b-41d4-a716-446655440001';
export const STAFF_ID = '550e8400-e29b-41d4-a716-446655440101'; // Demo nurse
export const DEMO_STAFF_ID = STAFF_ID; // Alias for demo purposes

// Voice processing configuration
export const VOICE_CONFIG = {
  MAX_DURATION: 60000, // 60 seconds
  FORMAT: 'm4a',
  SAMPLE_RATE: 44100,
  CHANNELS: 1,
  BITRATE: 128000,
};

// BLE configuration
export const BLE_CONFIG = {
  SCAN_TIMEOUT: 10000, // 10 seconds
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
    primary: '#667eea',
    secondary: '#764ba2',
    success: '#4CAF50',
    warning: '#FFA726',
    error: '#EF5350',
    errorLight: '#FFEBEE',
    info: '#29B6F6',
    background: '#F5F5F5',
    surface: '#FFFFFF',
    text: '#212121',
    textSecondary: '#757575',
    border: '#E0E0E0',
  },
  STATUS_COLORS: {
    green: '#4CAF50',
    yellow: '#FFA726',
    red: '#EF5350',
  },
};

// Export UI colors separately for easier access
export const UI_COLORS = UI_CONFIG.COLORS;

// Workflow steps configuration
export const WORKFLOW_STEPS = [
  'patient-list',
  'patient-scan',
  'vitals-capture',
  'adl-voice',
  'incident-report',
  'review-confirm',
] as const;
