# Implementation Plan: Multi-Device BLE Support

## Overview

This implementation transforms the existing single-device BLE system into a modular, plugin-based architecture that supports multiple BLE medical devices. The approach migrates existing BP monitor functionality to a plugin while adding thermometer support and creating a framework for future device types.

## Tasks

- [x] 1. Create plugin interface and core architecture
  - Define DevicePlugin interface with all required methods
  - Create DeviceRegistry class for plugin management
  - Create DeviceReading base interface and specific reading types
  - Set up plugin discovery and registration system
  - _Requirements: 1.1, 1.2, 2.1, 2.2_

- [ ]* 1.1 Write property test for plugin interface compliance
  - **Property 1: Plugin Interface Compliance**
  - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

- [ ]* 1.2 Write property test for plugin registration and discovery
  - **Property 2: Plugin Registration and Discovery**
  - **Validates: Requirements 1.2, 12.2**

- [x] 2. Implement enhanced BLE types and data structures
  - Extend existing BLE types to support multiple device types
  - Create TemperatureReading interface
  - Enhance PairedDevice interface with plugin metadata
  - Add PluginRegistration interface
  - Update BLE constants for thermometer support
  - _Requirements: 4.1, 4.5, 8.1_

- [ ] 3. Create Blood Pressure Monitor Plugin
  - [x] 3.1 Implement BPMonitorPlugin class
    - Migrate existing device identification logic
    - Migrate existing connection and parsing logic
    - Implement plugin interface methods
    - Preserve all existing BP parsing functionality
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ]* 3.2 Write property test for BP plugin device identification
    - **Property 3: Device-to-Plugin Matching (BP specific)**
    - **Validates: Requirements 3.2**

  - [ ]* 3.3 Write property test for BP plugin data parsing
    - **Property 12: BP Monitor Backward Compatibility (parsing)**
    - **Validates: Requirements 3.3, 11.3**

  - [ ]* 3.4 Write property test for BP plugin validation
    - **Property 6: Device-Specific Data Validation (BP)**
    - **Validates: Requirements 3.4**

- [ ] 4. Create Thermometer Plugin
  - [x] 4.1 Implement ThermometerPlugin class
    - Implement device identification for UT-201BLE Plus
    - Implement Health Thermometer Service connection
    - Implement IEEE 11073 SFLOAT/FLOAT temperature parsing
    - Implement temperature validation (30.0-45.0°C)
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 4.2 Write property test for thermometer device identification
    - **Property 3: Device-to-Plugin Matching (thermometer specific)**
    - **Validates: Requirements 4.1**

  - [ ]* 4.3 Write property test for thermometer data parsing
    - **Property 6: Device-Specific Data Validation (thermometer)**
    - **Validates: Requirements 4.3, 4.4**

  - [ ]* 4.4 Write property test for temperature reading structure
    - **Property 17: Precision Preservation**
    - **Validates: Requirements 4.5, 10.4**

- [ ] 5. Enhance core BLE service for plugin support
  - [x] 5.1 Modify BLE service to use plugin registry
    - Add plugin registration methods
    - Update device scanning to work with multiple plugins
    - Implement device-to-plugin matching logic
    - Update connection handling for plugin-based architecture
    - _Requirements: 1.3, 1.5, 5.1_

  - [ ]* 5.2 Write property test for device-to-plugin matching
    - **Property 3: Device-to-Plugin Matching**
    - **Validates: Requirements 1.3, 1.5**

  - [x] 5.3 Update reading processing for multiple device types
    - Modify reading callbacks to handle different reading types
    - Implement reading type routing
    - Update debouncing logic for multi-device scenarios
    - _Requirements: 5.3, 5.4_

  - [ ]* 5.4 Write property test for multi-device session management
    - **Property 5: Multi-Device Session Management**
    - **Validates: Requirements 5.1, 5.2, 5.3**

  - [ ]* 5.5 Write property test for reading type routing
    - **Property 7: Reading Type Routing**
    - **Validates: Requirements 5.4, 7.1**

- [x] 6. Update UI components for multi-device support
  - [x] 6.1 Enhance VitalsCaptureScreen
    - Update BLE reading handler to support multiple reading types
    - Add temperature field auto-population
    - Update manual override logic for different field types
    - Add device type indicators in UI
    - _Requirements: 7.1, 7.2, 7.5_

  - [x] 6.2 Enhance PatientInfoScreen
    - Update BLE reading handler for temperature readings
    - Update vitals display to show temperature data
    - Update toast notifications for different device types
    - _Requirements: 6.1, 6.2, 7.2_

  - [ ]* 6.3 Write property test for patient context association
    - **Property 8: Patient Context Association**
    - **Validates: Requirements 6.1, 6.2**

  - [ ]* 6.4 Write property test for manual override precedence
    - **Property 14: Manual Override Precedence**
    - **Validates: Requirements 7.5**

- [ ] 7. Implement enhanced error handling and resilience
  - [ ] 7.1 Create PluginErrorHandler class
    - Implement standardized error handling across plugins
    - Add error isolation to prevent plugin failures from affecting others
    - Implement connection resilience and recovery
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ]* 7.2 Write property test for error isolation
    - **Property 11: Error Isolation**
    - **Validates: Requirements 9.1, 9.2**

  - [ ] 7.3 Implement exponential backoff for connection failures
    - Add retry logic with exponential backoff
    - Implement per-device-type failure tracking
    - _Requirements: 9.5_

  - [ ]* 7.4 Write property test for connection resilience
    - **Property 18: Connection Resilience**
    - **Validates: Requirements 9.3**

  - [ ]* 7.5 Write property test for exponential backoff
    - **Property 19: Exponential Backoff**
    - **Validates: Requirements 9.5**

- [ ] 8. Implement backend persistence for temperature data
  - [ ] 8.1 Update session store for temperature readings
    - Add temperature_celsius field to SessionVitals
    - Update vitals persistence logic for temperature data
    - Add device reading metadata tracking
    - _Requirements: 6.2, 6.3_

  - [ ] 8.2 Update API service for temperature persistence
    - Ensure recordVitals API supports temperature data
    - Update vitals data structure if needed
    - Test temperature data persistence to backend
    - _Requirements: 6.3, 6.4_

  - [ ]* 8.3 Write property test for backend persistence
    - **Property 9: Backend Persistence with Offline Resilience**
    - **Validates: Requirements 6.3, 6.4, 6.5**

- [ ] 9. Implement device pairing management for multiple device types
  - [ ] 9.1 Update pairing data structure and storage
    - Migrate existing BP pairing data to new format
    - Add device type and plugin metadata to pairing data
    - Update pairing storage and retrieval logic
    - _Requirements: 8.1, 11.2_

  - [ ]* 9.2 Write property test for device pairing management
    - **Property 10: Device Pairing Management**
    - **Validates: Requirements 8.1, 8.2**

  - [ ]* 9.3 Write property test for data migration consistency
    - **Property 13: Data Migration Consistency**
    - **Validates: Requirements 11.2**

- [ ] 10. Add data validation and safety features
  - [ ] 10.1 Implement physiological range validation
    - Add device-specific validation ranges
    - Implement out-of-range warning system
    - Add sentinel value detection and rejection
    - _Requirements: 10.1, 10.2, 10.3_

  - [ ]* 10.2 Write property test for physiological range validation
    - **Property 15: Physiological Range Validation**
    - **Validates: Requirements 10.2, 7.4**

  - [ ]* 10.3 Write property test for sentinel value rejection
    - **Property 16: Sentinel Value Rejection**
    - **Validates: Requirements 10.3**

- [ ] 11. Checkpoint - Test backward compatibility
  - Ensure all tests pass, ask the user if questions arise.
  - Verify BP monitor functionality is identical to current implementation
  - Test that existing workflows continue unchanged
  - _Requirements: 11.1, 11.4, 11.5_

- [ ]* 11.1 Write comprehensive property test for BP backward compatibility
  - **Property 12: BP Monitor Backward Compatibility**
  - **Validates: Requirements 3.1, 3.5, 11.1, 11.3**

- [ ] 12. Integration testing and plugin extensibility validation
  - [ ] 12.1 Test multi-device scenarios
    - Test concurrent BP and thermometer usage
    - Test device switching and reconnection
    - Test reading processing from multiple devices
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ] 12.2 Validate plugin extensibility
    - Create mock plugin for testing extensibility
    - Test plugin registration without core code changes
    - Verify custom reading types work correctly
    - _Requirements: 12.1, 12.3_

  - [ ]* 12.3 Write property test for plugin extensibility
    - **Property 4: Plugin Extensibility**
    - **Validates: Requirements 1.1, 12.1**

  - [ ]* 12.4 Write property test for custom reading type support
    - **Property 20: Custom Reading Type Support**
    - **Validates: Requirements 12.3**

- [ ] 13. Final integration and testing
  - [ ] 13.1 End-to-end testing with physical devices
    - Test with actual A&D UA-651BLE blood pressure monitor
    - Test with actual A&D UT-201BLE Plus thermometer (if available)
    - Test patient workflow with both device types
    - _Requirements: All requirements_

  - [ ] 13.2 Performance and stability testing
    - Test rapid device connections and disconnections
    - Test memory usage with multiple device types
    - Test long-running sessions with multiple devices
    - _Requirements: 9.3, 9.5_

- [ ] 14. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Verify all property-based tests are passing
  - Confirm backward compatibility is maintained
  - Validate new thermometer functionality works correctly

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation maintains backward compatibility while adding new functionality
- Plugin architecture enables easy addition of future device types