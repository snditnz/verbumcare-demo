# Backend Switching User Choice Fix - Requirements

## Problem Statement

The current demo fix forces the Mac Mini server selection in `App.tsx`, which defeats the purpose of having a backend switcher. The user correctly pointed out: "making it default (and making the default essential) defeats the purpose of a switcher."

The core issues are:
1. **iOS Settings Visibility**: Backend switching options not visible in iOS Settings app
2. **Forced Server Selection**: Demo fix hardcodes Mac Mini, removing user choice
3. **pn51 Dependency**: App defaults to unplugged pn51 server causing connectivity failures

## User Stories

### US-1: iOS Settings Visibility
**As a** healthcare worker  
**I want** to see backend server configuration options in iOS Settings  
**So that** I can switch servers before logging into the app

**Acceptance Criteria:**
- iOS Settings shows "Backend Server Configuration" section
- Server selection dropdown is visible and functional
- Connection settings (timeout, auto-switch) are accessible
- Changes in iOS Settings immediately affect the app

### US-2: Preserve User Choice
**As a** healthcare worker  
**I want** the app to respect my server selection  
**So that** I maintain control over which backend I connect to

**Acceptance Criteria:**
- App never forces a specific server without user consent
- User's explicit server choice takes absolute priority
- Auto-fallback only occurs when user enables it in settings
- Clear indication when auto-fallback occurs

### US-3: Intelligent Default Behavior
**As a** healthcare worker  
**I want** the app to work reliably out-of-the-box  
**So that** I don't experience connectivity failures on first use

**Acceptance Criteria:**
- App detects when default server (pn51) is unavailable
- Offers alternative servers when default fails
- Provides clear messaging about server availability
- Maintains user's choice for future sessions

### US-4: Demo Readiness Without Forcing
**As a** demo presenter  
**I want** the app to work reliably for demos  
**So that** I can showcase functionality without connectivity issues

**Acceptance Criteria:**
- App works immediately for demo without hardcoded servers
- Demo users can still switch servers if needed
- Clear indication of which server is being used
- Fallback behavior is transparent and logged

## Technical Requirements

### TR-1: iOS Settings Bundle Fix
- **Requirement**: iOS Settings.bundle must be properly included in app bundle
- **Validation**: Settings appear in iOS Settings app after clean build
- **Priority**: High
- **Dependencies**: Xcode project configuration

### TR-2: Server Selection Priority
- **Requirement**: Server selection priority must be: iOS Settings > User Choice > Smart Default
- **Validation**: iOS Settings override persisted app settings
- **Priority**: High
- **Dependencies**: Native settings service

### TR-3: Smart Default Logic
- **Requirement**: When no user preference exists, intelligently select working server
- **Validation**: App tests servers and selects first available
- **Priority**: Medium
- **Dependencies**: Server connectivity testing

### TR-4: Remove Forced Server Selection
- **Requirement**: Remove hardcoded Mac Mini selection from App.tsx
- **Validation**: App respects user/iOS Settings choices
- **Priority**: High
- **Dependencies**: Alternative initialization logic

### TR-5: Enhanced Auto-Fallback
- **Requirement**: Auto-fallback only when explicitly enabled by user
- **Validation**: User can disable auto-fallback and app respects it
- **Priority**: Medium
- **Dependencies**: User preferences system

## Non-Functional Requirements

### NFR-1: Performance
- Server selection and testing must complete within 10 seconds
- iOS Settings changes must take effect within 2 seconds
- No blocking UI during server connectivity tests

### NFR-2: Reliability
- App must work even if iOS Settings are corrupted
- Fallback to working server must be reliable
- User choice must persist across app restarts

### NFR-3: User Experience
- Clear indication of current server in app UI
- Transparent messaging when auto-fallback occurs
- Easy access to server switching from within app

### NFR-4: Demo Compatibility
- App must work reliably for demos without hardcoded servers
- Demo scenario must not require special configuration
- Server switching must remain functional during demos

## Success Criteria

### Primary Success Criteria
1. **iOS Settings Visible**: Backend configuration appears in iOS Settings app
2. **User Choice Preserved**: App never forces server selection without consent
3. **Demo Ready**: App works for demo without hardcoded servers
4. **Backward Compatible**: Existing functionality remains intact

### Secondary Success Criteria
1. **Smart Defaults**: App intelligently selects working server when no preference exists
2. **Transparent Fallback**: Auto-fallback behavior is clearly communicated
3. **Performance**: Server selection completes quickly without blocking UI
4. **Error Recovery**: App gracefully handles server connectivity issues

## Out of Scope

- **Server Infrastructure Changes**: No changes to Mac Mini or pn51 server configuration
- **New Server Addition**: No new backend servers beyond existing ones
- **Authentication Changes**: No changes to login/auth flow
- **UI Redesign**: Minimal changes to existing UI components

## Constraints

- **Demo Timeline**: Solution must be ready for demo this afternoon
- **Backward Compatibility**: Must not break existing installations
- **iOS Settings**: Must use standard iOS Settings.bundle approach
- **No Breaking Changes**: Existing server configurations must continue working

## Assumptions

- **pn51 Status**: pn51 server remains physically unplugged
- **Mac Mini Availability**: Mac Mini server is accessible and working
- **iOS Settings Support**: iOS Settings.bundle is supported in current Expo version
- **User Behavior**: Users will configure settings when needed

## Dependencies

- **Xcode Project**: Settings.bundle must be properly referenced
- **Native Settings Service**: Must correctly read iOS Settings
- **Server Configuration**: Existing server configs remain valid
- **Build Process**: Clean build and reinstall may be required

## Risks

### High Risk
- **iOS Settings Visibility**: Settings.bundle may not be properly included in build
- **Demo Timeline**: Limited time to implement and test solution

### Medium Risk
- **User Confusion**: Users may not understand server switching options
- **Fallback Logic**: Auto-fallback may not work as expected

### Low Risk
- **Performance Impact**: Server testing may slow app startup
- **Edge Cases**: Unusual network conditions may cause issues

## Mitigation Strategies

### iOS Settings Visibility Risk
- **Mitigation**: Verify Settings.bundle inclusion in Xcode project
- **Fallback**: Provide in-app server switching as backup

### Demo Timeline Risk
- **Mitigation**: Focus on minimal viable solution first
- **Fallback**: Keep current demo fix as emergency backup

### User Confusion Risk
- **Mitigation**: Provide clear documentation and UI guidance
- **Fallback**: Default to working server with clear messaging