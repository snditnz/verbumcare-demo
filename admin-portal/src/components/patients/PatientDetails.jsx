import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Grid,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Card,
  CardContent,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

import LoadingOverlay from '../common/LoadingOverlay';
import { usePatientMedications, usePatientVitals, usePatientAssessments } from '../../hooks/usePatients';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`patient-tabpanel-${index}`}
      aria-labelledby={`patient-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const PatientDetails = ({ open, onClose, patient }) => {
  const { t } = useTranslation();
  const [tabValue, setTabValue] = useState(0);

  const { data: medications, isLoading: medicationsLoading } = usePatientMedications(patient?.patient_id);
  const { data: vitals, isLoading: vitalsLoading } = usePatientVitals(patient?.patient_id, 10);
  const { data: assessments, isLoading: assessmentsLoading } = usePatientAssessments(patient?.patient_id, 10);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  if (!patient) return null;

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'completed':
        return 'default';
      case 'discontinued':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        {t('patients.patient_details')} - {patient.family_name} {patient.given_name}
      </DialogTitle>

      <DialogContent>
        {/* Patient Basic Info */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="subtitle2" color="text.secondary">
                  {t('patients.mrn')}
                </Typography>
                <Typography variant="body1">{patient.mrn}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="subtitle2" color="text.secondary">
                  {t('patients.age')}
                </Typography>
                <Typography variant="body1">{patient.age} years</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="subtitle2" color="text.secondary">
                  {t('patients.room_bed')}
                </Typography>
                <Typography variant="body1">{patient.room}{patient.bed}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="subtitle2" color="text.secondary">
                  {t('patients.blood_type')}
                </Typography>
                <Typography variant="body1">{patient.blood_type}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="subtitle2" color="text.secondary">
                  {t('patients.admission_date')}
                </Typography>
                <Typography variant="body1">
                  {dayjs(patient.admission_date).format('MM/DD/YYYY')}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="subtitle2" color="text.secondary">
                  Status
                </Typography>
                <Chip
                  size="small"
                  color={patient.status === 'green' ? 'success' : patient.status === 'yellow' ? 'warning' : 'error'}
                  variant="filled"
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Tabs for different sections */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label={t('patients.medications_tab')} />
            <Tab label={t('patients.vitals_tab')} />
            <Tab label={t('patients.assessments_tab')} />
          </Tabs>
        </Box>

        {/* Medications Tab */}
        <TabPanel value={tabValue} index={0}>
          <LoadingOverlay loading={medicationsLoading}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('medications.medication_name')}</TableCell>
                    <TableCell>{t('medications.dose')}</TableCell>
                    <TableCell>{t('medications.route')}</TableCell>
                    <TableCell>{t('medications.frequency')}</TableCell>
                    <TableCell>{t('medications.status')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {medications?.data?.map((med) => (
                    <TableRow key={med.order_id}>
                      <TableCell>{med.medication_name}</TableCell>
                      <TableCell>{med.dose} {med.dose_unit}</TableCell>
                      <TableCell>{med.route}</TableCell>
                      <TableCell>{med.frequency}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={getStatusColor(med.status)}
                          label={med.status}
                          variant="outlined"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </LoadingOverlay>
        </TabPanel>

        {/* Vital Signs Tab */}
        <TabPanel value={tabValue} index={1}>
          <LoadingOverlay loading={vitalsLoading}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date/Time</TableCell>
                    <TableCell>Blood Pressure</TableCell>
                    <TableCell>Heart Rate</TableCell>
                    <TableCell>Temperature</TableCell>
                    <TableCell>SpO2</TableCell>
                    <TableCell>Pain Score</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {vitals?.data?.map((vital) => (
                    <TableRow key={vital.vital_sign_id}>
                      <TableCell>
                        {dayjs(vital.measured_at).format('MM/DD HH:mm')}
                      </TableCell>
                      <TableCell>
                        {vital.blood_pressure_systolic && vital.blood_pressure_diastolic
                          ? `${vital.blood_pressure_systolic}/${vital.blood_pressure_diastolic}`
                          : '-'}
                      </TableCell>
                      <TableCell>{vital.heart_rate || '-'}</TableCell>
                      <TableCell>
                        {vital.temperature_celsius ? `${vital.temperature_celsius}°C` : '-'}
                      </TableCell>
                      <TableCell>
                        {vital.oxygen_saturation ? `${vital.oxygen_saturation}%` : '-'}
                      </TableCell>
                      <TableCell>
                        {vital.pain_score !== null ? `${vital.pain_score}/10` : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </LoadingOverlay>
        </TabPanel>

        {/* Assessments Tab */}
        <TabPanel value={tabValue} index={2}>
          <LoadingOverlay loading={assessmentsLoading}>
            {assessments?.data?.map((assessment) => (
              <Card key={assessment.assessment_id} sx={{ mb: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="subtitle1">
                      {assessment.assessment_type} Assessment
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {dayjs(assessment.assessment_datetime).format('MM/DD/YYYY HH:mm')}
                    </Typography>
                  </Box>

                  {assessment.narrative_notes && (
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {assessment.narrative_notes}
                    </Typography>
                  )}

                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Chip
                      size="small"
                      label={assessment.input_method}
                      variant="outlined"
                    />
                    {assessment.ai_processed && (
                      <Chip
                        size="small"
                        label={`AI: ${Math.round(assessment.ai_confidence_score * 100)}%`}
                        color="info"
                        variant="outlined"
                      />
                    )}
                  </Box>
                </CardContent>
              </Card>
            ))}
          </LoadingOverlay>
        </TabPanel>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          {t('common.close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PatientDetails;