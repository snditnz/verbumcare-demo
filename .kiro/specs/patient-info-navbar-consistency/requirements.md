# Requirements Document

## Introduction

This document defines the requirements for standardizing navigation bar consistency across all screens accessible from the Patient Information screen. Currently, there are significant inconsistencies in header layout, components displayed, and styling across these sub-screens. The goal is to establish a consistent user experience by using the PatientInfoScreen as the baseline pattern.

## Glossary

- **Navigation_Bar**: The header component at the top of each screen containing navigation controls, title, and status indicators
- **HeaderNav_Component**: The reusable component (`HeaderNav.tsx`) providing Back and Home navigation buttons
- **Patient_Context_Bar**: The header section displaying patient name and screen title
- **Status_Indicators**: Components showing system status (BLEIndicator, ServerStatusIndicator, LanguageToggle)
- **Sub_Screen**: Any screen navigated to from the PatientInfoScreen (VitalsCapture, ADLVoice, MedicineAdmin, etc.)

## Requirements

### Requirement 1: Consistent Header Structure

**User Story:** As a clinical staff member, I want all patient-related screens to have a consistent header layout, so that I can quickly orient myself and navigate efficiently.

#### Acceptance Criteria

1. THE Navigation_Bar SHALL use a three-section layout: headerLeft, headerCenter, and headerRight
2. THE headerLeft section SHALL contain the HeaderNav_Component with Back and Home buttons
3. THE headerCenter section SHALL display the patient name (when applicable) and screen title
4. THE headerRight section SHALL contain status indicators in consistent order
5. WHEN navigating between Sub_Screens, THE Navigation_Bar layout SHALL remain visually consistent

### Requirement 2: Patient Name Display

**User Story:** As a nurse, I want to always see the current patient's name in the header, so that I can confirm I'm viewing the correct patient's information.

#### Acceptance Criteria

1. WHEN a Sub_Screen is associated with a patient context, THE Navigation_Bar SHALL display the patient name in headerCenter
2. THE patient name SHALL be displayed above the screen title in a consistent format
3. THE patient name format SHALL be: `{family_name} {given_name}` (Japanese order)
4. WHEN no patient context exists (e.g., global screens), THE Navigation_Bar SHALL omit the patient name

### Requirement 3: Status Indicators Consistency

**User Story:** As a clinical staff member, I want to see relevant status indicators on all screens, so that I can monitor system connectivity and device status.

#### Acceptance Criteria

1. THE headerRight section SHALL display status indicators in this order: ServerStatusIndicator, LanguageToggle
2. WHEN a screen involves BLE device interaction, THE BLEIndicator SHALL be displayed before ServerStatusIndicator
3. THE ServerStatusIndicator SHALL use compact mode (`compact` prop) on all Sub_Screens
4. THE LanguageToggle SHALL always be the rightmost indicator

### Requirement 4: HeaderNav Component Usage

**User Story:** As a developer, I want all screens to use the shared HeaderNav component, so that navigation behavior is consistent and maintainable.

#### Acceptance Criteria

1. THE Sub_Screens SHALL use the HeaderNav_Component for navigation controls
2. WHEN a screen requires custom back behavior, THE HeaderNav_Component SHALL accept an `onBack` prop
3. WHEN a screen requires custom back label, THE HeaderNav_Component SHALL accept a `backLabel` prop
4. THE HeaderNav_Component SHALL always display the Home button by default

### Requirement 5: Header Styling Consistency

**User Story:** As a user, I want all headers to look the same, so that the app feels cohesive and professional.

#### Acceptance Criteria

1. THE Navigation_Bar SHALL use consistent padding: `paddingHorizontal: SPACING.lg`, `paddingVertical: SPACING.sm`
2. THE Navigation_Bar SHALL have a bottom border: `borderBottomWidth: 1`, `borderBottomColor: COLORS.border`
3. THE Navigation_Bar background SHALL be `COLORS.surface`
4. THE screen title SHALL use `TYPOGRAPHY.fontSize.lg` and `TYPOGRAPHY.fontWeight.semibold`
5. THE patient name SHALL use `TYPOGRAPHY.fontSize.md` and `COLORS.text.primary`

### Requirement 6: Screens Requiring Updates

**User Story:** As a developer, I want a clear list of screens that need updates, so that I can systematically apply the changes.

#### Acceptance Criteria

1. THE ADLVoiceScreen SHALL be updated to include ServerStatusIndicator
2. THE FallRiskAssessmentScreen SHALL be updated to include ServerStatusIndicator
3. THE KihonChecklistScreen SHALL be updated to include ServerStatusIndicator
4. THE ReviewConfirmScreen SHALL be updated to include patient name and ServerStatusIndicator
5. THE GeneralVoiceRecorderScreen SHALL be updated to display patient name in headerCenter (when patient context exists)
6. THE ClinicalNotesScreen SHALL be updated to use standard header layout structure
