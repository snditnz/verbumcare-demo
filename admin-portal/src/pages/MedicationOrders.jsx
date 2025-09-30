import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

import LoadingOverlay from '../components/common/LoadingOverlay';
import { useMedicationOrders } from '../hooks/useMedications';

const MedicationOrders = () => {
  const { t } = useTranslation();
  const facilityId = '550e8400-e29b-41d4-a716-446655440001';

  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data: orders, isLoading, error } = useMedicationOrders(facilityId, statusFilter || null);

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'completed':
        return 'default';
      case 'discontinued':
        return 'error';
      case 'on_hold':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getRouteLabel = (route) => {
    return t(`medications.routes.${route}`) || route;
  };

  const columns = [
    {
      field: 'order_number',
      headerName: t('medications.order_number'),
      width: 120,
    },
    {
      field: 'patient_name',
      headerName: 'Patient',
      width: 150,
      valueGetter: (params) => {
        return `${params.row.family_name || ''} ${params.row.given_name || ''}`;
      },
    },
    {
      field: 'room_bed',
      headerName: 'Room',
      width: 80,
      valueGetter: (params) => {
        return `${params.row.room || ''}${params.row.bed || ''}`;
      },
    },
    {
      field: 'medication_name',
      headerName: t('medications.medication_name'),
      width: 200,
    },
    {
      field: 'dose_info',
      headerName: t('medications.dose'),
      width: 120,
      valueGetter: (params) => {
        return `${params.row.dose || ''} ${params.row.dose_unit || ''}`;
      },
    },
    {
      field: 'route',
      headerName: t('medications.route'),
      width: 100,
      valueGetter: (params) => getRouteLabel(params.row.route),
    },
    {
      field: 'frequency',
      headerName: t('medications.frequency'),
      width: 100,
    },
    {
      field: 'scheduled_time',
      headerName: t('medications.scheduled_time'),
      width: 100,
      valueFormatter: (params) => {
        return params.value ? dayjs(`2000-01-01 ${params.value}`).format('HH:mm') : '';
      },
    },
    {
      field: 'prn',
      headerName: t('medications.prn'),
      width: 80,
      renderCell: (params) => (
        params.value ? <Chip size="small" label="PRN" color="info" variant="outlined" /> : null
      ),
    },
    {
      field: 'status',
      headerName: t('medications.status'),
      width: 120,
      renderCell: (params) => (
        <Chip
          size="small"
          color={getStatusColor(params.value)}
          label={t(`medications.${params.value}`)}
          variant="outlined"
        />
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Box>
          <IconButton size="small" title="Edit">
            <EditIcon />
          </IconButton>
          <IconButton size="small" title="Discontinue" color="error">
            <DeleteIcon />
          </IconButton>
        </Box>
      ),
    },
  ];

  const filteredRows = (orders?.data || []).filter((order) => {
    const searchLower = searchText.toLowerCase();
    return (
      order.family_name?.toLowerCase().includes(searchLower) ||
      order.given_name?.toLowerCase().includes(searchLower) ||
      order.medication_name?.toLowerCase().includes(searchLower) ||
      order.order_number?.toLowerCase().includes(searchLower)
    );
  });

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">
          Error loading medication orders: {error.message}
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          {t('medications.title')}
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />}>
          {t('medications.add_order')}
        </Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField
          placeholder={t('common.search')}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 300 }}
        />

        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel>{t('medications.status')}</InputLabel>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            label={t('medications.status')}
          >
            <MenuItem value="">{t('common.all')}</MenuItem>
            <MenuItem value="active">{t('medications.active')}</MenuItem>
            <MenuItem value="completed">{t('medications.completed')}</MenuItem>
            <MenuItem value="discontinued">{t('medications.discontinued')}</MenuItem>
            <MenuItem value="on_hold">{t('medications.on_hold')}</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <LoadingOverlay loading={isLoading}>
        <Box sx={{ height: 600, width: '100%' }}>
          <DataGrid
            rows={filteredRows}
            columns={columns}
            pageSize={25}
            rowsPerPageOptions={[25, 50, 100]}
            getRowId={(row) => row.order_id}
            disableSelectionOnClick
            autoHeight
          />
        </Box>
      </LoadingOverlay>
    </Box>
  );
};

export default MedicationOrders;