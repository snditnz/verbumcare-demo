/**
 * Property-Based Tests for Navigation Context Preservation
 * 
 * Tests navigation context preservation and restoration to ensure users
 * return to the correct screen after using the voice recorder.
 * 
 * Feature: voice-recorder-layout-fix, Property 3: Navigation Context Preservation
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4
 */

import * as fc from 'fast-check';
import {
  preserveNavigationContext,
  getCurrentNavigationContext,
  navigateToOrigin,
  clearNavigationContext,
  detectPatientContextFromParams,
  navigateToVoiceRecorder,
  navigateBackFromVoiceRecorder,
  NavigationContext,
} from '../navigationContext';

describe('Navigation Context Preservation Property Tests', () => {
  // Mock navigation object generator
  const mockNavigationArb = fc.record({
    navigate: fc.constant(jest.fn()),
    goBack: fc.constant(jest.fn()),
    getState: fc.func(fc.record({
      routes: fc.array(fc.record({
        name: fc.oneof(
          fc.constant('Dashboard'),
          fc.constant('PatientInfo'),
          fc.constant('PatientList'),
          fc.constant('VitalsCapture'),
          fc.constant('CarePlanHub'),
          fc.constant('ClinicalNotes'),
        ),
        params: fc.option(fc.record({
          patientId: fc.option(fc.uuid()),
          patientName: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
          patient_id: fc.option(fc.uuid()),
          id: fc.option(fc.uuid()),
        }), { nil: undefined }),
      }), { minLength: 1, maxLength: 5 }),
      index: fc.integer({ min: 0, max: 4 }),
    })),
  });

  // Patient context generator
  const patientContextArb = fc.record({
    patientId: fc.uuid(),
    patientName: fc.string({ minLength: 1, maxLength: 50 }),
  });

  // Route parameters generator
  const routeParamsArb = fc.record({
    patientId: fc.option(fc.uuid(), { nil: undefined }),
    patientName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
    patient_id: fc.option(fc.uuid(), { nil: undefined }),
    id: fc.option(fc.uuid(), { nil: undefined }),
    otherParam: fc.option(fc.string(), { nil: undefined }),
  });

  beforeEach(() => {
    // Clear any existing context before each test
    clearNavigationContext();
    jest.clearAllMocks();
    
    // Also clear the context history to ensure clean state
    const manager = require('../navigationContext').default;
    if (manager && manager.contextHistory) {
      manager.contextHistory = [];
    }
  });

  /**
   * Property 3: Navigation Context Preservation
   * For any originating screen context, navigation should preserve and restore correctly
   */
  describe('Property 3: Navigation Context Preservation', () => {
    it('should preserve navigation context for any valid navigation state', () => {
      fc.assert(
        fc.property(mockNavigationArb, (mockNavigation) => {
          // Preserve context
          const context = preserveNavigationContext(mockNavigation);
          
          // Context should be created
          expect(context).toBeDefined();
          expect(context.originScreen).toBeDefined();
          expect(context.timestamp).toBeGreaterThan(0);
          
          // Context should be retrievable
          const retrievedContext = getCurrentNavigationContext();
          expect(retrievedContext).toEqual(context);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should correctly detect patient context from route parameters', () => {
      fc.assert(
        fc.property(routeParamsArb, (params) => {
          const patientContext = detectPatientContextFromParams(params);
          
          // Should always return a valid result
          expect(patientContext).toBeDefined();
          expect(typeof patientContext.isPatientContext).toBe('boolean');
          
          // If any patient identifier is present, should detect patient context
          const hasPatientId = !!(params.patientId || params.patient_id || params.id);
          const hasPatientName = !!params.patientName;
          
          if (hasPatientId || hasPatientName) {
            // Should detect patient context if patient info is present
            expect(patientContext.isPatientContext).toBe(true);
            
            // Should extract patient ID if available
            if (hasPatientId) {
              const expectedId = params.patientId || params.patient_id || params.id;
              expect(patientContext.patientId).toBe(expectedId);
            }
            
            // Should extract patient name if available
            if (hasPatientName) {
              expect(patientContext.patientName).toBe(params.patientName);
            }
          }
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should navigate back to origin screen with preserved parameters', () => {
      fc.assert(
        fc.property(mockNavigationArb, fc.string(), (mockNavigation, fallbackScreen) => {
          // Clear context at the start of each property test iteration
          clearNavigationContext();
          
          // Preserve context first
          const context = preserveNavigationContext(mockNavigation);
          
          // Verify context was created
          expect(context).toBeDefined();
          expect(context.originScreen).toBeDefined();
          expect(context.timestamp).toBeGreaterThan(0);
          
          // Navigate back to origin
          navigateToOrigin(mockNavigation, fallbackScreen);
          
          // Should have called navigate
          expect(mockNavigation.navigate).toHaveBeenCalled();
          
          // Should have navigated to some screen (either origin or fallback)
          const navigateCall = mockNavigation.navigate.mock.calls[0];
          expect(navigateCall[0]).toBeDefined();
          expect(typeof navigateCall[0]).toBe('string');
          
          // Context should be cleared after navigation
          expect(getCurrentNavigationContext()).toBeNull();
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should handle navigation failures gracefully', () => {
      fc.assert(
        fc.property(fc.string(), (fallbackScreen) => {
          // Create a navigation mock that throws an error
          const failingNavigation = {
            navigate: jest.fn().mockImplementation(() => {
              throw new Error('Navigation failed');
            }),
            getState: jest.fn().mockReturnValue({
              routes: [{ name: 'TestScreen' }],
              index: 0,
            }),
          };
          
          // Preserve context
          preserveNavigationContext(failingNavigation);
          
          // Navigate back should not throw, should use fallback
          expect(() => {
            navigateToOrigin(failingNavigation, fallbackScreen);
          }).not.toThrow();
          
          // Should have attempted navigation at least once (original attempt)
          expect(failingNavigation.navigate).toHaveBeenCalled();
          
          // Context should be cleared even after failure
          expect(getCurrentNavigationContext()).toBeNull();
          
          return true;
        }),
        { numRuns: 50 }
      );
    });

    it('should maintain context history correctly', () => {
      fc.assert(
        fc.property(
          fc.array(mockNavigationArb, { minLength: 1, maxLength: 15 }),
          (navigationMocks) => {
            // Preserve multiple contexts
            const contexts: NavigationContext[] = [];
            
            navigationMocks.forEach((nav) => {
              const context = preserveNavigationContext(nav);
              contexts.push(context);
            });
            
            // Current context should be the last one
            const currentContext = getCurrentNavigationContext();
            expect(currentContext).toEqual(contexts[contexts.length - 1]);
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Enhanced Navigation Helper Properties
   */
  describe('Enhanced Navigation Helper Properties', () => {
    it('should preserve context when navigating to voice recorder', () => {
      fc.assert(
        fc.property(mockNavigationArb, (mockNavigation) => {
          // Navigate to voice recorder with context preservation
          navigateToVoiceRecorder(mockNavigation, true);
          
          // Should have preserved context
          const context = getCurrentNavigationContext();
          expect(context).toBeDefined();
          
          // Should have navigated to GeneralVoiceRecorder
          expect(mockNavigation.navigate).toHaveBeenCalledWith('GeneralVoiceRecorder');
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should not preserve context when explicitly disabled', () => {
      fc.assert(
        fc.property(mockNavigationArb, (mockNavigation) => {
          // Navigate to voice recorder without context preservation
          navigateToVoiceRecorder(mockNavigation, false);
          
          // Should not have preserved context
          const context = getCurrentNavigationContext();
          expect(context).toBeNull();
          
          // Should still have navigated to GeneralVoiceRecorder
          expect(mockNavigation.navigate).toHaveBeenCalledWith('GeneralVoiceRecorder');
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should navigate back correctly from voice recorder', () => {
      fc.assert(
        fc.property(mockNavigationArb, fc.string(), (mockNavigation, fallbackScreen) => {
          // First preserve context
          preserveNavigationContext(mockNavigation);
          
          // Then navigate back
          navigateBackFromVoiceRecorder(mockNavigation, fallbackScreen);
          
          // Should have called navigate
          expect(mockNavigation.navigate).toHaveBeenCalled();
          
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Context Clearing Properties
   */
  describe('Context Clearing Properties', () => {
    it('should clear context completely', () => {
      fc.assert(
        fc.property(mockNavigationArb, (mockNavigation) => {
          // Preserve context
          preserveNavigationContext(mockNavigation);
          expect(getCurrentNavigationContext()).not.toBeNull();
          
          // Clear context
          clearNavigationContext();
          expect(getCurrentNavigationContext()).toBeNull();
          
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Edge Cases and Error Handling
   */
  describe('Edge Cases and Error Handling', () => {
    it('should handle empty navigation state gracefully', () => {
      const emptyNavigation = {
        navigate: jest.fn(),
        getState: jest.fn().mockReturnValue(null),
      };
      
      // Should not throw when preserving context with empty state
      expect(() => {
        preserveNavigationContext(emptyNavigation);
      }).not.toThrow();
      
      // Should create a default context
      const context = getCurrentNavigationContext();
      expect(context).toBeDefined();
      expect(context?.originScreen).toBe('Dashboard'); // Default fallback
    });

    it('should handle navigation without getState method', () => {
      const invalidNavigation = {
        navigate: jest.fn(),
        // Missing getState method
      };
      
      // Should not throw
      expect(() => {
        preserveNavigationContext(invalidNavigation as any);
      }).not.toThrow();
      
      // Should create a default context
      const context = getCurrentNavigationContext();
      expect(context).toBeDefined();
      expect(context?.originScreen).toBe('Dashboard'); // Default fallback
    });

    it('should use fallback screen when no context is preserved', () => {
      fc.assert(
        fc.property(fc.string(), (fallbackScreen) => {
          const mockNavigation = {
            navigate: jest.fn(),
            getState: jest.fn(),
          };
          
          // Navigate back without preserving context first
          navigateToOrigin(mockNavigation, fallbackScreen);
          
          // Should navigate to fallback screen
          expect(mockNavigation.navigate).toHaveBeenCalledWith(fallbackScreen);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });
});