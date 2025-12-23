# Requirements Document

## Introduction

This feature enables backend server configuration through the native iOS Settings app and provides language preference management within the VerbumCare iPad application. Users will be able to configure server addresses through iOS Settings with three prefilled options (pn51, Mac Mini, Mac Mini Tailscale) plus custom server entry capability, while managing language preferences and viewing connection status through the in-app settings screen.

## Glossary

- **Backend Server**: The remote server hosting the VerbumCare API, database, and AI services
- **iOS Settings**: The native iPad Settings app where users configure VerbumCare server addresses
- **pn51 Server**: The legacy production server (verbumcare-lab.local) - default option
- **Mac Mini Server**: The current production backend server (verbumcaremac-mini)
- **Mac Mini Tailscale**: Mac Mini server accessible via Tailscale (verbumcarenomac-mini.local)
- **Custom Server**: User-added server address with validation and persistence
- **Settings Screen**: In-app interface for language preferences and connection status (read-only server display)
- **Server Address**: The complete URL used for API communication with the backend
- **Connection Status**: Real-time indicator of connectivity to the configured backend server
- **Native Settings Service**: Bridge service between iOS Settings and the VerbumCare app

## Requirements

### Requirement 1

**User Story:** As a healthcare administrator, I want to configure backend server addresses through iOS Settings, so that I can easily switch between servers using the native iPad interface and add custom servers as needed.

#### Acceptance Criteria

1. WHEN a user opens iOS Settings > VerbumCare THEN the system SHALL display a dropdown with three prefilled server options: pn51 (default), Mac Mini, and Mac Mini Tailscale
2. WHEN a user selects a prefilled server option THEN the system SHALL immediately update the server configuration and validate connectivity
3. WHEN a user selects "Add Custom Server" THEN the system SHALL provide a text field for manual server address entry with URL keyboard and validation
4. WHEN a custom server address is entered THEN the system SHALL validate the address format, security requirements (HTTPS), and connectivity before accepting
5. WHEN a valid custom server is added THEN the system SHALL persist it to the dropdown list for future selection and test its connectivity

### Requirement 2

**User Story:** As a clinical user, I want to see which backend server I'm currently connected to and easily access iOS Settings to change it, so that I can verify I'm using the correct system for my workflow.

#### Acceptance Criteria

1. WHEN the app starts THEN the system SHALL read the server configuration from iOS Settings and display the current server address in the in-app settings screen
2. WHEN the connection status changes THEN the system SHALL update the server status indicator in real-time across all screens
3. WHEN connectivity is lost THEN the system SHALL display a clear offline indicator with the last known server address
4. WHEN the app becomes active after iOS Settings changes THEN the system SHALL detect the new configuration and update accordingly
5. WHEN viewing the in-app settings screen THEN the system SHALL provide an "Open iOS Settings" button that deep-links to Settings > VerbumCare

### Requirement 3

**User Story:** As a multilingual user, I want to change my language preference from a centralized settings screen, so that I can easily manage my app configuration in one place.

#### Acceptance Criteria

1. WHEN a user accesses the settings screen THEN the system SHALL display available language options (Japanese, English, Traditional Chinese)
2. WHEN a user selects a different language THEN the system SHALL update the interface language immediately
3. WHEN a language change occurs THEN the system SHALL persist the preference to local storage
4. WHEN the app restarts THEN the system SHALL load the previously selected language preference
5. WHEN language changes THEN the system SHALL update all visible text without requiring app restart

### Requirement 4

**User Story:** As a system administrator, I want the app to handle server configuration changes gracefully, so that users don't lose their work or experience data corruption when server addresses are updated in iOS Settings.

#### Acceptance Criteria

1. WHEN a server configuration changes in iOS Settings THEN the system SHALL detect the change when the app becomes active and validate the new server
2. WHEN switching to a new server THEN the system SHALL clear server-specific cached data while preserving user preferences and language settings
3. WHEN authentication fails on the new server THEN the system SHALL prompt for re-login without losing local data
4. WHEN the configured server is unreachable THEN the system SHALL fall back to the default server (pn51) and notify the user
5. WHEN reverting to a previous server THEN the system SHALL restore the appropriate cached data if available

### Requirement 5

**User Story:** As a clinical user, I want clear visual feedback about server connectivity and configuration status, so that I understand the current system state and can take appropriate action if needed.

#### Acceptance Criteria

1. WHEN a server configuration is being validated THEN the system SHALL display a loading indicator with validation progress information
2. WHEN testing server connectivity THEN the system SHALL show the connection test status in real-time with response times and health check results
3. WHEN server validation completes successfully THEN the system SHALL display a confirmation with the server name and connection status
4. WHEN server validation fails THEN the system SHALL display specific error information, suggested actions, and a button to open iOS Settings
5. WHEN validation is in progress THEN the system SHALL show appropriate loading states while maintaining app functionality

### Requirement 6

**User Story:** As a developer, I want the server address validation and configuration to be robust and maintainable, so that users can safely add custom servers while maintaining security and reliability.

#### Acceptance Criteria

1. WHEN the app initializes THEN the system SHALL define three prefilled server options with proper validation rules and default fallback behavior
2. WHEN a custom server address is entered THEN the system SHALL validate URL format, enforce HTTPS requirement, and check for forbidden addresses (localhost, etc.)
3. WHEN adding custom servers THEN the system SHALL support mDNS hostnames, IP addresses, and FQDNs with appropriate timeout and retry settings
4. WHEN server validation fails THEN the system SHALL provide clear error messages with specific validation failures and suggested corrections
5. WHEN server configurations are corrupted or invalid THEN the system SHALL log errors, fall back to the default server (pn51), and notify the user

### Requirement 7

**User Story:** As a quality assurance tester, I want to verify iOS Settings integration and server validation functionality works correctly, so that I can ensure reliable server configuration and connectivity.

#### Acceptance Criteria

1. WHEN testing server connectivity THEN the system SHALL perform comprehensive health checks including API endpoints, authentication, and WebSocket connections
2. WHEN simulating iOS Settings changes THEN the system SHALL detect configuration updates when the app becomes active and handle them appropriately
3. WHEN testing with invalid server addresses THEN the system SHALL provide clear validation errors and prevent acceptance of insecure or malformed addresses
4. WHEN testing custom server persistence THEN the system SHALL maintain user-added servers across app restarts and iOS Settings interactions
5. WHEN verifying data integrity THEN the system SHALL ensure no data loss occurs during server configuration changes and maintain proper fallback behavior

### Requirement 8

**User Story:** As a system integrator, I want the iOS Settings Bundle to be properly configured with the three prefilled server options and custom entry capability, so that users have a native iOS experience for server configuration.

#### Acceptance Criteria

1. WHEN a user opens iOS Settings > VerbumCare THEN the system SHALL display a "Backend Server" dropdown with pn51 as the default selection
2. WHEN the dropdown is opened THEN the system SHALL show four options: "pn51 (Default)", "Mac Mini", "Mac Mini Tailscale", and "Add Custom Server..."
3. WHEN "Add Custom Server..." is selected THEN the system SHALL reveal a text input field with URL keyboard type and proper validation
4. WHEN a custom server address is entered and valid THEN the system SHALL add it to the dropdown list for future selection
5. WHEN the iOS Settings configuration is accessed THEN the system SHALL provide proper titles, descriptions, and default values for all settings fields