# Mock Data Audit - VerbumCare iPad App

**CRITICAL**: This document tracks all mock/hardcoded data in the application that needs to be replaced with real backend API calls before production.

## 🚨 Current Mock Data Locations

### 1. **Care Plan Module** - `src/stores/carePlanStore.ts`
**Status**: ✅ API INTEGRATED - Mock data only as fallback

**Changes Made**:
- ✅ Added `loadProblemTemplates()` - Fetches from `GET /api/care-plans/problem-templates`
- ✅ Added `loadCarePlan()` - Fetches from `GET /api/care-plans?patient_id={id}`
- ✅ Updated `createCarePlan()` - Posts to `POST /api/care-plans`
- ✅ Updated `addCarePlanItem()` - Posts to `POST /api/care-plans/{id}/items`
- ✅ Updated `updateCarePlanItem()` - Puts to `PUT /api/care-plans/{id}/items/{item_id}`
- ✅ Updated `deleteCarePlanItem()` - Deletes via `DELETE /api/care-plans/{id}/items/{item_id}`

**Mock Data Fallback**:
- `PROBLEM_TEMPLATES` (lines 187-236): ONLY used as fallback if API fails
  - Automatically falls back if backend is unreachable
  - User is notified via error message
  - App continues to function with local templates

- `initializeCarePlanMockData()` - **REMOVED** from App.tsx

**API Endpoints Implemented** (in `src/services/api.ts`):
- ✅ `GET /api/care-plans/problem-templates`
- ✅ `GET /api/care-plans?patient_id={id}`
- ✅ `GET /api/care-plans/{id}`
- ✅ `POST /api/care-plans`
- ✅ `PUT /api/care-plans/{id}`
- ✅ `POST /api/care-plans/{id}/items`
- ✅ `PUT /api/care-plans/{id}/items/{item_id}`
- ✅ `DELETE /api/care-plans/{id}/items/{item_id}`
- ✅ `POST /api/care-plans/{id}/items/{item_id}/notes`

---

### 2. **Medicine Administration** - `src/screens/MedicineAdminScreen.tsx`
**Status**: ⚠️ MOCK DATA IN USE

**Mock Data**:
- Line 22: Comment indicates "Mock medication schedule"
- Hardcoded medication schedule data

**Replacement Plan**:
- Should fetch from: `GET /api/medications/schedule?patient_id={id}`

---

### 3. **Patient Data** - NEEDS INVESTIGATION
**Status**: ❓ UNCLEAR - Need to verify

**Potential Mock Areas**:
- Patient list
- Patient details
- Vital signs history
- Assessment history

**Next Steps**: Audit patient data loading to ensure it's from backend

---

## ✅ What IS Connected to Backend

Based on the codebase structure:
- Socket.IO connection for real-time voice processing (`socketService`)
- ADL voice recordings
- Incident reports (likely)

---

## 🎯 Action Items

### ✅ COMPLETED:
1. ✅ Remove `initializeCarePlanMockData()` call from App.tsx
2. ✅ Create API endpoints for care plan CRUD operations
3. ✅ Create API endpoint for problem templates
4. ✅ Replace hardcoded problem templates with API call (with fallback)
5. ✅ Add clear error handling when backend is unavailable
6. ✅ Add loading states to all care plan screens
7. ✅ Update all screens to use async API calls

### REMAINING (Before Production):
8. ⏳ Replace medicine schedule with API call (MedicineAdminScreen.tsx)
9. ⏳ Verify patient data is from backend (not mock)
10. ⏳ Add environment variable to enable/disable mock data for development
11. ⏳ Create integration tests that verify no mock data in production builds
12. ⏳ Add build-time check to prevent mock data in production

---

## 📝 Development Guidelines

**RULE**: All mock data must be:
1. Clearly marked with `// 🚨 MOCK DATA - REMOVE BEFORE PRODUCTION`
2. Documented in this file
3. Have a corresponding backend API endpoint defined
4. Be replaceable with a feature flag for development

**NEVER**:
- Use mock data without explicit documentation
- Deploy mock data to production
- Assume mock data is "temporary" without a replacement plan

---

## 🔍 How to Search for Mock Data

```bash
# Search for mock data indicators
grep -r "mock\|Mock\|MOCK" --include="*.ts" --include="*.tsx"

# Search for hardcoded arrays/objects that might be mock data
grep -r "const.*=\s*\[" --include="*.ts" --include="*.tsx" | grep -v "import"

# Search for initialization functions that might populate mock data
grep -r "initialize.*Data\|seed.*Data\|mock.*Data" --include="*.ts" --include="*.tsx"
```

---

**Last Updated**: 2025-10-20 (Updated with API integration)
**Audited By**: Claude
**Status**: ✅ API INTEGRATION COMPLETE - Mock data only used as fallback
