import React from 'react';
import {
  Box,
  CircularProgress,
  Typography,
  Backdrop,
} from '@mui/material';
import { useTranslation } from 'react-i18next';

const LoadingOverlay = ({ loading, children, message }) => {
  const { t } = useTranslation();

  if (!loading) {
    return children;
  }

  return (
    <Box sx={{ position: 'relative', minHeight: 200 }}>
      {children}
      <Backdrop
        sx={{
          position: 'absolute',
          color: 'primary.main',
          zIndex: (theme) => theme.zIndex.drawer + 1,
          bgcolor: 'rgba(255, 255, 255, 0.8)',
        }}
        open={loading}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <CircularProgress color="primary" />
          <Typography variant="body1" color="primary">
            {message || t('common.loading')}
          </Typography>
        </Box>
      </Backdrop>
    </Box>
  );
};

export default LoadingOverlay;