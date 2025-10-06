# VerbumCare iPad App - Design System Documentation

## Overview

This design system implements the VerbumCare brand identity for the iPad nurse app with focus on:
- **Accessibility**: Large touch targets (52pt+), high contrast text, aging-friendly typography
- **Glove-friendly**: All interactive elements minimum 52pt
- **Voice-first**: Manual inputs as clear fallback options
- **Professional**: Modern medical aesthetic, warm but clinical

## Design Tokens

### Colors (`src/constants/theme.ts`)

**Brand Colors** (from VerbumCare logo)
- `primary`: #1B3A52 (Navy Blue)
- `secondary`: #5B9AAA (Warm Teal)
- `accent`: #FFFFFF (Medical White)

**Backgrounds**
- `background`: #F8F6F3 (Soft Cream)
- `surface`: #FFFFFF (Cards)

**Semantic Colors**
- `success`: #7CB342 (Soft Green)
- `warning`: #FFA726 (Warm Amber)
- `error`: #E57373 (Medical Red)

**Status Colors** (vitals, alerts)
- `normal`: Green - within range
- `warning`: Amber - attention needed
- `critical`: Red - urgent
- `neutral`: Gray - no data

### Typography

**Font Sizes** (accessibility-first)
- `xs`: 14pt (labels only)
- `sm`: 16pt (body minimum)
- `base`: 18pt (comfortable body)
- `lg`: 20pt (section labels)
- `xl`: 24pt (titles)
- `2xl`: 28pt (patient names)
- `3xl`: 32pt (vital values)
- `4xl`: 40pt (hero numbers)

**Font Families**
- Japanese: Noto Sans JP / System
- English: SF Pro / System
- Monospace: Menlo (codes)

### Spacing

**Base Unit**: 4pt
- `xs`: 4pt
- `sm`: 8pt
- `md`: 12pt
- `lg`: 16pt
- `xl`: 24pt
- `2xl`: 32pt
- `3xl`: 48pt

**Touch Targets**
- `min`: 52pt (minimum)
- `comfortable`: 56pt (buttons)
- `large`: 72pt (FAB)
- `xl`: 88pt (cards)

### Components

All reusable components in `src/components/ui/`:

#### Button
- Variants: primary, secondary, outline, text
- Sizes: small (52pt), medium (56pt), large (72pt)
- Auto accessibility labels
- Loading states built-in

#### Card
- Variants: default (shadow), elevated, outlined
- Status borders (4pt left border for vitals)
- Optional onPress for interactive cards
- Configurable padding

#### Input
- Large mode for vitals (64pt height, 32pt text)
- Unit display (mmHg, bpm, etc.)
- Error states with red border + text
- Accessible labels

#### StatusIndicator
- Color + Icon + Text (colorblind-friendly)
- Sizes: small, medium, large
- Backgrounds with 8.5% opacity
- Status types: normal, warning, critical, neutral

## Screen Layouts

### 1. Patient Selection Screen

**Header** (sticky, 64pt height)
- Logo (left, 32pt)
- Language toggle (right, flag icons)
- BLE status (subtle indicator)

**Search Section**
- Large search bar: 52pt height, "患者を検索"
- Room filter chips: Horizontally scrollable
- Floating barcode button: 72pt diameter, bottom-right, navy blue with pulse

**Patient Cards**
- Minimum 88pt height
- White background, 12pt radius, subtle shadow
- Layout:
  ```
  ┌─────────────────────────────┐
  │ [Name 24pt]      [Room #]   │
  │ [Age 18pt] [Gender] [Status]│
  │ [Last assessment time]       │
  └─────────────────────────────┘
  ```
- Status dots: Color + icon (colorblind-safe)
- 16pt spacing between cards
- Active state: Navy border, elevated

### 2. Vitals Screen

**Patient Context Bar** (sticky)
- Patient name + age + room
- "バイタルサイン / Vital Signs"
- Back button with label

**BLE Status Card**
- If disconnected: Gray background
  - Icon: Bluetooth-slash
  - "デバイス未接続 / Device Not Connected"
  - "手動入力してください / Please enter manually"
- If connected: Green background
  - Icon: Bluetooth-check
  - "デバイス接続済 / Connected"
  - Device name

**Vitals Grid** (2-3 columns responsive)
Each card:
- Icon + Label (top)
- Input field OR auto-populated value
- Unit label (mmHg, bpm, etc.)
- Color-coded left border:
  - Green: Normal range
  - Amber: Warning
  - Red: Critical
  - Gray: Empty

**Special Components**
- Blood Pressure: Two fields in one card
- Pain Scale: 0-10 with face emojis

**Bottom Actions**
- "スキップ" (text button, left)
- "次へ" (primary button, right, 56pt)

### 3. ADL Recording Screen

**Japanese Barthel Index Categories**
Use accordion cards:

```
食事 Eating               [10 / 5 / 0]
移乗 Transfer             [15 / 10 / 5 / 0]
整容 Grooming             [5 / 0]
トイレ動作 Toileting      [10 / 5 / 0]
入浴 Bathing              [5 / 0]
歩行 Walking              [15 / 10 / 5 / 0]
階段昇降 Stairs           [10 / 5 / 0]
着替え Dressing           [10 / 5 / 0]
排便管理 Bowel Control    [10 / 5 / 0]
排尿管理 Bladder Control  [10 / 5 / 0]
```

**Voice Recording**
- Large mic button: 120pt diameter, navy blue
- "音声記録 / Voice Record"
- Press & hold, waveform animation
- Processing: Spinner + "処理中..."
- Success: Checkmark + preview

**Manual Entry**
- Below voice: "手動入力 / Manual Entry" expandable
- Accordion style for categories
- Auto-populate from voice (yellow highlight)
- Override by tapping

**Additional Notes**
- Text area: 120pt min height
- "追加メモ / Additional Notes"
- Expandable

**Data Source Indicators**
- Blue dot: Voice
- Orange dot: Manual override
- Green dot: BLE

### 4. Review Screen

**Design**: Information Dashboard (NOT JSON)

**Patient Summary Card**
- User icon
- Name (28pt bold) + Photo (64pt circle)
- Age, Gender, Room
- Timestamp (large, prominent)

**Vitals Summary Card**
- Heart icon
- "バイタルサイン"
- 2-column grid:
  - Label (ja/en)
  - Value (32pt) + unit
  - Status dot + icon
  - Timestamp (if different)
- Color-coded left borders

**ADL Assessment Card**
- Checklist icon
- Total Barthel score: "85/100点" (large)
- Visual bar chart
- Expandable category list OR mini-cards grid
- Color: Green→Red gradient for independence

**Additional Notes Card**
- Document icon
- Formatted text display
- If empty: "追加メモなし"

**Data Sources** (bottom, subtle)
- Voice/Manual/BLE icons
- Audit trail

**Edit Buttons**
- Each card: "編集 / Edit" (top-right)
- Returns to screen with data

**Bottom Actions** (sticky)
- "下書き保存 / Save Draft" (outline)
- "送信 / Submit" (primary, confirmation dialog)

## Navigation

**Progress Stepper** (top of screen)
```
○ Patient → ○ Vitals → ○ ADL → ○ Review
```
- Current: Navy circle + white check
- Complete: Green + check
- Upcoming: Gray + number
- Labels below (14pt)

**Back Button**
- Always top-left
- Preserves data
- Confirms if data would be lost

**Draft System**
- Auto-save every 30s
- "最終保存: XX分前" (subtle)
- Resume on app open
- Modal: "下書きを続けますか?"

## Accessibility

**Touch Targets**: 52pt minimum
**Contrast**: 7:1 minimum (WCAG AAA)
**Feedback**:
- Haptic on button press
- Visual press state (scale 95%)
- Success/error: Icon + Color + Text

**Error States**:
- Invalid input: Red border + icon + text
- Network: Toast with retry
- BLE disconnect: Persistent banner
- Validation: Scroll to error with highlight

## Animations (Minimal)

**Allowed**:
- Screen transition: Slide 200ms
- Button press: Scale 100ms
- Loading: Spinner/progress
- Success: Checkmark fade 300ms
- Card expand: Height 200ms

**Avoid**:
- Decorative animations
- Parallax
- Complex transitions
- Anything delaying workflow

## Implementation Guide

### Step 1: Import New Theme
```typescript
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS } from '@constants/theme';
```

### Step 2: Use UI Components
```typescript
import { Button, Card, Input, StatusIndicator } from '@components/ui';
```

### Step 3: Apply Standards
- All touch targets ≥ 52pt
- Text sizes from TYPOGRAPHY.fontSize
- Colors from COLORS palette
- Spacing from SPACING constants
- Never hardcode values

### Step 4: Update Screens
Each screen should follow this structure:
```typescript
<SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
  <Header /> {/* Patient context bar */}
  <ScrollView>
    <Card>...</Card>
    <Card>...</Card>
  </ScrollView>
  <BottomActions /> {/* Sticky buttons */}
</SafeAreaView>
```

## Logo & Branding

**App Icon**:
- Use `/VerbumCare_Logo.png` (parent directory)
- Square with rounded corners
- Navy background (#1B3A52)
- White medical cross prominent
- "VC" monogram
- Master: 1024x1024

**In-App Logo**:
- Header: 32pt height
- White version on navy
- Full color on light backgrounds

## Next Steps

1. ✅ Design system created
2. ✅ UI components built
3. 🔄 Apply to Patient Selection screen (example below)
4. ⏳ Apply to Vitals screen
5. ⏳ Apply to ADL screen
6. ⏳ Apply to Review screen
7. ⏳ Add navigation progress
8. ⏳ Implement autosave
9. ⏳ Add haptics
10. ⏳ Create app icon

---

**Status**: Design system complete, ready for screen implementation.
See example implementation in next file.
