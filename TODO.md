# TODO - VerbumCare iPad App

## Current Status
✅ All Care Plans page fully implemented and optimized
✅ Filter system with grouping and modal room picker
✅ Space optimization complete (64px filter section, 6px card gaps)
✅ Navigation integrated

---

## Immediate Next Steps (Priority Order)

### High Priority
Nothing blocking - all requested features working.

### Medium Priority - UX Enhancements

#### 1. Room Picker Search (for scalability to 200+ rooms)
**Why**: Currently cycles through all rooms - with 200+ would be slow
**What**: Add search/filter input in room picker modal
**Location**: `ipad-app/src/screens/AllCarePlansScreen.tsx`
**Estimate**: 30 mins

```typescript
// Add search state
const [roomSearch, setRoomSearch] = useState('');

// Filter rooms
const filteredRooms = rooms.filter(room =>
  room.toLowerCase().includes(roomSearch.toLowerCase())
);

// Add TextInput to modal
<TextInput
  placeholder="Search rooms..."
  value={roomSearch}
  onChangeText={setRoomSearch}
/>
```

#### 2. Filter Persistence
**Why**: User preferences should persist across sessions
**What**: Save selected filters to AsyncStorage
**Location**: `ipad-app/src/screens/AllCarePlansScreen.tsx`
**Estimate**: 45 mins

```typescript
// Load on mount
useEffect(() => {
  const loadFilters = async () => {
    const saved = await AsyncStorage.getItem('carePlanFilters');
    if (saved) {
      const filters = JSON.parse(saved);
      setSelectedStatus(filters.status);
      setSelectedCareLevel(filters.careLevel);
      setSelectedRoom(filters.room);
      setSortBy(filters.sortBy);
    }
  };
  loadFilters();
}, []);

// Save on change
useEffect(() => {
  AsyncStorage.setItem('carePlanFilters', JSON.stringify({
    status: selectedStatus,
    careLevel: selectedCareLevel,
    room: selectedRoom,
    sortBy: sortBy
  }));
}, [selectedStatus, selectedCareLevel, selectedRoom, sortBy]);
```

#### 3. Filter Count Badges
**Why**: User can see how many items match before selecting
**What**: Show count next to filter options
**Example**: "Active (23)" "要介護3 (5)"
**Estimate**: 30 mins

#### 4. Collapsible Filter Section
**Why**: If user wants even more space for cards
**What**: Toggle to hide/show filters, remember state
**Estimate**: 1 hour

### Low Priority - Nice to Have

#### 5. Keyboard Support for Room Picker
**Why**: Accessibility
**What**: Arrow keys + Enter to select room
**Estimate**: 45 mins

#### 6. Multi-Select Filters
**Why**: Select multiple care levels at once
**What**: Change care level filter to multi-select
**Note**: Would need to update filter logic from single to array
**Estimate**: 1.5 hours

#### 7. Export/Print Care Plans List
**Why**: Generate reports
**What**: Export filtered list to PDF/CSV
**Estimate**: 2-3 hours

---

## Known Technical Debt

### Card Component Margin
**Issue**: Card component has default `marginBottom: SPACING.lg`
**Current Fix**: Override with `marginBottom: 0` in consuming components
**Better Fix**: Add `noMargin` prop to Card component
**Location**: `ipad-app/src/components/ui/Card.tsx`

```typescript
interface CardProps {
  // ... existing props
  noMargin?: boolean;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    // Don't set marginBottom here
  },
  withMargin: {
    marginBottom: SPACING.lg,
  },
});

// In component:
const cardStyles = [
  styles.base,
  !noMargin && styles.withMargin,
  // ... other styles
];
```

### Filter Section Duplication
**Issue**: Similar filter UI might be needed on other screens
**Better Fix**: Extract to reusable component
**Estimate**: 2 hours

---

## Future Features (Not Started)

### Care Plan Comparison View
**What**: Compare 2+ care plans side by side
**Why**: Track progress over time, compare patients
**Estimate**: 3-4 hours

### Bulk Actions
**What**: Select multiple care plans for bulk operations
**Why**: Efficiency for care managers
**Examples**:
- Bulk export
- Bulk status change
- Bulk assignment
**Estimate**: 4-5 hours

### Care Plan Templates
**What**: Create care plan from template
**Why**: Faster creation for common conditions
**Estimate**: 5-6 hours

### Analytics Dashboard
**What**: Visual charts/graphs for care plan metrics
**Why**: Management oversight, trends
**Estimate**: 6-8 hours

---

## Testing Checklist

### Before Deploying All Care Plans Feature
- [x] Works with 1 patient
- [ ] Test with 50+ patients
- [ ] Test with 200+ rooms
- [ ] Test all filter combinations
- [ ] Test sorting options
- [ ] Test on physical iPad (not just simulator)
- [ ] Test with low connectivity (offline mode)
- [ ] Test pull-to-refresh
- [ ] Test modal picker on different screen sizes
- [ ] Performance test with 100+ care plans

### Accessibility
- [ ] Screen reader support
- [ ] Color contrast ratios
- [ ] Touch target sizes (all > 44x44px)
- [ ] Keyboard navigation
- [ ] Proper focus management

---

## Deployment Notes

### Files to Deploy
```bash
# Backend
backend/src/routes/care-plans.js

# Frontend (all in ipad-app/)
src/screens/AllCarePlansScreen.tsx
src/screens/DashboardScreen.tsx
src/types/app.ts
src/services/api.ts
src/stores/carePlanStore.ts
App.tsx
```

### Database Migrations
None required - uses existing schema.

### Environment Variables
None new - uses existing config.

---

## Questions for Product Owner

1. **Room Picker**: Do we need search now or wait until we have 50+ rooms?
2. **Filter Persistence**: Should filters persist across app restarts?
3. **Default Filters**: Should "Active" always be selected by default?
4. **Empty States**: What should we show if no care plans match filters?
5. **Performance**: What's the max number of care plans we expect?
6. **Offline Mode**: Should filtering work offline or require fresh data?

---

## Session Recovery Info

**Last Working State:**
- All Care Plans page fully functional
- Filters optimized (64px height)
- Card spacing minimal (6px gaps)
- Room picker modal working
- All committed and pushed to GitHub

**If Restarting:**
1. Pull latest from main: `git pull origin main`
2. Check expo is running: `cd ipad-app && npx expo start`
3. Navigate to All Care Plans to verify
4. Review SESSION_NOTES.md for context
5. Pick item from TODO.md to work on next

**Key Files to Know:**
- `ipad-app/src/screens/AllCarePlansScreen.tsx` - Main implementation
- `ipad-app/src/components/ui/Card.tsx` - Has default marginBottom issue
- `backend/src/routes/care-plans.js` - GET /all endpoint
