# Design Document

## Overview

The Backend Switching and Settings feature enables users to configure backend server addresses through the native iOS Settings app and manage language preferences within the VerbumCare iPad application. This feature provides critical failover capabilities and ensures users can easily switch between different backend servers without data loss or workflow interruption.

**Key Design Principle**: Server configuration is managed exclusively through the iOS Settings app (Settings > VerbumCare), while language preferences and other app settings remain in the in-app settings screen. This approach provides a native iOS experience for critical infrastructure configuration while maintaining app-specific settings within the application.

The design focuses on reliability, user experience, and maintainability, ensuring seamless transitions between backend servers with comprehensive validation and error handling.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    iOS Settings App                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ VerbumCare Settings                                         │ │
│  │  • Backend Server Address (Dropdown + Manual Entry)        │ │
│  │  • Prefilled Options:                                      │ │
│  │    - pn51 (verbumcare-lab.local) [DEFAULT]                │ │
│  │    - Mac Mini (verbumcaremac-mini)                        │ │
│  │    - Mac Mini Tailscale (verbumcarenomac-mini.local)      │ │
│  │  • Custom Server Entry with Validation                     │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                VerbumCare App Settings Screen                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ Language Picker │  │ Status Display  │  │ Other Settings  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                Settings Store (Zustand)                        │
├─────────────────────────────────────────────────────────────────┤
│  • Current server configuration (from iOS Settings)            │
│  • Language preference                                         │
│  • Connection status                                           │
│  • Server switching state                                      │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              Native Settings Service                           │
├─────────────────────────────────────────────────────────────────┤
│  • iOS Settings integration                                    │
│  • Server address validation                                   │
│  • Prefilled options management                               │
│  • Custom server persistence                                   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              Backend Configuration Service                      │
├─────────────────────────────────────────────────────────────────┤
│  • Server configuration loading from iOS Settings             │
│  • Connectivity testing and validation                        │
│  • API client reconfiguration                                  │
│  • Cache management during switches                            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   API Service Layer                            │
├─────────────────────────────────────────────────────────────────┤
│  • Dynamic endpoint configuration                              │
│  • Health check endpoints                                      │
│  • Authentication re-establishment                             │
└─────────────────────────────────────────────────────────────────┘
```

### Server Configuration Structure

```typescript
interface ServerConfig {
  id: string;
  name: string;
  displayName: string;
  baseUrl: string;
  wsUrl: string;
  description: string;
  isDefault: boolean;
  healthCheckEndpoints: string[];
  connectionTimeout: number;
  retryAttempts: number;
  isPrefilled: boolean;        // Whether this is a prefilled option
  isCustom: boolean;           // Whether this was added by user
}

interface NativeSettingsConfig {
  serverAddress: string;       // The selected/entered server address
  availableServers: string[];  // List of all available servers (prefilled + custom)
  customServers: string[];     // User-added custom servers
}
```

### Prefilled Server Options

The iOS Settings will include three prefilled server addresses:

1. **pn51 (Default)**: `https://verbumcare-lab.local/api`
   - Legacy production server
   - Available for rollback and testing
   - Default selection for new installations

2. **Mac Mini**: `https://verbumcaremac-mini/api`
   - Current production server
   - Optimized for Apple Silicon with Metal GPU acceleration
   - Primary production environment

3. **Mac Mini Tailscale**: `https://verbumcarenomac-mini.local/api`
   - Mac Mini accessible via Tailscale VPN
   - For remote access scenarios
   - Alternative mDNS address for Tailscale networks

## Components and Interfaces

### 1. iOS Settings Integration (Root.plist)

**Location**: `ios/VerbumCare/Settings.bundle/Root.plist`

**Configuration**:
```xml
<dict>
  <key>Type</key>
  <string>PSMultiValueSpecifier</string>
  <key>Title</key>
  <string>Backend Server</string>
  <key>Key</key>
  <string>backend_server_address</string>
  <key>DefaultValue</key>
  <string>https://verbumcare-lab.local/api</string>
  <key>Values</key>
  <array>
    <string>https://verbumcare-lab.local/api</string>
    <string>https://verbumcaremac-mini/api</string>
    <string>https://verbumcarenomac-mini.local/api</string>
    <string>__CUSTOM__</string>
  </array>
  <key>Titles</key>
  <array>
    <string>pn51 (Default)</string>
    <string>Mac Mini</string>
    <string>Mac Mini Tailscale</string>
    <string>Add Custom Server...</string>
  </array>
</dict>

<!-- Custom Server Entry Field -->
<dict>
  <key>Type</key>
  <string>PSTextFieldSpecifier</string>
  <key>Title</key>
  <string>Custom Server Address</string>
  <key>Key</key>
  <string>custom_server_address</string>
  <key>DefaultValue</key>
  <string></string>
  <key>KeyboardType</key>
  <string>URL</string>
  <key>AutocapitalizationType</key>
  <string>None</string>
  <key>AutocorrectionType</key>
  <string>No</string>
</dict>
```

**Responsibilities**:
- Provide native iOS settings interface for server configuration
- Display prefilled server options in dropdown
- Allow custom server address entry
- Persist user selections to UserDefaults
- Validate server addresses before saving

### 2. Native Settings Service

**Location**: `src/services/nativeSettingsService.ts`

**Core Functions**:
```typescript
interface NativeSettingsService {
  // Read server configuration from iOS Settings
  getServerAddress(): Promise<string>;
  
  // Get list of all available servers (prefilled + custom)
  getAvailableServers(): Promise<string[]>;
  
  // Add custom server to available list
  addCustomServer(address: string): Promise<boolean>;
  
  // Remove custom server from list
  removeCustomServer(address: string): Promise<boolean>;
  
  // Validate server address format and connectivity
  validateServerAddress(address: string): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }>;
  
  // Convert server address to ServerConfig object
  createServerConfigFromAddress(address: string): ServerConfig;
  
  // Check if current server is from iOS Settings
  hasNativeSettingsOverride(): Promise<boolean>;
  
  // Get effective server config (iOS Settings or fallback)
  getEffectiveServerConfig(): Promise<ServerConfig>;
}
```

**Key Features**:
- React Native UserDefaults integration for iOS Settings
- Server address validation (URL format, HTTPS requirement, mDNS support)
- Custom server persistence and management
- Automatic conversion from address string to ServerConfig
- Fallback to default server if iOS Settings not configured

### 3. Settings Screen Component (Updated)

**Location**: `src/screens/SettingsScreen.tsx`

**Responsibilities**:
- Display current server from iOS Settings (read-only)
- Show language picker
- Display connection status
- Provide link/button to open iOS Settings app
- Handle user interactions for non-server settings

**Key Features**:
- Read-only server display with "Configure in iOS Settings" button
- Real-time connection status indicators
- Language selection with immediate preview
- Loading states during server validation
- Error handling with recovery options

**UI Changes**:
- Remove in-app server selector dropdown
- Add "Open iOS Settings" button that deep-links to Settings > VerbumCare
- Display current server address from iOS Settings
- Show validation status and connectivity test results

### 4. Settings Store (Zustand) - Updated

**Location**: `src/stores/settingsStore.ts`

**State Management**:
```typescript
interface SettingsStore {
  // Server configuration (from iOS Settings)
  currentServer: ServerConfig;
  availableServers: ServerConfig[];  // Includes prefilled + custom
  connectionStatus: 'connected' | 'disconnected' | 'testing' | 'switching';
  serverSource: 'ios_settings' | 'fallback';  // Where server config came from
  
  // Language settings
  currentLanguage: Language;
  availableLanguages: Language[];
  
  // UI state
  isSwitchingServer: boolean;
  switchingProgress: string;
  lastError: string | null;
  
  // Actions
  loadServerFromNativeSettings: () => Promise<void>;
  refreshServerConfig: () => Promise<void>;
  testServerConnectivity: (serverId: string) => Promise<boolean>;
  setLanguage: (language: Language) => Promise<void>;
  openIOSSettings: () => void;  // Deep link to iOS Settings
  loadSettings: () => Promise<void>;
  resetToDefaults: () => Promise<void>;
}
```

**Key Changes**:
- Remove `switchServer()` action (handled by iOS Settings)
- Add `loadServerFromNativeSettings()` to read from iOS Settings
- Add `refreshServerConfig()` to reload when app becomes active
- Add `serverSource` to track where configuration came from
- Add `openIOSSettings()` to deep-link to iOS Settings app

### 5. Backend Configuration Service - Updated

**Location**: `src/services/backendConfigService.ts`

**Core Functions**:
- Load server configuration from iOS Settings via Native Settings Service
- Test server connectivity and health
- Manage API client reconfiguration
- Handle cache clearing and restoration
- Coordinate authentication re-establishment
- Validate custom server addresses

**Key Changes**:
- Read server configuration from iOS Settings instead of in-app storage
- Add validation for custom server addresses
- Support dynamic server list (prefilled + custom)
- Handle server changes when app becomes active (AppState listener)

### 6. Enhanced API Service

**Modifications to**: `src/services/api.ts`

**New Capabilities**:
- Dynamic base URL configuration from iOS Settings
- Health check methods
- Connection testing utilities
- Graceful error handling for server switches
- Automatic reconfiguration when server changes in iOS Settings

### 7. Server Status Indicator Component

**Location**: `src/components/ServerStatusIndicator.tsx`

**Features**:
- Display current server name from iOS Settings
- Connection status visualization
- Tap to open iOS Settings (deep link)
- Consistent placement across screens
- Real-time status updates

## Data Models

### Server Configuration Model

```typescript
interface ServerConfig {
  id: string;                    // Generated from address (e.g., 'pn51', 'mac-mini', 'custom-1')
  name: string;                  // Hostname extracted from address
  displayName: string;           // User-friendly name
  baseUrl: string;              // API base URL from iOS Settings
  wsUrl: string;                // WebSocket URL (derived from baseUrl)
  description: string;          // Auto-generated or user-provided description
  isDefault: boolean;           // Whether this is the default server (pn51)
  isPrefilled: boolean;         // Whether this is a prefilled option
  isCustom: boolean;            // Whether this was added by user
  healthCheckEndpoints: string[]; // Endpoints to test
  connectionTimeout: number;     // Connection timeout (ms)
  retryAttempts: number;        // Retry attempts for connectivity
  metadata?: {                  // Optional metadata
    region?: string;
    environment?: 'production' | 'staging' | 'development';
    capabilities?: string[];
    source: 'ios_settings' | 'prefilled' | 'custom';
  };
}
```

### Native Settings Model

```typescript
interface NativeSettingsConfig {
  serverAddress: string;        // Currently selected server address
  customServers: string[];      // User-added custom server addresses
  lastValidated: Date;          // When server was last validated
  validationStatus: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    lastChecked: Date;
  };
}

interface PrefilledServer {
  address: string;
  displayName: string;
  description: string;
  isDefault: boolean;
  environment: 'production' | 'staging' | 'development';
}
```

### Settings Persistence Model

```typescript
interface PersistedSettings {
  // Server configuration now comes from iOS Settings
  serverSource: 'ios_settings' | 'fallback';
  lastKnownServer: string;      // Backup of last working server
  
  // App-specific settings
  currentLanguage: Language;
  serverHistory: {
    serverAddress: string;
    lastUsed: Date;
    successful: boolean;
  }[];
  preferences: {
    showServerIndicator: boolean;
    enableDetailedLogging: boolean;
    autoValidateOnStartup: boolean;
  };
}
```

### Connection Status Model

```typescript
interface ConnectionStatus {
  serverAddress: string;        // Server address being tested
  status: 'connected' | 'disconnected' | 'testing' | 'error';
  lastChecked: Date;
  responseTime?: number;
  errorMessage?: string;
  healthChecks: {
    endpoint: string;
    status: 'success' | 'failure';
    responseTime?: number;
    error?: string;
  }[];
  validationResult?: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
}
```

### Server Address Validation

```typescript
interface ServerValidationResult {
  isValid: boolean;
  errors: string[];            // Critical errors that prevent usage
  warnings: string[];          // Non-critical issues
  suggestions: string[];       // Suggested corrections
  normalizedAddress: string;   // Cleaned/normalized version
  detectedType: 'mDNS' | 'IP' | 'FQDN' | 'localhost';
  securityLevel: 'secure' | 'insecure' | 'unknown';
}

// Validation Rules
const VALIDATION_RULES = {
  REQUIRED_PROTOCOL: ['https'],           // Only HTTPS allowed
  ALLOWED_PORTS: [443, 8443, 3000],     // Common secure ports
  MDNS_PATTERN: /\.local$/,              // mDNS hostname pattern
  IP_PATTERN: /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  FORBIDDEN_HOSTS: ['localhost', '127.0.0.1', '0.0.0.0'],
  MAX_ADDRESS_LENGTH: 255,
  REQUIRED_PATH_SUFFIX: '/api'           // Must end with /api
};
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After reviewing all properties identified in the prework, I've identified several areas where properties can be consolidated:

**Redundancy Analysis**:
- Properties 1.2, 4.1, 4.2 all relate to state management during server switches - can be combined into a comprehensive state management property
- Properties 2.2, 2.3, 2.4 all relate to connection status updates - can be combined into a real-time status property
- Properties 5.2, 5.3, 5.4, 5.5 all relate to UI feedback during operations - can be combined into a comprehensive UI feedback property
- Properties 6.2, 6.4, 6.5, 7.4 all relate to configuration validation and error handling - can be combined

**Consolidated Properties**:

Property 1: iOS Settings integration and validation
*For any* server address configured in iOS Settings, the app should validate the address, test connectivity, and provide clear feedback on configuration status
**Validates: Requirements 1.1, 1.3, 6.2**

Property 2: Connectivity testing completeness
*For any* server connectivity test, all configured health check endpoints should be tested and results should be comprehensive
**Validates: Requirements 1.3, 7.1**

Property 3: Server configuration fallback consistency
*For any* invalid or unreachable server in iOS Settings, the system should fall back to the default server and notify the user
**Validates: Requirements 1.4, 4.3, 6.5**

Property 4: Real-time connection status updates
*For any* connection status change, all status indicators should update immediately and consistently across the application
**Validates: Requirements 2.2, 2.3, 2.4, 2.5**

Property 5: Language switching immediacy
*For any* language selection, all visible text should update immediately without requiring app restart or navigation
**Validates: Requirements 3.2, 3.5**

Property 6: Settings persistence round trip
*For any* settings change (language or preferences), persisting then loading should produce equivalent settings
**Validates: Requirements 3.3, 3.4**

Property 7: Custom server address validation
*For any* custom server address entered by the user, the validation should check URL format, security requirements, and connectivity
**Validates: Requirements 6.2, 6.5, 7.4**

Property 8: Native settings synchronization
*For any* change in iOS Settings, the app should detect and apply the new configuration when it becomes active
**Validates: Requirements 1.2, 2.1**

Property 9: Server address normalization
*For any* server address input, the system should normalize the format and ensure it meets security and connectivity requirements
**Validates: Requirements 6.2, 7.1**

Property 10: Data integrity during configuration changes
*For any* server configuration change, no user data should be lost and all pending operations should be preserved or safely queued
**Validates: Requirements 4.5, 7.5**

## Error Handling

### iOS Settings Configuration Errors

**Invalid Server Address**:
- Real-time validation of server addresses in iOS Settings
- Clear error messages for malformed URLs
- Automatic normalization of common address formats
- Fallback to default server if current address is invalid

**Custom Server Validation**:
- Comprehensive validation of user-entered server addresses
- Security checks (HTTPS requirement, port validation)
- Connectivity testing before accepting custom servers
- Persistent storage of validated custom servers

**Configuration Conflicts**:
- Handle cases where iOS Settings contains invalid data
- Graceful fallback to last known working server
- Clear user notification of configuration issues
- Deep-link to iOS Settings for correction

### Network Connectivity Issues

**Server Unreachable**:
- Timeout handling with configurable retry attempts
- Graceful fallback to default server
- Clear error messages with suggested actions
- Automatic retry with exponential backoff

**Authentication Failures**:
- Prompt for re-authentication without data loss
- Preserve user session data during auth flows
- Handle token refresh failures gracefully
- Maintain offline capabilities when possible

**mDNS Resolution Issues**:
- Extended timeouts for mDNS hostname resolution
- Fallback mechanisms for network discovery failures
- Clear indication when mDNS services are unavailable
- Alternative connection methods when possible

### Data Consistency

**Settings Synchronization**:
- Detect changes in iOS Settings when app becomes active
- Handle concurrent access to UserDefaults
- Prevent data corruption during settings updates
- Maintain consistency between iOS Settings and app state

**Cache Management**:
- Server-specific cache clearing when configuration changes
- Preserve user preferences across server changes
- Handle cache corruption gracefully
- Implement cache versioning for compatibility

**Concurrent Operations**:
- Prevent multiple simultaneous server validations
- Queue operations during configuration changes
- Handle race conditions in settings updates
- Maintain atomic operations for critical changes

## Testing Strategy

### Dual Testing Approach

The testing strategy combines unit testing and property-based testing to ensure comprehensive coverage:

**Unit Tests**:
- Specific server switching scenarios
- Language switching edge cases
- Error handling for known failure modes
- UI component rendering and interaction
- Configuration loading and validation

**Property-Based Tests**:
- Universal properties across all server configurations
- Language switching behavior across all supported languages
- Connection status updates under various network conditions
- Data preservation during server transitions
- Configuration validation with generated invalid inputs

### Property-Based Testing Framework

**Framework**: fast-check (JavaScript/TypeScript property-based testing library)
**Configuration**: Minimum 100 iterations per property test
**Timeout**: 30 seconds per property test to handle network operations

### Test Categories

**iOS Settings Integration Tests**:
- UserDefaults read/write operations
- Settings validation and normalization
- Deep-linking to iOS Settings app
- AppState change detection and configuration reload

**Server Address Validation Tests**:
- URL format validation (protocol, hostname, path)
- Security requirement enforcement (HTTPS only)
- mDNS hostname pattern matching
- Custom server address persistence

**Network Simulation Tests**:
- Various network conditions (slow, intermittent, offline)
- Server response simulation (success, failure, timeout)
- mDNS resolution failures and timeouts
- Authentication scenarios with different servers

**State Management Tests**:
- Configuration changes from iOS Settings
- State persistence across app restarts
- Cache management during server changes
- Error state recovery and fallback behavior

**UI Integration Tests**:
- Settings screen display of current server
- Status indicator updates across screens
- Deep-link button functionality
- Loading state management during validation

### Test Data Generation

**Server Address Generator**:
```typescript
const serverAddressArbitrary = fc.oneof(
  // Valid HTTPS addresses
  fc.record({
    protocol: fc.constant('https'),
    hostname: fc.oneof(
      fc.constant('verbumcare-lab.local'),
      fc.constant('verbumcaremac-mini'),
      fc.constant('verbumcarenomac-mini.local'),
      fc.domain(),
      fc.ipV4()
    ),
    port: fc.option(fc.integer({ min: 443, max: 8443 })),
    path: fc.constant('/api')
  }).map(({ protocol, hostname, port, path }) => 
    `${protocol}://${hostname}${port ? `:${port}` : ''}${path}`
  ),
  
  // Invalid addresses for negative testing
  fc.oneof(
    fc.webUrl().filter(url => !url.startsWith('https')), // Non-HTTPS
    fc.string().filter(s => !s.includes('://')),          // Malformed
    fc.constant('localhost:3000/api'),                    // Forbidden localhost
  )
);

const nativeSettingsArbitrary = fc.record({
  serverAddress: serverAddressArbitrary,
  customServers: fc.array(serverAddressArbitrary, { maxLength: 5 }),
  lastValidated: fc.date(),
  validationStatus: fc.record({
    isValid: fc.boolean(),
    errors: fc.array(fc.string(), { maxLength: 3 }),
    warnings: fc.array(fc.string(), { maxLength: 3 }),
    lastChecked: fc.date()
  })
});
```

**Network Condition Generator**:
```typescript
const networkConditionArbitrary = fc.record({
  latency: fc.integer({ min: 0, max: 5000 }),
  packetLoss: fc.float({ min: 0, max: 0.5 }),
  bandwidth: fc.integer({ min: 1, max: 1000 }),
  isOnline: fc.boolean(),
  mdnsResolution: fc.boolean(), // Whether mDNS resolution works
  dnsLatency: fc.integer({ min: 0, max: 2000 })
});
```

### Testing Requirements

Each property-based test must:
- Include explicit comments referencing the design document property
- Use the format: `**Feature: backend-switching-settings, Property {number}: {property_text}**`
- Run a minimum of 100 iterations
- Handle async operations properly with timeouts
- Generate realistic test data that matches production scenarios
- Include proper cleanup to prevent test interference