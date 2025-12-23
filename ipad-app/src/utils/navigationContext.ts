/**
 * Navigation Context Preservation System
 * 
 * Manages navigation context to ensure users return to the same screen
 * they came from when using the GeneralVoiceRecorderScreen.
 */

import { NavigationState, PartialState } from '@react-navigation/native';

// Navigation context interface
export interface NavigationContext {
  originScreen: string;
  originParams?: any;
  patientContext?: {
    patientId: string;
    patientName: string;
  };
  timestamp: number;
  preserveScrollPosition?: boolean;
}

// Patient context detection result
export interface PatientContextInfo {
  patientId?: string;
  patientName?: string;
  isPatientContext: boolean;
}

// Navigation context manager class
class NavigationContextManager {
  private currentContext: NavigationContext | null = null;
  private contextHistory: NavigationContext[] = [];
  private maxHistorySize = 10;

  /**
   * Preserve current navigation context before navigating to voice recorder
   */
  preserveContext(navigation: any, additionalParams?: any): NavigationContext {
    // Clear any existing context first to avoid stale data
    this.clearCurrentContext();
    
    const context = this.extractNavigationContext(navigation, additionalParams);
    this.currentContext = context;
    
    // Add to history (keep limited size)
    this.contextHistory.unshift(context);
    if (this.contextHistory.length > this.maxHistorySize) {
      this.contextHistory = this.contextHistory.slice(0, this.maxHistorySize);
    }
    
    console.log('[NavigationContext] ✅ Context preserved:', {
      originScreen: context.originScreen,
      hasPatientContext: !!context.patientContext,
      patientName: context.patientContext?.patientName,
      timestamp: context.timestamp,
    });
    
    return context;
  }

  /**
   * Get the current preserved context
   */
  getCurrentContext(): NavigationContext | null {
    console.log('[NavigationContext] getCurrentContext called, returning:', this.currentContext ? {
      originScreen: this.currentContext.originScreen,
      hasPatientContext: !!this.currentContext.patientContext,
      patientName: this.currentContext.patientContext?.patientName,
      age: Date.now() - this.currentContext.timestamp,
    } : null);
    return this.currentContext;
  }

  /**
   * Navigate back to the preserved context
   */
  navigateToOrigin(navigation: any, fallbackScreen: string = 'Dashboard'): void {
    const context = this.currentContext;
    
    if (!context) {
      console.log('[NavigationContext] No context preserved, navigating to fallback:', fallbackScreen);
      try {
        navigation.navigate(fallbackScreen);
      } catch (error) {
        console.error('[NavigationContext] Failed to navigate to fallback:', error);
      }
      return;
    }

    try {
      console.log('[NavigationContext] Navigating back to origin:', {
        originScreen: context.originScreen,
        hasParams: !!context.originParams,
        hasPatientContext: !!context.patientContext,
      });

      // Navigate back to origin screen with preserved parameters
      if (context.originParams) {
        navigation.navigate(context.originScreen, context.originParams);
      } else {
        navigation.navigate(context.originScreen);
      }
      
      // Clear the current context after successful navigation
      this.clearCurrentContext();
      
    } catch (error) {
      console.error('[NavigationContext] Failed to navigate to origin:', error);
      console.log('[NavigationContext] Falling back to:', fallbackScreen);
      
      try {
        navigation.navigate(fallbackScreen);
      } catch (fallbackError) {
        console.error('[NavigationContext] Failed to navigate to fallback:', fallbackError);
      }
      
      this.clearCurrentContext();
    }
  }

  /**
   * Clear the current context
   */
  clearCurrentContext(): void {
    console.log('[NavigationContext] ⚠️ Clearing current context:', this.currentContext ? {
      originScreen: this.currentContext.originScreen,
      hasPatientContext: !!this.currentContext.patientContext,
    } : 'already null');
    this.currentContext = null;
  }

  /**
   * Get context history for debugging
   */
  getContextHistory(): NavigationContext[] {
    return [...this.contextHistory];
  }

  /**
   * Extract navigation context from current navigation state
   */
  private extractNavigationContext(navigation: any, additionalParams?: any): NavigationContext {
    let state = null;
    let routes: any[] = [];
    
    // Safely get navigation state
    try {
      if (navigation && typeof navigation.getState === 'function') {
        state = navigation.getState();
        routes = state?.routes || [];
      }
    } catch (error) {
      console.warn('[NavigationContext] Failed to get navigation state:', error);
    }
    
    // Get the previous route (the one we're navigating from)
    const currentRouteIndex = state?.index || 0;
    const previousRoute = routes[currentRouteIndex];
    
    // Default context
    let context: NavigationContext = {
      originScreen: previousRoute?.name || 'Dashboard',
      originParams: previousRoute?.params,
      timestamp: Date.now(),
    };

    // Add additional parameters if provided
    if (additionalParams) {
      context.originParams = {
        ...context.originParams,
        ...additionalParams,
      };
    }

    // Detect patient context from route or additional params
    const patientContext = this.detectPatientContext(previousRoute);
    console.log('[NavigationContext] Route patient context:', patientContext);
    
    // If additional params contain patient info, use them directly
    if (additionalParams && (additionalParams.patientId || additionalParams.patientName)) {
      console.log('[NavigationContext] ✅ Using patient context from additional params directly:', additionalParams);
      context.patientContext = {
        patientId: additionalParams.patientId || 'unknown',
        patientName: additionalParams.patientName || 'Unknown Patient',
      };
    } else if (patientContext.isPatientContext) {
      context.patientContext = {
        patientId: patientContext.patientId!,
        patientName: patientContext.patientName!,
      };
      console.log('[NavigationContext] ✅ Using patient context from route:', context.patientContext);
    } else if (!patientContext.isPatientContext && additionalParams) {
      console.log('[NavigationContext] Checking additional params for patient context:', additionalParams);
      const additionalPatientContext = this.detectPatientContext({ params: additionalParams });
      console.log('[NavigationContext] Additional params patient context:', additionalPatientContext);
      
      if (additionalPatientContext.isPatientContext) {
        context.patientContext = {
          patientId: additionalPatientContext.patientId!,
          patientName: additionalPatientContext.patientName!,
        };
        console.log('[NavigationContext] ✅ Using patient context from additional params detection:', context.patientContext);
      }
    }

    return context;
  }

  /**
   * Detect if the current route has patient context
   */
  private detectPatientContext(route: any): PatientContextInfo {
    console.log('[NavigationContext] detectPatientContext called with route:', route);
    
    if (!route) {
      console.log('[NavigationContext] No route provided');
      return { isPatientContext: false };
    }

    const routeName = route.name;
    const params = route.params || {};
    
    console.log('[NavigationContext] Route name:', routeName, 'params:', params);

    // Check for patient-related screens
    const patientScreens = [
      'PatientInfo',
      'PatientList', 
      'VitalsCapture',
      'VitalsGraph',
      'CarePlanHub',
      'ClinicalNotes',
      'UpdatePatientInfo',
      'IncidentReport',
    ];

    const isPatientScreen = patientScreens.includes(routeName);
    console.log('[NavigationContext] Is patient screen:', isPatientScreen);

    // Extract patient information from params
    let patientId: string | undefined;
    let patientName: string | undefined;

    // Common parameter names for patient ID
    const patientIdKeys = ['patientId', 'patient_id', 'id'];
    for (const key of patientIdKeys) {
      if (params[key]) {
        patientId = params[key];
        console.log('[NavigationContext] Found patientId:', patientId, 'from key:', key);
        break;
      }
    }

    // Common parameter names for patient name
    const patientNameKeys = ['patientName', 'patient_name', 'name', 'fullName'];
    for (const key of patientNameKeys) {
      if (params[key]) {
        patientName = params[key];
        console.log('[NavigationContext] Found patientName:', patientName, 'from key:', key);
        break;
      }
    }

    // If we have patient info or it's a patient screen, consider it patient context
    const hasPatientInfo = !!(patientId || patientName);
    const isPatientContext = isPatientScreen || hasPatientInfo;

    const result = {
      patientId,
      patientName,
      isPatientContext,
    };
    
    console.log('[NavigationContext] detectPatientContext result:', result);
    return result;
  }
}

// Singleton instance
const navigationContextManager = new NavigationContextManager();

// Exported functions for easy use
export const preserveNavigationContext = (navigation: any, additionalParams?: any): NavigationContext => {
  return navigationContextManager.preserveContext(navigation, additionalParams);
};

export const getCurrentNavigationContext = (): NavigationContext | null => {
  return navigationContextManager.getCurrentContext();
};

export const navigateToOrigin = (navigation: any, fallbackScreen: string = 'Dashboard'): void => {
  navigationContextManager.navigateToOrigin(navigation, fallbackScreen);
};

export const clearNavigationContext = (): void => {
  navigationContextManager.clearCurrentContext();
};

export const getNavigationContextHistory = (): NavigationContext[] => {
  return navigationContextManager.getContextHistory();
};

/**
 * Detect patient context from route parameters
 */
export const detectPatientContextFromParams = (params: any): PatientContextInfo => {
  const manager = new NavigationContextManager();
  return (manager as any).detectPatientContext({ params });
};

/**
 * Enhanced navigation helper for voice recorder
 */
export const navigateToVoiceRecorder = (
  navigation: any, 
  preserveContext: boolean = true,
  additionalParams?: any
): void => {
  if (preserveContext) {
    preserveNavigationContext(navigation, additionalParams);
  }
  
  navigation.navigate('GeneralVoiceRecorder');
};

/**
 * Enhanced back navigation for voice recorder
 */
export const navigateBackFromVoiceRecorder = (
  navigation: any,
  fallbackScreen: string = 'Dashboard'
): void => {
  navigateToOrigin(navigation, fallbackScreen);
};

export default navigationContextManager;