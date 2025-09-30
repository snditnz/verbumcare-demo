import React from 'react';
import {
  Box,
  Grid,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  Button,
} from '@mui/material';
import {
  Medication as MedicationIcon,
  Schedule as ScheduleIcon,
  People as PeopleIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import dayjs from 'dayjs';

import MetricsCard from '../components/common/MetricsCard';
import LoadingOverlay from '../components/common/LoadingOverlay';
import { useDashboardMetrics, usePatientStatus, useRecentActivity, useAlerts } from '../hooks/useDashboard';

const Dashboard = () => {
  const { t } = useTranslation();
  const facilityId = '550e8400-e29b-41d4-a716-446655440001';

  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useDashboardMetrics(facilityId);
  const { data: patientStatus, isLoading: patientsLoading } = usePatientStatus(facilityId);
  const { data: recentActivity, isLoading: activityLoading } = useRecentActivity(facilityId, 10);
  const { data: alerts, isLoading: alertsLoading } = useAlerts(facilityId);

  const handleRefresh = () => {
    refetchMetrics();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'green':
        return 'success';
      case 'yellow':
        return 'warning';
      case 'red':
        return 'error';
      default:
        return 'default';
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      default:
        return 'info';
    }
  };

  // Mock chart data for demonstration
  const medicationTrendData = [
    { time: '08:00', administered: 45, scheduled: 50 },
    { time: '12:00', administered: 48, scheduled: 52 },
    { time: '16:00', administered: 42, scheduled: 48 },
    { time: '20:00', administered: 38, scheduled: 45 },
  ];

  const documentationTimeData = [
    { day: 'Mon', avgTime: 2.1 },
    { day: 'Tue', avgTime: 2.3 },
    { day: 'Wed', avgTime: 1.9 },
    { day: 'Thu', avgTime: 2.2 },
    { day: 'Fri', avgTime: 2.0 },
    { day: 'Sat', avgTime: 2.4 },
    { day: 'Sun', avgTime: 2.1 },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t('dashboard.title')}
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={handleRefresh}
          disabled={metricsLoading}
        >
          {t('common.refresh')}
        </Button>
      </Box>

      {/* Key Metrics */}
      <LoadingOverlay loading={metricsLoading}>
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <MetricsCard
              title={t('dashboard.medications_administered')}
              value={`${metrics?.data?.medications?.administered || 0}/${metrics?.data?.medications?.total_scheduled || 0}`}
              subtitle={`${metrics?.data?.medications?.compliance_percentage || 0}% ${t('dashboard.compliance_rate')}`}
              icon={<MedicationIcon />}
              trend={metrics?.data?.medications?.compliance_percentage >= 95 ? 'up' : 'down'}
              color="primary.main"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MetricsCard
              title={t('dashboard.pending_medications')}
              value={metrics?.data?.medications?.pending || 0}
              severity={metrics?.data?.medications?.pending > 5 ? 'warning' : 'success'}
              icon={<ScheduleIcon />}
              color="warning.main"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MetricsCard
              title={t('dashboard.avg_documentation_time')}
              value={`${metrics?.data?.documentation?.avg_time_minutes || 2.3} ${t('dashboard.minutes')}`}
              subtitle="Target: < 5 min"
              icon={<ScheduleIcon />}
              trend="down"
              color="info.main"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MetricsCard
              title={t('dashboard.active_patients')}
              value={`${metrics?.data?.patients?.total || 0}`}
              subtitle={`${metrics?.data?.patients?.new_admissions || 0} new today`}
              icon={<PeopleIcon />}
              color="success.main"
            />
          </Grid>
        </Grid>
      </LoadingOverlay>

      <Grid container spacing={3}>
        {/* Charts */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Medication Administration Trend
              </Typography>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={medicationTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="administered" stroke="#2196f3" strokeWidth={2} />
                  <Line type="monotone" dataKey="scheduled" stroke="#ff9800" strokeWidth={2} strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Documentation Time Analysis
              </Typography>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={documentationTimeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="avgTime" fill="#4caf50" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Patient Status */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('dashboard.patient_status')}
              </Typography>
              <LoadingOverlay loading={patientsLoading}>
                <TableContainer sx={{ maxHeight: 300 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Patient</TableCell>
                        <TableCell>Room</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Alerts</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {patientStatus?.data?.slice(0, 5).map((patient) => (
                        <TableRow key={patient.patient_id}>
                          <TableCell>
                            {patient.family_name} {patient.given_name}
                          </TableCell>
                          <TableCell>
                            {patient.room}{patient.bed}
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              color={getStatusColor(patient.status)}
                              variant="filled"
                            />
                          </TableCell>
                          <TableCell>
                            {patient.alert_count > 0 && (
                              <Chip
                                size="small"
                                icon={<WarningIcon />}
                                label={patient.alert_count}
                                color="error"
                                variant="outlined"
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </LoadingOverlay>
            </CardContent>
          </Card>
        </Grid>

        {/* Alerts & Recent Activity */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('dashboard.alerts')}
              </Typography>
              <LoadingOverlay loading={alertsLoading}>
                <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                  {alerts?.data?.length > 0 ? (
                    alerts.data.slice(0, 3).map((alert, index) => (
                      <Alert
                        key={index}
                        severity={getSeverityColor(alert.severity)}
                        sx={{ mb: 1 }}
                      >
                        <strong>{alert.family_name} {alert.given_name}</strong> - {alert.alert_message}
                        <br />
                        <small>Room {alert.room}{alert.bed} • {dayjs(alert.measured_at).format('HH:mm')}</small>
                      </Alert>
                    ))
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No active alerts
                    </Typography>
                  )}
                </Box>
              </LoadingOverlay>

              <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                {t('dashboard.recent_activity')}
              </Typography>
              <LoadingOverlay loading={activityLoading}>
                <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                  {recentActivity?.data?.map((activity, index) => (
                    <Box key={index} sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="body2">
                        <strong>{activity.family_name} {activity.given_name}</strong> - {activity.description}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {dayjs(activity.timestamp).format('MM/DD HH:mm')} • {activity.staff_name} {activity.staff_given_name}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </LoadingOverlay>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;