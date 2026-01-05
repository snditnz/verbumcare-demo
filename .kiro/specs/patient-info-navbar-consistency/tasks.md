# Implementation Plan: Patient Info Navigation Bar Consistency

## Overview

This implementation plan standardizes navigation bar consistency across all screens accessible from the Patient Information screen. Each task updates a specific screen to follow the standard header pattern established in the design document.

## Status: ✅ COMPLETE

All tasks have been implemented and verified. All screens now follow the standard header pattern with consistent structure, patient name display, and status indicators.

## Tasks

- [x] 1. Update ADLVoiceScreen header ✅
  - Add ServerStatusIndicator import from `@components/ServerStatusIndicator`
  - Add `<ServerStatusIndicator compact />` to headerRight section before LanguageToggle
  - Verify header structure matches standard pattern
  - _Requirements: 3.1, 3.3, 6.1_

- [x] 2. Update FallRiskAssessmentScreen header ✅
  - Add ServerStatusIndicator import from `@components/ServerStatusIndicator`
  - Add `<ServerStatusIndicator compact />` to headerRight section before LanguageToggle
  - Verify header structure matches standard pattern
  - _Requirements: 3.1, 3.3, 6.2_

- [x] 3. Update KihonChecklistScreen header ✅
  - Add ServerStatusIndicator import from `@components/ServerStatusIndicator`
  - Add `<ServerStatusIndicator compact />` to headerRight section before LanguageToggle
  - Verify header structure matches standard pattern
  - _Requirements: 3.1, 3.3, 6.3_

- [x] 4. Update ReviewConfirmScreen header ✅
  - [x] 4.1 Add patient name display to headerCenter
    - Add currentPatient check and display patient name above screen title
    - Use format: `{family_name} {given_name}`
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 4.2 Add ServerStatusIndicator to headerRight
    - Add ServerStatusIndicator import
    - Add `<ServerStatusIndicator compact />` before LanguageToggle
    - _Requirements: 3.1, 3.3, 6.4_

- [x] 5. Update GeneralVoiceRecorderScreen header ✅
  - [x] 5.1 Restructure header to standard three-section layout
    - Change header structure to use headerLeft, headerCenter, headerRight
    - Move HeaderNav to headerLeft section
    - _Requirements: 1.1, 1.2_
  - [x] 5.2 Add patient name to headerCenter
    - Display patient name from context when patient context exists
    - Keep screen title below patient name
    - _Requirements: 2.1, 2.2, 6.5_

- [x] 6. Update ClinicalNotesScreen header ✅
  - [x] 6.1 Restructure header to standard layout
    - Replace `headerTop` with standard `header` containing headerLeft, headerCenter, headerRight
    - Move HeaderNav to headerLeft
    - Move title and patient name to headerCenter
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 6.2 Ensure status indicators are in correct order
    - Verify ServerStatusIndicator comes before LanguageToggle in headerRight
    - _Requirements: 3.1, 6.6_

- [x] 7. Checkpoint - Verify all header updates ✅
  - All tests pass
  - All screens have consistent header layout
  - Patient name displays correctly when patient context exists
  - ServerStatusIndicator appears on all screens

- [x] 8. Write unit tests for header consistency ✅
  - Test that each updated screen renders ServerStatusIndicator
  - Test that patient name displays when currentPatient exists
  - Test that patient name is omitted when currentPatient is null
  - _Requirements: 1.3, 2.1, 2.4, 3.1_

## Verification

All tests pass:
```
✅ ADLVoiceScreen has ServerStatusIndicator
✅ FallRiskAssessmentScreen has ServerStatusIndicator
✅ KihonChecklistScreen has ServerStatusIndicator
✅ ReviewConfirmScreen has ServerStatusIndicator
✅ GeneralVoiceRecorderScreen has ServerStatusIndicator
✅ ClinicalNotesScreen has ServerStatusIndicator
✅ ReviewConfirmScreen displays patient name in header
✅ GeneralVoiceRecorderScreen displays patient name in header
✅ ClinicalNotesScreen displays patient name in header
✅ ReviewConfirmScreen conditionally renders patient name
✅ GeneralVoiceRecorderScreen conditionally renders patient name
✅ All screens have consistent header structure (headerLeft, headerCenter, headerRight)
✅ All screens have proper flexDirection and gap in headerRight
```

## Notes

- All tasks are required for comprehensive coverage
- Each task references specific requirements for traceability
- The checkpoint task ensures incremental validation
- Focus on minimal changes to achieve consistency without breaking existing functionality
