# Requirements Document

## Introduction

This feature transforms the existing BLE (Bluetooth Low Energy) infrastructure in VerbumCare from a single-device system into a modular, extensible multi-device platform. Currently, the system supports only the A&D UA-651BLE blood pressure monitor with hardcoded logic. This enhancement creates a plugin-based architecture that supports the existing BP monitor, adds the A&D UT-201BLE Plus thermometer, and provides a framework for easily adding future BLE medical devices without core system modifications.

## Glossary

- **BLE_Service**: The centralized Bluetooth Low Energy service that manages device discovery, connection, and data processing
- **Device_Plugin**: Modular component that encapsulates device-specific logic for connection, parsing, and data handling
- **Device_Registry**: Central registry that manages available device plugins and routes device connections to appropriate handlers
- **Device_Detector**: Component responsible for identifying device types during scanning and matching them to appropriate plugins
- **Reading_Handler**: Generic interface for processing measurement data from any BLE medical device
- **Temperature_Reading**: Data structure containing temperature measurement from thermometer device
- **BP_Reading**: Existing data structure for blood pressure measurements from BP monitor
- **Device_Context**: Patient context information associated with BLE device usage
- **Multi_Device_Session**: A patient care session where multiple BLE devices may be used concurrently
- **Device_Pairing**: Process of establishing trusted connection with BLE devices for future automatic connections
- **Plugin_Interface**: Standardized interface that all device plugins must implement for consistent integration

## Requirements

### Requirement 1: Multi-Device BLE Architecture

**User Story:** As a healthcare provider, I want to use both blood pressure monitors and thermometers via BLE during patient care, so that I can capture comprehensive vital signs efficiently without manual data entry.

#### Acceptance Criteria

1. WHEN multiple BLE device types are available, THE BLE_Service SHALL manage connections to both blood pressure monitors and thermometers simultaneously
2. WHEN a device broadcasts measurement data, THE BLE_Service SHALL route the data to the appropriate parser based on device type and service UUID
3. WHEN both devices are connected, THE BLE_Service SHALL maintain independent connection states for each device type
4. WHEN a device disconnects after transmitting data, THE BLE_Service SHALL continue monitoring for other device types
5. WHERE multiple devices of the same type are present, THE BLE_Service SHALL connect to the first available device that matches the expected service profile

### Requirement 2: A&D UT-201BLE Plus Thermometer Support

**User Story:** As a nurse, I want to capture temperature readings from the A&D UT-201BLE Plus thermometer automatically, so that temperature data is recorded accurately without manual transcription errors.

#### Acceptance Criteria

1. WHEN the UT-201BLE Plus thermometer completes a measurement, THE BLE_Service SHALL detect the device broadcast and establish connection
2. WHEN connected to the thermometer, THE BLE_Service SHALL read temperature data using the Health Thermometer Service (0x1809)
3. WHEN temperature data is received, THE BLE_Service SHALL parse the IEEE 11073 SFLOAT format and extract temperature in Celsius
4. WHEN temperature reading is valid (within physiological range 30-45°C), THE BLE_Service SHALL create a Temperature_Reading object
5. WHEN temperature reading is parsed successfully, THE BLE_Service SHALL notify all registered listeners with the temperature data

### Requirement 3: Device Type Detection and Management

**User Story:** As a system administrator, I want the BLE system to automatically identify different device types, so that the correct parsing and handling logic is applied without manual configuration.

#### Acceptance Criteria

1. WHEN scanning for devices, THE BLE_Service SHALL identify device types by service UUID and device name patterns
2. WHEN a blood pressure monitor is detected (service UUID 0x1810), THE BLE_Service SHALL apply BP-specific connection and parsing logic
3. WHEN a thermometer is detected (service UUID 0x1809), THE BLE_Service SHALL apply thermometer-specific connection and parsing logic
4. WHEN device identity verification fails, THE BLE_Service SHALL reject the connection and continue scanning
5. WHEN a device is successfully verified, THE BLE_Service SHALL add it to the paired devices list with device type metadata

### Requirement 4: Concurrent Device Operation

**User Story:** As a healthcare provider, I want to use both BP monitors and thermometers during the same patient encounter, so that I can efficiently capture all required vital signs without switching between different workflows.

#### Acceptance Criteria

1. WHEN both device types are paired, THE BLE_Service SHALL scan for and accept connections from either device type
2. WHEN one device is connected and transmitting, THE BLE_Service SHALL continue monitoring for other device types
3. WHEN multiple readings are received within a short timeframe, THE BLE_Service SHALL process each reading independently
4. WHEN readings from different device types are received, THE BLE_Service SHALL route each to appropriate UI components
5. WHEN a device completes transmission and disconnects, THE BLE_Service SHALL resume scanning for all supported device types

### Requirement 5: Patient Context Integration

**User Story:** As a nurse, I want temperature readings to be automatically associated with the current patient context, so that vital signs are recorded for the correct patient without additional steps.

#### Acceptance Criteria

1. WHEN a temperature reading is received in a patient context (PatientInfoScreen or VitalsCaptureScreen), THE BLE_Service SHALL associate the reading with the current patient
2. WHEN temperature data is captured, THE System SHALL save it to the session vitals store with timestamp and device metadata
3. WHEN temperature reading is saved to session, THE System SHALL attempt to persist it to the backend database immediately
4. WHEN backend persistence succeeds, THE System SHALL mark the reading as synchronized
5. WHEN backend persistence fails, THE System SHALL retain the reading in local storage for later synchronization

### Requirement 6: User Interface Integration

**User Story:** As a healthcare provider, I want to see temperature readings appear automatically in the vitals capture interface, so that I can review and confirm the data before final submission.

#### Acceptance Criteria

1. WHEN a temperature reading is received, THE VitalsCaptureScreen SHALL auto-populate the temperature field
2. WHEN temperature data is auto-populated, THE System SHALL provide visual feedback indicating BLE data source
3. WHEN multiple temperature readings are received rapidly, THE System SHALL use the most recent reading
4. WHEN temperature reading is outside normal range (30-45°C), THE System SHALL display a validation warning
5. WHEN user manually overrides BLE temperature data, THE System SHALL respect the manual entry and disable auto-population for that field

### Requirement 7: Device Pairing and Management

**User Story:** As a healthcare provider, I want thermometers to be automatically paired after first successful connection, so that subsequent uses don't require manual pairing steps.

#### Acceptance Criteria

1. WHEN a thermometer connects successfully for the first time, THE BLE_Service SHALL add it to the paired devices list
2. WHEN a previously paired thermometer broadcasts, THE BLE_Service SHALL accept the connection without identity verification
3. WHEN managing paired devices, THE System SHALL display both BP monitors and thermometers with device type indicators
4. WHEN unpairing a device, THE BLE_Service SHALL remove it from storage and require re-verification for future connections
5. WHEN paired devices list is accessed, THE System SHALL show last connected timestamp for each device

### Requirement 8: Error Handling and Resilience

**User Story:** As a healthcare provider, I want the BLE system to handle device connection issues gracefully, so that temporary connectivity problems don't disrupt my workflow.

#### Acceptance Criteria

1. WHEN a thermometer connection fails, THE BLE_Service SHALL log the error and resume scanning without affecting BP monitor functionality
2. WHEN invalid temperature data is received, THE BLE_Service SHALL discard the reading and continue monitoring
3. WHEN a device disconnects unexpectedly, THE BLE_Service SHALL clean up the connection and restart scanning
4. WHEN Bluetooth permissions are denied, THE BLE_Service SHALL provide clear error messaging and graceful degradation
5. WHEN multiple connection attempts fail, THE BLE_Service SHALL implement exponential backoff to prevent resource exhaustion

### Requirement 9: Data Validation and Safety

**User Story:** As a healthcare provider, I want temperature readings to be validated for physiological accuracy, so that obviously incorrect measurements are flagged before being recorded.

#### Acceptance Criteria

1. WHEN temperature reading is parsed, THE System SHALL validate it falls within physiological range (30.0-45.0°C)
2. WHEN temperature reading is outside normal range, THE System SHALL flag it as potentially invalid but still display it
3. WHEN temperature reading contains sentinel values (e.g., 2047 in SFLOAT), THE System SHALL reject the reading as invalid
4. WHEN temperature precision is available, THE System SHALL preserve decimal precision up to 0.1°C
5. WHEN temperature reading timestamp is generated, THE System SHALL use device connection time for accuracy

### Requirement 10: Backward Compatibility

**User Story:** As an existing user, I want the current blood pressure monitor functionality to continue working unchanged, so that adding thermometer support doesn't disrupt established workflows.

#### Acceptance Criteria

1. WHEN only BP monitors are used, THE BLE_Service SHALL function identically to the current implementation
2. WHEN existing BP monitor pairing data exists, THE System SHALL preserve and continue using it
3. WHEN BP readings are received, THE System SHALL process them using the existing parsing logic without modification
4. WHEN thermometer support is added, THE System SHALL not modify existing BP-related APIs or data structures
5. WHEN users don't have thermometers, THE System SHALL operate normally without any functional degradation