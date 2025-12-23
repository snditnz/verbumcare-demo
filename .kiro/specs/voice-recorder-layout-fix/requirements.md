# Requirements Document

## Introduction

Fix the GeneralVoiceRecorderScreen layout to ensure all UI elements fit completely within the screen viewport without requiring scrolling or causing content to be cut off.

## Glossary

- **GeneralVoiceRecorderScreen**: The voice recording interface screen that allows users to record clinical documentation
- **Viewport**: The visible area of the screen available for displaying content
- **ScrollView**: The scrollable container that currently wraps the screen content
- **SafeAreaView**: React Native component that ensures content appears within safe area boundaries

## Requirements

### Requirement 1: Screen Layout Optimization

**User Story:** As a healthcare worker, I want the voice recorder screen to fit completely within my device screen, so that I can access all controls without scrolling and have an optimal recording experience.

#### Acceptance Criteria

1. THE GeneralVoiceRecorderScreen SHALL display all content within the device viewport without requiring vertical scrolling
2. WHEN the screen loads, THE header, context card, instructions, recorder controls, and action buttons SHALL all be visible simultaneously
3. THE content layout SHALL adapt to different iPad screen sizes and orientations
4. THE ScrollView container SHALL be replaced with a fixed layout that utilizes available screen space efficiently
5. THE spacing between components SHALL be optimized to maximize content visibility while maintaining readability

### Requirement 2: Content Prioritization

**User Story:** As a healthcare worker, I want the most important elements (recording controls and action buttons) to always be visible, so that I can quickly record and save voice notes without scrolling.

#### Acceptance Criteria

1. THE voice recorder controls SHALL always be visible in the center portion of the screen
2. THE action buttons (Cancel/Save) SHALL always be visible at the bottom of the screen
3. WHEN content needs to be condensed, THE instruction text SHALL be shortened or made collapsible
4. THE context card SHALL remain visible but may be made more compact
5. THE header SHALL remain fixed at the top with essential navigation and status indicators

### Requirement 3: Responsive Design

**User Story:** As a healthcare worker using different iPad models, I want the voice recorder to work optimally on my specific device, so that the interface is consistent regardless of screen size.

#### Acceptance Criteria

1. THE layout SHALL work correctly on iPad Mini, iPad Air, and iPad Pro screen sizes
2. THE layout SHALL adapt to both portrait and landscape orientations
3. THE component spacing SHALL scale appropriately based on available screen height
4. THE text sizes SHALL remain readable while allowing content to fit within viewport
5. THE touch targets SHALL maintain minimum accessibility sizes (44pt) even when content is condensed

### Requirement 4: Navigation Context Preservation

**User Story:** As a healthcare worker, I want to return to the same context I was in before recording, so that my workflow is not interrupted and I can continue with the same patient or task.

#### Acceptance Criteria

1. WHEN the GeneralVoiceRecorderScreen is launched from a patient context, THE back button SHALL return to that same patient screen
2. WHEN the GeneralVoiceRecorderScreen is launched from the main dashboard, THE back button SHALL return to the main dashboard
3. WHEN a recording is successfully completed and saved, THE navigation SHALL return to the originating context automatically
4. THE navigation stack SHALL preserve the previous screen state and scroll position when returning
5. THE context detection SHALL work correctly for both patient-specific and global recording scenarios

### Requirement 5: Performance and Usability

**User Story:** As a healthcare worker, I want the voice recorder interface to be responsive and efficient, so that I can quickly document patient information without UI delays.

#### Acceptance Criteria

1. THE screen SHALL render without layout shifts or content jumping
2. THE fixed layout SHALL eliminate unnecessary scroll performance overhead
3. THE recording controls SHALL remain easily accessible without scrolling
4. THE visual hierarchy SHALL guide users naturally from context to recording to actions
5. THE interface SHALL maintain the current accessibility features and labels