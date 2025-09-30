import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, CircularProgress, Box } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SnackbarProvider } from 'notistack';
import { I18nextProvider } from 'react-i18next';

import i18n from './utils/i18n';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import PatientManagement from './pages/PatientManagement';

// Lazy load other pages for better performance
const StaffManagement = React.lazy(() => import('./pages/StaffManagement'));
const MedicationOrders = React.lazy(() => import('./pages/MedicationOrders'));
const Reports = React.lazy(() => import('./pages/Reports'));
const Settings = React.lazy(() => import('./pages/Settings'));

// Create Material-UI theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#2196f3', // Blue - trust, healthcare
    },
    secondary: {
      main: '#4caf50', // Green - success, health
    },
    error: {
      main: '#f44336', // Red - alerts
    },
    warning: {
      main: '#ff9800', // Orange - warnings
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        },
      },
    },
    MuiDataGrid: {
      styleOverrides: {
        root: {
          border: 'none',
          borderRadius: 12,
        },
      },
    },
  },
});

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30000, // 30 seconds
      cacheTime: 300000, // 5 minutes
    },
    mutations: {
      retry: 1,
    },
  },
});

// Loading component
const PageLoader = () => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: 200,
    }}
  >
    <CircularProgress />
  </Box>
);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <SnackbarProvider
            maxSnack={3}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
          >
            <Router>
              <Routes>
                <Route path="/" element={<Layout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="patients" element={<PatientManagement />} />
                  <Route
                    path="staff"
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <StaffManagement />
                      </Suspense>
                    }
                  />
                  <Route
                    path="medications"
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <MedicationOrders />
                      </Suspense>
                    }
                  />
                  <Route
                    path="reports"
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <Reports />
                      </Suspense>
                    }
                  />
                  <Route
                    path="settings"
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <Settings />
                      </Suspense>
                    }
                  />
                </Route>
              </Routes>
            </Router>
          </SnackbarProvider>
        </ThemeProvider>
      </I18nextProvider>
    </QueryClientProvider>
  );
}

export default App;