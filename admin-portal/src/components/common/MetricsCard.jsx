import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
} from '@mui/icons-material';

const MetricsCard = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  percentage,
  severity = 'default',
  color = 'primary.main',
}) => {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUpIcon color="success" sx={{ fontSize: 16 }} />;
      case 'down':
        return <TrendingDownIcon color="error" sx={{ fontSize: 16 }} />;
      default:
        return <TrendingFlatIcon color="action" sx={{ fontSize: 16 }} />;
    }
  };

  const getSeverityColor = () => {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'warning':
        return 'warning';
      case 'success':
        return 'success';
      default:
        return 'default';
    }
  };

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 4,
        },
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          {icon && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 40,
                height: 40,
                borderRadius: 1,
                bgcolor: color,
                color: 'white',
                mr: 2,
              }}
            >
              {React.cloneElement(icon, { fontSize: 'small' })}
            </Box>
          )}
          <Typography variant="h6" component="div" color="text.secondary" sx={{ flexGrow: 1 }}>
            {title}
          </Typography>
          {severity !== 'default' && (
            <Chip
              size="small"
              color={getSeverityColor()}
              variant="outlined"
            />
          )}
        </Box>

        <Typography variant="h4" component="div" sx={{ mb: 1, fontWeight: 'bold' }}>
          {value}
        </Typography>

        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {subtitle}
          </Typography>
        )}

        {(trend || percentage !== undefined) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {trend && getTrendIcon()}
            {percentage !== undefined && (
              <Typography
                variant="body2"
                color={trend === 'up' ? 'success.main' : trend === 'down' ? 'error.main' : 'text.secondary'}
              >
                {percentage > 0 ? '+' : ''}{percentage}%
              </Typography>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default MetricsCard;