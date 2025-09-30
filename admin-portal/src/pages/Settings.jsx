import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Save as SaveIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';

const Settings = () => {
  const { t, i18n } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [facilitySettings, setFacilitySettings] = useState({
    facility_name: '名古屋総合病院',
    facility_name_en: 'Nagoya General Hospital',
    timezone: 'Asia/Tokyo',
    default_language: 'ja',
  });

  const [userPreferences, setUserPreferences] = useState({
    theme: 'light',
    auto_refresh: true,
    notifications_enabled: true,
    default_page_size: 25,
  });

  const [apiSettings, setApiSettings] = useState({
    api_url: 'http://localhost:3000/api',
    timeout: 30000,
    retry_attempts: 3,
  });

  const handleFacilityChange = (field, value) => {
    setFacilitySettings(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handlePreferenceChange = (field, value) => {
    setUserPreferences(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleApiChange = (field, value) => {
    setApiSettings(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = () => {
    // In a real app, you'd save these to the backend
    enqueueSnackbar('Settings saved successfully', { variant: 'success' });
  };

  const handleLanguageChange = (language) => {
    i18n.changeLanguage(language);
    handleFacilityChange('default_language', language);
  };

  const timezones = [
    { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
    { value: 'UTC', label: 'UTC' },
    { value: 'America/New_York', label: 'America/New_York (EST)' },
    { value: 'Europe/London', label: 'Europe/London (GMT)' },
  ];

  const languages = [
    { value: 'en', label: 'English' },
    { value: 'ja', label: '日本語' },
    { value: 'zh-TW', label: '繁體中文' },
  ];

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        {t('settings.title')}
      </Typography>

      <Grid container spacing={3}>
        {/* Facility Information */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('settings.facility_info')}
              </Typography>

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label={t('settings.facility_name')}
                    value={facilitySettings.facility_name}
                    onChange={(e) => handleFacilityChange('facility_name', e.target.value)}
                    fullWidth
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    label={`${t('settings.facility_name')} (English)`}
                    value={facilitySettings.facility_name_en}
                    onChange={(e) => handleFacilityChange('facility_name_en', e.target.value)}
                    fullWidth
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>{t('settings.timezone')}</InputLabel>
                    <Select
                      value={facilitySettings.timezone}
                      onChange={(e) => handleFacilityChange('timezone', e.target.value)}
                      label={t('settings.timezone')}
                    >
                      {timezones.map((tz) => (
                        <MenuItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>{t('settings.default_language')}</InputLabel>
                    <Select
                      value={facilitySettings.default_language}
                      onChange={(e) => handleLanguageChange(e.target.value)}
                      label={t('settings.default_language')}
                    >
                      {languages.map((lang) => (
                        <MenuItem key={lang.value} value={lang.value}>
                          {lang.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* User Preferences */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('settings.user_preferences')}
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={userPreferences.auto_refresh}
                      onChange={(e) => handlePreferenceChange('auto_refresh', e.target.checked)}
                    />
                  }
                  label="Auto-refresh data"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={userPreferences.notifications_enabled}
                      onChange={(e) => handlePreferenceChange('notifications_enabled', e.target.checked)}
                    />
                  }
                  label="Enable notifications"
                />

                <FormControl fullWidth>
                  <InputLabel>Theme</InputLabel>
                  <Select
                    value={userPreferences.theme}
                    onChange={(e) => handlePreferenceChange('theme', e.target.value)}
                    label="Theme"
                  >
                    <MenuItem value="light">Light</MenuItem>
                    <MenuItem value="dark">Dark</MenuItem>
                    <MenuItem value="auto">Auto</MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel>Default Page Size</InputLabel>
                  <Select
                    value={userPreferences.default_page_size}
                    onChange={(e) => handlePreferenceChange('default_page_size', e.target.value)}
                    label="Default Page Size"
                  >
                    <MenuItem value={25}>25</MenuItem>
                    <MenuItem value={50}>50</MenuItem>
                    <MenuItem value={100}>100</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* API Configuration */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('settings.api_configuration')}
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="API URL"
                  value={apiSettings.api_url}
                  onChange={(e) => handleApiChange('api_url', e.target.value)}
                  fullWidth
                />

                <TextField
                  label="Timeout (ms)"
                  type="number"
                  value={apiSettings.timeout}
                  onChange={(e) => handleApiChange('timeout', parseInt(e.target.value))}
                  fullWidth
                />

                <TextField
                  label="Retry Attempts"
                  type="number"
                  value={apiSettings.retry_attempts}
                  onChange={(e) => handleApiChange('retry_attempts', parseInt(e.target.value))}
                  fullWidth
                />

                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  fullWidth
                >
                  Test Connection
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Save Button */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<SaveIcon />}
              onClick={handleSave}
            >
              {t('common.save')}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Settings;