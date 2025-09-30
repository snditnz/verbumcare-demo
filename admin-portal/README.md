# VerbumCare Admin Portal

A comprehensive React web application for hospital administration built with Material-UI and React Query.

## Features

### 🏥 **Core Administration**
- **Dashboard**: Real-time metrics, patient status, alerts, and activity feeds
- **Patient Management**: Complete patient CRUD with detailed views
- **Staff Management**: Healthcare personnel administration
- **Medication Orders**: Prescription management and tracking
- **Reports & Analytics**: HL7/SS-MIX2 exports, chain verification
- **Settings**: Facility configuration and user preferences

### 🌍 **Multi-language Support**
- **Japanese (ja)**: 日本語 - Full healthcare terminology
- **English (en)**: Complete professional medical vocabulary
- **Traditional Chinese (zh-TW)**: 繁體中文 - Healthcare translations

### 🎨 **Modern UI/UX**
- **Material Design 3**: Professional healthcare interface
- **Responsive Design**: Desktop and tablet optimized
- **Dark/Light Theme**: Accessibility focused
- **Data Visualization**: Charts and analytics with Recharts
- **Real-time Updates**: React Query with auto-refresh

## Quick Start

### Prerequisites
- Node.js 18+
- VerbumCare Backend API running on port 3000

### Installation
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Environment Configuration
Create `.env` file:
```env
VITE_API_URL=http://localhost:3000/api
```

## Project Structure

```
admin-portal/src/
├── pages/                      # Main application pages
│   ├── Dashboard.jsx          # Overview with metrics and charts
│   ├── PatientManagement.jsx  # Patient CRUD with data grid
│   ├── StaffManagement.jsx    # Staff administration
│   ├── MedicationOrders.jsx   # Medication order management
│   ├── Reports.jsx            # Analytics and exports
│   └── Settings.jsx           # Configuration management
├── components/
│   ├── layout/                # Application layout components
│   │   ├── AppBar.jsx         # Top navigation bar
│   │   ├── Sidebar.jsx        # Navigation sidebar
│   │   └── Layout.jsx         # Main layout wrapper
│   ├── patients/              # Patient-specific components
│   │   ├── PatientDialog.jsx  # Patient add/edit modal
│   │   └── PatientDetails.jsx # Patient detail view with tabs
│   └── common/                # Reusable UI components
│       ├── LanguageSwitcher.jsx
│       ├── MetricsCard.jsx
│       └── LoadingOverlay.jsx
├── services/
│   └── api.js                 # Backend API client
├── hooks/                     # React Query hooks
│   ├── usePatients.js         # Patient data management
│   ├── useMedications.js      # Medication queries
│   └── useDashboard.js        # Dashboard metrics
├── translations/              # i18n translation files
│   ├── en.json               # English translations
│   ├── ja.json               # Japanese translations
│   └── zh-TW.json            # Traditional Chinese
└── utils/
    └── i18n.js               # Internationalization setup
```

## Key Components

### Dashboard
- **Real-time Metrics**: Medication compliance, documentation time, patient counts
- **Patient Status Grid**: Color-coded status indicators (green/yellow/red)
- **Active Alerts**: Critical patient conditions requiring attention
- **Activity Timeline**: Recent medication administrations and assessments
- **Charts**: Medication trends and documentation analytics

### Patient Management
- **Advanced Data Grid**: Sortable, filterable patient list
- **Patient Details**: Tabbed view with medications, vitals, assessments
- **Add/Edit Forms**: Comprehensive patient data entry with validation
- **Multi-language Names**: Support for Japanese kanji/kana and Chinese names
- **Status Tracking**: Visual indicators for patient condition

### Medication Orders
- **Order Management**: Create, edit, discontinue medication orders
- **Advanced Filtering**: By status, patient, medication name, route
- **PRN Medications**: Separate handling for "as needed" orders
- **Multi-language Drug Names**: Japanese, English, and Chinese names
- **HOT Code Integration**: Japanese medication coding standard

### Reports & Analytics
- **HL7 v2.5 Export**: Patient data, vital signs, medication records
- **SS-MIX2 Export**: Japanese healthcare standard format
- **Chain Verification**: Cryptographic integrity checking
- **Custom Reports**: Compliance, documentation, adverse events
- **Date Range Selection**: Flexible reporting periods

## API Integration

### React Query Configuration
```javascript
// Automatic caching and background updates
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,    // 30 seconds
      cacheTime: 300000,   // 5 minutes
      refetchInterval: 60000, // Auto-refresh every minute
    },
  },
});
```

### Custom Hooks Examples
```javascript
// Patient data with automatic caching
const { data: patients, isLoading } = usePatients(facilityId);

// Dashboard metrics with real-time updates
const { data: metrics } = useDashboardMetrics(facilityId);

// Mutations with optimistic updates
const createPatient = useCreatePatient();
```

## Language System

### Translation Structure
```javascript
// Hierarchical translation keys
{
  "patients": {
    "title": "Patient Management",
    "add_patient": "Add New Patient",
    "mrn": "Medical Record Number"
  },
  "validation": {
    "required": "This field is required"
  }
}
```

### Usage in Components
```jsx
import { useTranslation } from 'react-i18next';

const { t } = useTranslation();
return <Typography>{t('patients.title')}</Typography>;
```

## Styling & Theming

### Material-UI Theme
```javascript
const theme = createTheme({
  palette: {
    primary: { main: '#2196f3' },    // Healthcare blue
    secondary: { main: '#4caf50' },   // Success green
    error: { main: '#f44336' },       // Alert red
    warning: { main: '#ff9800' },     // Warning orange
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',       // No UPPERCASE buttons
          borderRadius: 8,             // Rounded corners
        },
      },
    },
  },
});
```

### Responsive Design
- **Breakpoints**: Mobile-first responsive design
- **Data Grid**: Automatic column sizing and mobile adaptation
- **Navigation**: Collapsible sidebar for mobile devices
- **Touch Targets**: Minimum 44px for accessibility

## Data Visualization

### Chart Components (Recharts)
```jsx
// Medication administration trends
<LineChart data={medicationTrendData}>
  <Line dataKey="administered" stroke="#2196f3" />
  <Line dataKey="scheduled" stroke="#ff9800" strokeDasharray="5 5" />
</LineChart>

// Documentation time analysis
<BarChart data={documentationTimeData}>
  <Bar dataKey="avgTime" fill="#4caf50" />
</BarChart>
```

### Real-time Updates
- **WebSocket Integration**: Future enhancement for live updates
- **Polling Fallback**: Current 30-second refresh intervals
- **Optimistic Updates**: Immediate UI feedback for mutations

## Security Features

### Data Validation
```javascript
// Form validation with Yup
const schema = yup.object({
  mrn: yup.string().required('validation.required'),
  family_name: yup.string().required('validation.required'),
  date_of_birth: yup.date().required('validation.required'),
});
```

### Error Handling
- **Network Errors**: Automatic retry with exponential backoff
- **Validation Errors**: User-friendly form feedback
- **Authorization**: Ready for JWT token integration
- **Audit Logging**: All actions logged for compliance

## Performance Optimization

### Code Splitting
```javascript
// Lazy loading for better initial load times
const StaffManagement = React.lazy(() => import('./pages/StaffManagement'));
```

### Caching Strategy
- **React Query**: Intelligent background data synchronization
- **Local Storage**: Language preferences and user settings
- **Memoization**: Expensive component optimizations

## Development Workflow

### Available Scripts
```bash
npm run dev      # Development server with hot reload
npm run build    # Production build
npm run preview  # Preview production build
npm run lint     # ESLint code analysis
```

### Development Tools
- **React Developer Tools**: Component debugging
- **React Query DevTools**: Cache inspection
- **i18n DevTools**: Translation debugging
- **Material-UI Theme Inspector**: Design system debugging

## Integration with Backend

### API Client Configuration
```javascript
// Automatic language header injection
this.client.interceptors.request.use((config) => {
  const language = localStorage.getItem('language') || 'en';
  config.headers['Accept-Language'] = language;
  return config;
});
```

### Error Handling
```javascript
// Centralized error handling with user feedback
this.client.interceptors.response.use(
  (response) => response,
  (error) => {
    enqueueSnackbar(t('common.error'), { variant: 'error' });
    return Promise.reject(error);
  }
);
```

## Deployment

### Production Build
```bash
npm run build
```

### Environment Variables
```env
VITE_API_URL=https://api.verbumcare.com/api
VITE_SENTRY_DSN=your_sentry_dsn
VITE_GA_TRACKING_ID=your_ga_id
```

### Static Hosting
- **Vite Build**: Optimized static assets
- **CDN Ready**: Cacheable resources with fingerprinting
- **Service Worker**: Ready for PWA enhancement

## Browser Support

- **Chrome**: 90+
- **Firefox**: 88+
- **Safari**: 14+
- **Edge**: 90+

## Accessibility

- **WCAG 2.1**: Level AA compliance
- **Screen Readers**: ARIA labels and landmarks
- **Keyboard Navigation**: Full keyboard accessibility
- **High Contrast**: Theme support for visual impairments
- **Font Scaling**: Responsive to system font size settings

## Future Enhancements

### Planned Features
- **Real-time WebSocket Integration**: Live dashboard updates
- **Advanced Analytics**: Machine learning insights
- **Mobile PWA**: Progressive web app capabilities
- **Offline Support**: Service worker implementation
- **Advanced Role Management**: Granular permissions system

### Technical Improvements
- **TypeScript Migration**: Enhanced type safety
- **Automated Testing**: Jest and Testing Library
- **Performance Monitoring**: Real user metrics
- **Bundle Analysis**: Webpack bundle analyzer integration

## Testing

### Component Testing
```bash
# Unit tests with Jest and Testing Library
npm run test

# Component testing with Storybook
npm run storybook
```

### Integration Testing
- **API Integration**: Mock service worker
- **User Workflows**: End-to-end testing
- **Accessibility Testing**: axe-core integration

## Contributing

1. **Code Style**: ESLint + Prettier configuration
2. **Component Structure**: Functional components with hooks
3. **Translation Keys**: Hierarchical key naming
4. **API Integration**: React Query for all data fetching
5. **Error Handling**: Comprehensive user feedback

## License

This is a demonstration project for VerbumCare healthcare documentation system.