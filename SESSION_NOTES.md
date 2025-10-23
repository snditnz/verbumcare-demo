# Session Notes - All Care Plans Feature Implementation

## Date
2025-10-23

## Summary
Implemented comprehensive "All Care Plans" page with optimized UX, filters, and space-efficient layout.

## Completed Work

### 1. All Care Plans Page - Core Implementation
- **Created**: `ipad-app/src/screens/AllCarePlansScreen.tsx` (689 lines)
- **Backend**: Added `GET /care-plans/all` endpoint in `backend/src/routes/care-plans.js`
- **Features**:
  - Shows only latest care plan per patient (not all versions/duplicates)
  - Comprehensive filtering and sorting
  - Pull-to-refresh
  - Status badges (overdue, stuck goals, high priority)
  - Progress bars

### 2. Navigation Integration
- Care Plans quick action button (dashboard) → navigates to All Care Plans
- Added to navigation stack in `App.tsx`
- Proper back navigation

### 3. Filter System Improvements
**Visual Grouping & Organization:**
- Added group labels: "Status", "Care Level", "Room"
- Visual separators (vertical bars) between filter groups
- Clear distinction between filter types

**Room Filter Scalability:**
- Replaced individual room chips with modal picker
- Dropdown shows all rooms in scrollable list
- Positioned near button (top-right, not center screen)
- Scales to 200+ rooms
- "All Rooms" option with checkmark for selected

**Filter Logic:**
- Status: OR logic (Active/Draft)
- Care Level: AND logic
- Room: AND logic

### 4. Layout Optimization - Space Efficiency
**Filter Section (Vertical Condensing):**
- Search section: 32px height (was ~50px)
- Filter chips: 32px height (was ~50px)
- Total filter section: ~64px (was 100px+)
- Removed results count row
- Minimal vertical padding throughout
- Font sizes: 14px (was larger)
- Explicit height constraints

**Card Spacing:**
- Reduced padding: `paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs`
- Gap between cards: 6px (was SPACING.xs ~12px)
- **Critical fix**: Override Card component's default `marginBottom: SPACING.lg` with `marginBottom: 0`
- Applied to both Dashboard and All Care Plans screens

### 5. Backend Query Optimization
**Latest Care Plan Per Patient:**
```sql
WITH latest_care_plans AS (
  SELECT
    cp.care_plan_id,
    cp.patient_id,
    ROW_NUMBER() OVER (
      PARTITION BY cp.patient_id
      ORDER BY cp.created_date DESC, cp.version DESC
    ) as rn
  FROM care_plans cp
  WHERE cp.status IN ('active', 'draft')
)
-- Then join and filter WHERE rn = 1
```

**Single Query with Stats:**
- Patient info (jsonb)
- Active items count
- Average progress
- Alert flags (overdue, high priority, stuck goals)
- Last update info

### 6. Bug Fixes
- Fixed 500 error: removed non-existent `age` column from patient query
- Fixed filter section spacing (horizontal vs vertical confusion)
- Fixed Card default margin causing large gaps

## Key Design Decisions

### Japanese Care Levels (要介護保険)
- **要支援 (Yōshien)**: Support Required (2 levels)
  - 要支援1: Minimal assistance
  - 要支援2: Some support needed
- **要介護 (Yōkaigo)**: Care Required (5 levels)
  - 要介護1-5: Partial to maximum care
  - Level 5 = most dependent

### Space Optimization Philosophy
- **Horizontal**: MORE padding/spacing (comfortable to read/tap)
- **Vertical**: LESS padding/spacing (see more items on screen)
- Explicit heights to prevent expansion
- Minimal gaps between cards (6px)
- Override component defaults when needed

## Files Modified

### Frontend
- `ipad-app/src/screens/AllCarePlansScreen.tsx` - NEW (689 lines)
- `ipad-app/src/screens/DashboardScreen.tsx` - Navigation + spacing fixes
- `ipad-app/src/types/app.ts` - Added `CarePlanWithPatient` type
- `ipad-app/src/services/api.ts` - Added `getAllCarePlans()` method
- `ipad-app/src/stores/carePlanStore.ts` - Added `loadAllCarePlans()` action
- `ipad-app/App.tsx` - Registered AllCarePlans screen

### Backend
- `backend/src/routes/care-plans.js` - Added GET /all endpoint with optimized query

## Commits (5 total)
1. `7d27b98` - Replace room toggle with proper modal picker
2. `4e48f84` - Position room picker modal near dropdown button
3. `b5d8c85` - Reduce padding around care plan cards
4. `52274b6` - Significantly reduce spacing between care plan cards
5. `886492b` - Remove Card default marginBottom for care plan cards

## Technical Notes

### Card Component Default Styles
The `Card` component (`ipad-app/src/components/ui/Card.tsx`) has:
```typescript
base: {
  marginBottom: SPACING.lg,  // ⚠️ This causes large gaps!
}
```
Must override with `marginBottom: 0` when using in lists with custom gap.

### Filter Heights
```typescript
searchSection: { minHeight: 32, maxHeight: 32 }
searchBar: { height: 26 }
filterChips: { maxHeight: 32 }
filterChip: { height: 24 }
```

### Room Picker Modal Positioning
```typescript
modalContent: {
  position: 'absolute',
  top: 90,  // Below filter section
  right: SPACING.lg,  // Right-aligned
  width: 250,
  maxHeight: 400,
}
```

## User Feedback & Iterations

1. **"Need to see latest care plan per patient only"** ✅ Fixed with CTE query
2. **"Filters taking too much space"** ✅ Reduced from ~100px to ~64px
3. **"Room filter not scalable"** ✅ Changed to modal picker
4. **"Modal looks weird centered"** ✅ Positioned near button
5. **"Too much gap between cards"** ✅ Reduced to 6px + removed Card default margin

## Next Session Pickup Points

### Potential Improvements
- [ ] Add search functionality to room picker modal (for 200+ rooms)
- [ ] Consider collapsible filter section if more space needed
- [ ] Add filter count badges (e.g., "Active (5)")
- [ ] Keyboard navigation for room picker
- [ ] Remember last selected filters in state/storage

### Known Issues
None currently - all reported issues resolved.

## Testing Notes
- Tested with 1 patient (Yamada) with multiple care plans
- Verified deduplication works (6 plans → 1 shown)
- Filters working correctly
- Modal picker functional
- Spacing optimized per user requirements
