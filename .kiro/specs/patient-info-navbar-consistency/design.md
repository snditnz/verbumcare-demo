# Design Document: Patient Info Navigation Bar Consistency

## Overview

This design document outlines the approach for standardizing navigation bar consistency across all screens accessible from the Patient Information screen. The solution involves updating individual screens to use a consistent header pattern based on the PatientInfoScreen baseline, while leveraging the existing `HeaderNav` component.

## Architecture

The navigation bar standardization follows a component-based approach:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Navigation Bar (header)                       │
├─────────────────┬─────────────────────────┬─────────────────────────┤
│   headerLeft    │      headerCenter       │      headerRight        │
│                 │                         │                         │
│  ┌───────────┐  │  ┌─────────────────┐   │  ┌───────┐ ┌──────────┐ │
│  │ HeaderNav │  │  │  Patient Name   │   │  │ BLE*  │ │ Server   │ │
│  │ (Back +   │  │  │  Screen Title   │   │  │       │ │ Status   │ │
│  │  Home)    │  │  └─────────────────┘   │  └───────┘ └──────────┘ │
│  └───────────┘  │                         │  ┌──────────┐          │
│                 │                         │  │ Language │          │
│                 │                         │  │ Toggle   │          │
│                 │                         │  └──────────┘          │
└─────────────────┴─────────────────────────┴─────────────────────────┘
* BLE indicator only shown on screens with BLE device interaction
```

## Components and Interfaces

### Existing Components (No Changes Required)

#### HeaderNav Component
Location: `ipad-app/src/components/HeaderNav.tsx`

```typescript
interface HeaderNavProps {
  onBack?: () => void;      // Custom back action
  backLabel?: string;       // Custom back label
  showHome?: boolean;       // Show home button (default: true)
  onHome?: () => void;      // Custom home action
}
```

#### Status Indicator Components
- `BLEIndicator`: Shows Bluetooth connection status
- `ServerStatusIndicator`: Shows backend server connectivity (use `compact` prop)
- `LanguageToggle`: Language switcher (Japanese/English)

### Standard Header Pattern

All sub-screens should implement this header structure:

```tsx
<View style={styles.header}>
  <View style={styles.headerLeft}>
    <HeaderNav 
      onBack={handleBack}           // Optional: custom back behavior
      backLabel={customLabel}       // Optional: custom label
    />
  </View>
  <View style={styles.headerCenter}>
    {currentPatient && (
      <Text style={styles.patientName}>
        {currentPatient.family_name} {currentPatient.given_name}
      </Text>
    )}
    <Text style={styles.screenTitle}>{screenTitle}</Text>
  </View>
  <View style={styles.headerRight}>
    {/* BLEIndicator only for BLE-related screens */}
    {showBLE && <BLEIndicator status={bleStatus} />}
    <ServerStatusIndicator compact />
    <LanguageToggle />
  </View>
</View>
```

### Standard Header Styles

```typescript
const headerStyles = {
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 2,
    alignItems: 'center',
  },
  headerRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: SPACING.md,
  },
  patientName: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.primary,
  },
  screenTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
};
```

## Data Models

No new data models are required. This is a UI consistency update only.

## Screens Requiring Updates

### 1. ADLVoiceScreen
**Current State**: Missing ServerStatusIndicator
**Changes Required**:
- Add `ServerStatusIndicator` import
- Add `<ServerStatusIndicator compact />` to headerRight

### 2. FallRiskAssessmentScreen
**Current State**: Missing ServerStatusIndicator
**Changes Required**:
- Add `ServerStatusIndicator` import
- Add `<ServerStatusIndicator compact />` to headerRight

### 3. KihonChecklistScreen
**Current State**: Missing ServerStatusIndicator
**Changes Required**:
- Add `ServerStatusIndicator` import
- Add `<ServerStatusIndicator compact />` to headerRight

### 4. ReviewConfirmScreen
**Current State**: Missing patient name in header, missing ServerStatusIndicator
**Changes Required**:
- Add patient name display in headerCenter
- Add `ServerStatusIndicator` import
- Add `<ServerStatusIndicator compact />` to headerRight

### 5. GeneralVoiceRecorderScreen
**Current State**: Different header layout, patient context shown separately
**Changes Required**:
- Restructure header to use standard three-section layout
- Move patient name to headerCenter (when patient context exists)
- Keep context row for additional context info if needed

### 6. ClinicalNotesScreen
**Current State**: Uses `headerTop` with different structure
**Changes Required**:
- Restructure to use standard `header` with headerLeft/headerCenter/headerRight
- Move HeaderNav to headerLeft
- Move title and patient name to headerCenter
- Keep filter buttons as separate row below header



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Header Structure Consistency

*For any* sub-screen accessible from PatientInfoScreen, the header component SHALL contain exactly three child sections: headerLeft (containing HeaderNav), headerCenter (containing patient name and title when applicable), and headerRight (containing status indicators).

**Validates: Requirements 1.1, 1.2, 1.3, 1.4**

### Property 2: Patient Name Display

*For any* sub-screen with a patient context (currentPatient is defined), the headerCenter section SHALL display the patient name in the format `{family_name} {given_name}` above the screen title. *For any* sub-screen without patient context, the patient name SHALL NOT be rendered.

**Validates: Requirements 2.1, 2.3, 2.4**

### Property 3: Status Indicator Order

*For any* sub-screen, the headerRight section SHALL contain status indicators in this order: BLEIndicator (only if BLE-related screen), ServerStatusIndicator (with compact prop), LanguageToggle (always last).

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 4: HeaderNav Component Usage

*For any* sub-screen, the headerLeft section SHALL contain the HeaderNav component, and the HeaderNav component SHALL display the Home button by default (unless explicitly disabled).

**Validates: Requirements 4.1, 4.4**

### Property 5: Header Styling Consistency

*For any* sub-screen, the header View SHALL have consistent styling: backgroundColor of COLORS.surface, paddingHorizontal of SPACING.lg, paddingVertical of SPACING.sm, borderBottomWidth of 1, and borderBottomColor of COLORS.border.

**Validates: Requirements 5.1, 5.2, 5.3**

### Property 6: Typography Consistency

*For any* sub-screen, the screen title Text SHALL use fontSize of TYPOGRAPHY.fontSize.lg and fontWeight of TYPOGRAPHY.fontWeight.semibold. The patient name Text (when present) SHALL use fontSize of TYPOGRAPHY.fontSize.md and color of COLORS.text.primary.

**Validates: Requirements 5.4, 5.5**

## Error Handling

- If `currentPatient` is undefined/null, screens should gracefully omit the patient name from the header without errors
- If status indicator components fail to load, the header should still render with remaining components
- Navigation should always work even if status indicators are unavailable

## Testing Strategy

### Unit Tests
- Test that each updated screen renders the correct header structure
- Test that patient name is displayed when currentPatient exists
- Test that patient name is omitted when currentPatient is null
- Test that ServerStatusIndicator receives the `compact` prop

### Property-Based Tests
- Property tests are less applicable for this UI consistency update
- Focus on snapshot testing and visual regression testing for header consistency
- Component tests to verify header structure across all sub-screens

### Manual Testing
- Navigate through all sub-screens and visually verify header consistency
- Test with and without patient context
- Test language toggle functionality on all screens
- Verify BLE indicator appears only on BLE-related screens (VitalsCapture)
