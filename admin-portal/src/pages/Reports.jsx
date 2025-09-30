import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Card,
  CardContent,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Alert,
  Divider,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Assessment as AssessmentIcon,
  Security as SecurityIcon,
  FileDownload as FileDownloadIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import dayjs from 'dayjs';

import api from '../services/api';

const Reports = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [reportType, setReportType] = useState('medication_compliance');
  const [dateRange, setDateRange] = useState({
    start: dayjs().subtract(7, 'days').format('YYYY-MM-DD'),
    end: dayjs().format('YYYY-MM-DD'),
  });
  const [verificationResult, setVerificationResult] = useState(null);
  const [verifying, setVerifying] = useState(false);

  const facilityId = '550e8400-e29b-41d4-a716-446655440001';

  const handleExportHL7 = async (type) => {
    try {
      const data = await api.exportHL7(facilityId, type, dateRange.start);

      // Create downloadable file
      const content = data.data.messages.map(msg => msg.message).join('\n\n');
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `verbumcare-hl7-${type}-${dayjs().format('YYYY-MM-DD')}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      enqueueSnackbar(t('messages.export_generated'), { variant: 'success' });
    } catch (error) {
      console.error('Export error:', error);
      enqueueSnackbar(t('common.error'), { variant: 'error' });
    }
  };

  const handleExportSSMix2 = async () => {
    try {
      const data = await api.exportSSMix2(facilityId);

      // Create downloadable JSON file
      const content = JSON.stringify(data.data, null, 2);
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `verbumcare-ss-mix2-${dayjs().format('YYYY-MM-DD')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      enqueueSnackbar(t('messages.export_generated'), { variant: 'success' });
    } catch (error) {
      console.error('Export error:', error);
      enqueueSnackbar(t('common.error'), { variant: 'error' });
    }
  };

  const handleVerifyChain = async () => {
    setVerifying(true);
    try {
      const result = await api.verifyChainIntegrity(facilityId);
      setVerificationResult(result.data);
    } catch (error) {
      console.error('Verification error:', error);
      enqueueSnackbar(t('common.error'), { variant: 'error' });
    } finally {
      setVerifying(false);
    }
  };

  const exportCards = [
    {
      title: t('reports.hl7_export'),
      description: 'Export patient data, vital signs, and medication records in HL7 v2.5 format',
      icon: <AssessmentIcon />,
      actions: [
        { label: 'All Data', onClick: () => handleExportHL7('all') },
        { label: 'Patients Only', onClick: () => handleExportHL7('patients') },
        { label: 'Vitals Only', onClick: () => handleExportHL7('vitals') },
        { label: 'Medications Only', onClick: () => handleExportHL7('medications') },
      ],
    },
    {
      title: t('reports.ss_mix2_export'),
      description: 'Export complete facility data in SS-MIX2 standard format',
      icon: <FileDownloadIcon />,
      actions: [
        { label: 'Export SS-MIX2', onClick: handleExportSSMix2 },
      ],
    },
  ];

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        {t('reports.title')}
      </Typography>

      <Grid container spacing={3}>
        {/* Date Range Selector */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('reports.date_range')}
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <TextField
                  label="Start Date"
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label="End Date"
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Export Options */}
        {exportCards.map((card, index) => (
          <Grid item xs={12} md={6} key={index}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ mr: 2, color: 'primary.main' }}>
                    {card.icon}
                  </Box>
                  <Typography variant="h6">
                    {card.title}
                  </Typography>
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {card.description}
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {card.actions.map((action, actionIndex) => (
                    <Button
                      key={actionIndex}
                      variant="outlined"
                      startIcon={<DownloadIcon />}
                      onClick={action.onClick}
                      fullWidth
                    >
                      {action.label}
                    </Button>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}

        {/* Chain Verification */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <SecurityIcon sx={{ mr: 2, color: 'primary.main' }} />
                <Typography variant="h6">
                  {t('reports.chain_verification')}
                </Typography>
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Verify the cryptographic integrity of medication administration records.
                This ensures that all medication data has not been tampered with.
              </Typography>

              <Button
                variant="contained"
                onClick={handleVerifyChain}
                disabled={verifying}
                sx={{ mb: 2 }}
              >
                {verifying ? 'Verifying...' : t('reports.verify_integrity')}
              </Button>

              {verificationResult && (
                <Alert
                  severity={verificationResult.valid ? 'success' : 'error'}
                  sx={{ mt: 2 }}
                >
                  <Typography variant="subtitle2">
                    {verificationResult.valid
                      ? t('reports.chain_valid')
                      : t('reports.chain_invalid')
                    }
                  </Typography>
                  <Typography variant="body2">
                    {verificationResult.message}
                  </Typography>

                  {verificationResult.brokenLinks && verificationResult.brokenLinks.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body2">
                        Broken links found at sequences: {verificationResult.brokenLinks.map(link => link.sequence).join(', ')}
                      </Typography>
                    </Box>
                  )}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Report Types */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('reports.report_type')}
              </Typography>

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>{t('reports.report_type')}</InputLabel>
                <Select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  label={t('reports.report_type')}
                >
                  <MenuItem value="medication_compliance">{t('reports.medication_compliance')}</MenuItem>
                  <MenuItem value="documentation_analysis">{t('reports.documentation_analysis')}</MenuItem>
                  <MenuItem value="adverse_events">{t('reports.adverse_events')}</MenuItem>
                  <MenuItem value="staff_productivity">{t('reports.staff_productivity')}</MenuItem>
                </Select>
              </FormControl>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {reportType === 'medication_compliance' &&
                  'Analyze medication administration compliance rates across patients and time periods.'}
                {reportType === 'documentation_analysis' &&
                  'Review documentation quality, time spent, and AI confidence scores.'}
                {reportType === 'adverse_events' &&
                  'Track and analyze adverse events and patient safety incidents.'}
                {reportType === 'staff_productivity' &&
                  'Measure staff productivity and workflow efficiency metrics.'}
              </Typography>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<DownloadIcon />}
                  disabled
                >
                  {t('reports.pdf_report')}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  disabled
                >
                  {t('reports.excel_export')}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Reports;