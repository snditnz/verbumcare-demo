# VerbumCare Project Structure

## Repository Organization

```
verbumcare-demo/
├── backend/              # Node.js/Express API server
├── ipad-app/            # React Native/Expo iPad application
├── admin-portal/        # React/Vite web admin interface
├── docs/                # Additional documentation
├── scripts/             # Utility scripts (SSL, mDNS, etc.)
├── services/            # External services (whisper-api.py)
├── nginx/               # Nginx reverse proxy configuration
├── ssl/                 # SSL certificate setup scripts
├── mdns/                # mDNS configuration
└── [root config files]  # Docker compose, deployment scripts
```

## Backend Structure (`backend/`)

### Directory Layout
```
backend/
├── src/
│   ├── config/          # Configuration files (translations.json)
│   ├── db/              # Database layer
│   │   ├── migrations/  # SQL migration files (numbered)
│   │   ├── index.js     # Database connection pool
│   │   ├── schema.sql   # Main schema definition
│   │   ├── seed.sql     # Demo data
│   │   └── seed.js      # Seed script runner
│   ├── routes/          # Express route handlers
│   │   ├── patients.js
│   │   ├── medications.js
│   │   ├── vitals.js
│   │   ├── voice.js
│   │   ├── care-plans.js
│   │   ├── clinicalNotes.js
│   │   ├── auth.js
│   │   └── [others]
│   ├── services/        # Business logic and external integrations
│   │   ├── aiExtraction.js
│   │   ├── ollamaService.js
│   │   ├── whisperLocal.js
│   │   ├── modelManager.js
│   │   ├── backgroundProcessor.js
│   │   ├── voiceProcessing.js
│   │   ├── hl7Export.js
│   │   └── soapTemplate.js
│   ├── utils/           # Utility functions
│   │   ├── i18n.js      # Internationalization helpers
│   │   └── crypto.js    # Barcode generation, hashing
│   └── server.js        # Main application entry point
├── uploads/             # File storage (voice recordings, photos)
├── .env                 # Environment configuration
├── .env.example         # Environment template
├── Dockerfile           # Container definition
└── package.json         # Dependencies and scripts
```

### Backend Conventions

**Route Structure**
- Routes are organized by resource (patients, medications, vitals, etc.)
- Each route file exports an Express router
- Routes use async/await for database operations
- All routes support multi-language responses via `Accept-Language` header

**Database Access**
- Direct SQL queries using `pg` driver (no ORM)
- Database connection pool managed in `db/index.js`
- Parameterized queries to prevent SQL injection
- UUIDs for all primary keys

**Error Handling**
- Try-catch blocks in all async route handlers
- Language-aware error messages via `i18n.js`
- Consistent response format: `{ success, data, error, language, message }`

**Service Layer**
- Services encapsulate complex business logic
- AI services (Ollama, Whisper) have health checks and fallback modes
- Background processor handles async voice processing with Socket.IO updates

## iPad App Structure (`ipad-app/`)

### Directory Layout
```
ipad-app/
├── src/
│   ├── components/      # Reusable UI components
│   │   ├── ui/          # Generic UI components
│   │   ├── vitals/      # Vitals-specific components
│   │   ├── BLEIndicator.tsx
│   │   ├── VoiceRecorder.tsx
│   │   └── [others]
│   ├── screens/         # Full-screen views
│   │   ├── DashboardScreen.tsx
│   │   ├── PatientListScreen.tsx
│   │   ├── PatientInfoScreen.tsx
│   │   ├── VitalsCaptureScreen.tsx
│   │   ├── CarePlanHubScreen.tsx
│   │   ├── ClinicalNotesScreen.tsx
│   │   └── [30+ screens]
│   ├── services/        # API and external service integrations
│   │   ├── api.ts       # Main API client (axios)
│   │   ├── ble.ts       # Bluetooth Low Energy service
│   │   ├── voice.ts     # Voice recording service
│   │   ├── socket.ts    # WebSocket client
│   │   ├── cacheService.ts      # AsyncStorage caching
│   │   ├── secureCache.ts       # Encrypted cache
│   │   ├── networkService.ts    # Network status
│   │   └── cacheWarmer.ts       # Prefetch on login
│   ├── stores/          # Zustand state management
│   │   ├── authStore.ts
│   │   ├── carePlanStore.ts
│   │   ├── clinicalNotesStore.ts
│   │   ├── assessmentStore.ts
│   │   └── vitalsHistoryStore.ts
│   ├── types/           # TypeScript type definitions
│   │   ├── api.ts       # API response types
│   │   ├── app.ts       # Application types
│   │   ├── ble.ts       # BLE device types
│   │   └── index.ts     # Type exports
│   ├── constants/       # Configuration and constants
│   │   ├── config.ts    # API URLs, facility IDs
│   │   ├── theme.ts     # Colors, spacing, typography
│   │   ├── translations.ts  # i18n strings
│   │   └── demoPatients.ts  # Demo data
│   └── utils/           # Helper functions
│       ├── healthcareAssessments.ts
│       ├── vitalSignsAssessment.ts
│       ├── patientDiff.ts
│       └── timeAgo.ts
├── ios/                 # Native iOS project (Xcode)
├── android/             # Native Android project (not actively used)
├── assets/              # Images, fonts, icons
├── App.tsx              # Root component
├── index.ts             # Entry point
└── package.json         # Dependencies and scripts
```

### iPad App Conventions

**Component Organization**
- Screens are full-page views in `src/screens/`
- Reusable components in `src/components/`
- Components use TypeScript with explicit prop types
- Functional components with hooks (no class components)

**State Management**
- Zustand stores for global state (auth, care plans, clinical notes)
- Local state with `useState` for component-specific data
- AsyncStorage for persistence (via cacheService)

**API Integration**
- Centralized API client in `services/api.ts`
- Offline-first: cache-first strategy with background sync
- All API methods return typed responses
- Error handling with try-catch and user-friendly messages

**Navigation**
- React Navigation with native-stack navigator
- Type-safe navigation with TypeScript
- Screen params defined in navigation types

**Styling**
- Inline styles using StyleSheet.create()
- Theme constants in `constants/theme.ts`
- Responsive design for iPad screen sizes

## Admin Portal Structure (`admin-portal/`)

### Directory Layout
```
admin-portal/
├── src/
│   ├── components/      # React components
│   │   ├── common/      # Shared components
│   │   │   ├── LanguageSwitcher.jsx
│   │   │   ├── LoadingOverlay.jsx
│   │   │   └── MetricsCard.jsx
│   │   ├── layout/      # Layout components
│   │   ├── patients/    # Patient-specific components
│   │   ├── medications/ # Medication components
│   │   ├── reports/     # Report components
│   │   └── staff/       # Staff management components
│   ├── pages/           # Page-level components
│   │   ├── Dashboard.jsx
│   │   ├── PatientManagement.jsx
│   │   ├── MedicationOrders.jsx
│   │   ├── Reports.jsx
│   │   ├── Settings.jsx
│   │   └── StaffManagement.jsx
│   ├── services/        # API integration
│   │   └── api.js       # Axios client
│   ├── translations/    # i18n JSON files
│   │   ├── en.json
│   │   ├── ja.json
│   │   └── zh-TW.json
│   ├── utils/           # Utility functions
│   │   └── i18n.js      # i18next configuration
│   ├── hooks/           # Custom React hooks
│   │   ├── useDashboard.js
│   │   ├── usePatients.js
│   │   └── useMedications.js
│   ├── App.jsx          # Root component with routing
│   └── main.jsx         # Entry point
├── index.html           # HTML template
├── vite.config.js       # Vite configuration
└── package.json         # Dependencies and scripts
```

### Admin Portal Conventions

**Component Structure**
- Pages in `src/pages/` are route-level components
- Reusable components in `src/components/` organized by feature
- Material-UI components for consistent design
- JSX (not TypeScript) for simplicity

**Data Fetching**
- TanStack React Query for server state management
- Custom hooks for data fetching logic
- Automatic refetching and caching

**Internationalization**
- i18next for multi-language support
- Translation files in `src/translations/`
- Language switcher in header

## Configuration Files

### Root Level
- `docker-compose.yml` - Standard development setup
- `docker-compose.nagare.yml` - Nagare hardware-specific config
- `docker-compose.ubuntu.yml` - Ubuntu server deployment
- `.gitignore` - Git ignore patterns
- `README.md` - Main project documentation

### Deployment Scripts
- `start.sh` - Generic startup script
- `nagare-start.sh` - Nagare-specific startup
- `ubuntu-server-start.sh` - Ubuntu server startup
- `m2-mac-start.sh` - Legacy M2 Mac startup (deprecated)
- `intel-mac-start.sh` - Legacy Intel Mac startup (deprecated)

### Testing Scripts
- `test-api.sh` - API endpoint testing
- `test-db-updates.sh` - Database update testing
- `test-ubuntu-api.sh` - Ubuntu deployment testing

## Documentation Files

### Root Documentation
- `PRODUCT_OVERVIEW.md` - Comprehensive product description
- `ARCHITECTURE_UPDATE.md` - Architecture evolution notes
- `STATUS.md` - Current project status
- `TODO.md` - Task tracking
- `SAFETY.md` - Safety and compliance notes
- `SECURITY.md` - Security considerations

### Deployment Documentation
- `NAGARE_DEPLOYMENT.md` - Nagare hardware deployment
- `NAGARE_SSL_MDNS_UPDATE.md` - SSL and mDNS setup
- `UBUNTU_DEPLOYMENT.md` - Ubuntu server deployment
- `UBUNTU_QUICK_START.md` - Quick Ubuntu setup guide
- `OFFLINE_AI_SETUP.md` - AI service configuration
- `OFFLINE_DATA_STRATEGY.md` - Offline data handling

### Session Notes
- `SESSION_NOTES.md` - Development session notes
- `SESSION_NOTES_2025-11-09.md` - Specific session notes
- `SESSION_SUMMARY_OCT21.md` - October summary
- Various iPad app session notes in `ipad-app/`

### Technical Documentation
- `docs/API_VOICE_PROCESSING.md` - Voice processing API docs
- `docs/SYSTEMD_SERVICES.md` - Systemd service configuration
- `PRE_DEMO_CHECKLIST.md` - Pre-demo verification steps

## Naming Conventions

### Files
- Backend: camelCase for JS files (`patientRoutes.js`, `ollamaService.js`)
- iPad App: PascalCase for components/screens (`PatientListScreen.tsx`)
- iPad App: camelCase for services/utils (`api.ts`, `cacheService.ts`)
- Database: snake_case for SQL files (`001_add_bilingual_support.sql`)

### Code
- **Variables/Functions**: camelCase (`getPatients`, `patientId`)
- **Components**: PascalCase (`PatientCard`, `VoiceRecorder`)
- **Constants**: UPPER_SNAKE_CASE (`API_CONFIG`, `FACILITY_ID`)
- **Database columns**: snake_case (`patient_id`, `family_name`)
- **API endpoints**: kebab-case (`/care-plans`, `/clinical-notes`)

### Database
- **Tables**: snake_case plural (`patients`, `medication_orders`)
- **Primary keys**: `{table_singular}_id` (`patient_id`, `order_id`)
- **Foreign keys**: Match referenced table's primary key
- **Timestamps**: `created_at`, `updated_at`, `deleted_at`

## Import Conventions

### Backend (ES Modules)
```javascript
import express from 'express';
import db from './db/index.js';
import { detectLanguage } from '../utils/i18n.js';
```
- Always include `.js` extension in relative imports
- Use ES module syntax (`import`/`export`)

### iPad App (TypeScript)
```typescript
import { Patient } from '@models';
import { apiService } from '@services/api';
import { COLORS, SPACING } from '@constants/theme';
```
- Path aliases configured in `tsconfig.json` (`@models`, `@services`, etc.)
- No file extensions needed

### Admin Portal (JavaScript)
```javascript
import React from 'react';
import { usePatients } from '../hooks/usePatients';
import MetricsCard from '../components/common/MetricsCard';
```
- Relative imports for local files
- No path aliases configured

## Key Architectural Patterns

### Offline-First (iPad App)
1. **Cache on Login**: Prefetch all patient data, care plans, schedules
2. **Cache-First Reads**: Check AsyncStorage before API calls
3. **Optimistic Updates**: Update UI immediately, sync in background
4. **Background Sync**: Automatic sync when connectivity restored
5. **Conflict Resolution**: Last-write-wins with audit trail

### Multi-Language Support
1. **Backend**: Detect language from `Accept-Language` header
2. **iPad App**: i18n strings in `constants/translations.ts`
3. **Admin Portal**: i18next with JSON translation files
4. **Database**: Separate columns for each language (`family_name`, `family_name_en`)

### API Response Format
```javascript
{
  success: true,
  data: { /* response data */ },
  language: 'ja',
  message: 'Success message'
}
```

### Error Response Format
```javascript
{
  success: false,
  error: 'Error message in requested language',
  language: 'ja'
}
```
