# Implementation Plan: Voice Recorder Layout Fix

## Overview

Convert the GeneralVoiceRecorderScreen from a ScrollView-based layout to a fixed, responsive layout that fits completely within the screen viewport while preserving navigation context.

## Tasks

- [x] 1. Create responsive spacing utility functions
  - Create utility functions to calculate dynamic spacing based on screen dimensions
  - Implement screen dimension detection for iPad variants
  - Add orientation change handling
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 1.1 Write property test for responsive spacing calculations
  - **Property 2: Responsive Layout Adaptation**
  - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

- [x] 2. Implement navigation context preservation system
  - Create NavigationContext interface and detection logic
  - Add context preservation in screen navigation
  - Implement context-aware back navigation
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 2.1 Write property test for navigation context preservation
  - **Property 3: Navigation Context Preservation**
  - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [x] 3. Replace ScrollView with fixed layout container
  - Remove ScrollView wrapper from GeneralVoiceRecorderScreen
  - Implement flexbox-based layout with proper space distribution
  - Add responsive spacing to layout components
  - _Requirements: 1.4, 2.3, 2.4_

- [x] 3.1 Write property test for fixed layout implementation
  - **Property 4: Fixed Layout Implementation**
  - **Validates: Requirements 1.4, 2.3, 2.4**

- [x] 4. Optimize component layout and spacing
  - Update header to use fixed height with responsive padding
  - Implement flexible content area with weighted sections
  - Ensure action buttons remain fixed at bottom
  - _Requirements: 1.1, 1.2, 2.1, 2.2_

- [x] 4.1 Write property test for viewport content fitting
  - **Property 1: Viewport Content Fitting**
  - **Validates: Requirements 1.1, 1.2, 2.1, 2.2**

- [x] 5. Implement collapsible instruction text
  - Add state management for instruction text expansion/collapse
  - Create compact instruction view for smaller screens
  - Maintain essential information visibility
  - _Requirements: 2.3_

- [x] 6. Add context detection and display optimization
  - Enhance context card to be more compact when needed
  - Improve context detection accuracy
  - Optimize context display for different screen sizes
  - _Requirements: 4.5_

- [x] 6.1 Write property test for context detection accuracy
  - **Property 5: Context Detection Accuracy**
  - **Validates: Requirements 4.5**

- [x] 7. Ensure accessibility compliance
  - Verify touch targets maintain 44pt minimum size
  - Preserve all accessibility labels and hints
  - Test with VoiceOver compatibility
  - _Requirements: 3.5, 5.5_

- [x] 7.1 Write property test for accessibility compliance
  - **Property 6: Accessibility Compliance**
  - **Validates: Requirements 3.5, 5.5**

- [x] 8. Implement render stability improvements
  - Add layout caching to prevent recalculations
  - Eliminate layout shifts during screen transitions
  - Optimize orientation change handling
  - _Requirements: 5.1, 5.3_

- [x] 8.1 Write property test for render stability
  - **Property 7: Render Stability**
  - **Validates: Requirements 5.1, 5.3**

- [x] 9. Checkpoint - Test layout on different iPad sizes
  - Test on iPad Mini, iPad Air, and iPad Pro simulators
  - Verify layout works in both portrait and landscape
  - Ensure all content fits within viewport without scrolling
  - Ensure all tests pass, ask the user if questions arise.
  - **STATUS**: ✅ All 61 property tests passing across 5 test suites

- [x] 10. Update navigation integration
  - Integrate navigation context preservation with existing navigation
  - Update back button handler to use preserved context
  - Test navigation from different originating screens
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 11. Final integration and testing
  - Integrate all layout improvements into GeneralVoiceRecorderScreen
  - Test complete user flow from different contexts
  - Verify recording functionality still works correctly
  - _Requirements: All_

- [x] 12. Final checkpoint - Complete testing and validation
  - Run all property tests and ensure they pass
  - Test on physical iPad devices if available
  - Verify accessibility with assistive technologies
  - Ensure all tests pass, ask the user if questions arise.
  - **STATUS**: ✅ All 61 property tests passing, TypeScript errors resolved

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Focus on maintaining existing functionality while improving layout