import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  TextField,
  InputAdornment,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  IconButton,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import dayjs from 'dayjs';

import LoadingOverlay from '../components/common/LoadingOverlay';
import PatientDialog from '../components/patients/PatientDialog';
import PatientDetails from '../components/patients/PatientDetails';
import { usePatients, useUpdatePatient } from '../hooks/usePatients';

const PatientManagement = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const facilityId = '550e8400-e29b-41d4-a716-446655440001';

  const [searchText, setSearchText] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const { data: patients, isLoading, error } = usePatients(facilityId);
  const updatePatientMutation = useUpdatePatient();

  const handleAddPatient = () => {
    setSelectedPatient(null);
    setEditMode(false);
    setDialogOpen(true);
  };

  const handleEditPatient = (patient) => {
    setSelectedPatient(patient);
    setEditMode(true);
    setDialogOpen(true);
  };

  const handleViewPatient = (patient) => {
    setSelectedPatient(patient);
    setDetailsOpen(true);
  };

  const handleDeletePatient = async (patient) => {
    if (window.confirm(t('patients.delete_confirm'))) {
      try {
        // In a real app, you'd have a delete mutation
        enqueueSnackbar(t('messages.patient_deleted'), { variant: 'success' });
      } catch (error) {
        enqueueSnackbar(t('common.error'), { variant: 'error' });
      }
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedPatient(null);
    setEditMode(false);
  };

  const handleCloseDetails = () => {
    setDetailsOpen(false);
    setSelectedPatient(null);
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

  const columns = [
    {
      field: 'mrn',
      headerName: t('patients.mrn'),
      width: 120,
    },
    {
      field: 'name',
      headerName: t('patients.patient_name'),
      width: 200,
      valueGetter: (params) => {
        return `${params.row.family_name || ''} ${params.row.given_name || ''}`;
      },
    },
    {
      field: 'room_bed',
      headerName: t('patients.room_bed'),
      width: 100,
      valueGetter: (params) => {
        return `${params.row.room || ''}${params.row.bed || ''}`;
      },
    },
    {
      field: 'age',
      headerName: t('patients.age'),
      width: 80,
      type: 'number',
    },
    {
      field: 'gender',
      headerName: t('patients.gender'),
      width: 100,
      valueGetter: (params) => {
        return params.row.gender === 'male' ? t('patients.male') : t('patients.female');
      },
    },
    {
      field: 'blood_type',
      headerName: t('patients.blood_type'),
      width: 100,
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 100,
      renderCell: (params) => (
        <Chip
          size="small"
          color={getStatusColor(params.value)}
          variant="filled"
        />
      ),
    },
    {
      field: 'active_medications',
      headerName: 'Medications',
      width: 120,
      type: 'number',
    },
    {
      field: 'admission_date',
      headerName: t('patients.admission_date'),
      width: 120,
      valueFormatter: (params) => {
        return params.value ? dayjs(params.value).format('MM/DD/YYYY') : '';
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      sortable: false,
      renderCell: (params) => (
        <Box>
          <IconButton
            size="small"
            onClick={() => handleViewPatient(params.row)}
            title="View Details"
          >
            <VisibilityIcon />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => handleEditPatient(params.row)}
            title="Edit"
          >
            <EditIcon />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => handleDeletePatient(params.row)}
            title="Delete"
            color="error"
          >
            <DeleteIcon />
          </IconButton>
        </Box>
      ),
    },
  ];

  const filteredRows = (patients?.data || []).filter((patient) => {
    const searchLower = searchText.toLowerCase();
    return (
      patient.family_name?.toLowerCase().includes(searchLower) ||
      patient.given_name?.toLowerCase().includes(searchLower) ||
      patient.mrn?.toLowerCase().includes(searchLower) ||
      patient.room?.toLowerCase().includes(searchLower)
    );
  });

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">
          Error loading patients: {error.message}
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          {t('patients.title')}
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddPatient}
        >
          {t('patients.add_patient')}
        </Button>
      </Box>

      <Box sx={{ mb: 3 }}>
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
      </Box>

      <LoadingOverlay loading={isLoading}>
        <Box sx={{ height: 600, width: '100%' }}>
          <DataGrid
            rows={filteredRows}
            columns={columns}
            pageSize={25}
            rowsPerPageOptions={[25, 50, 100]}
            getRowId={(row) => row.patient_id}
            disableSelectionOnClick
            autoHeight
            sx={{
              '& .MuiDataGrid-cell:hover': {
                color: 'primary.main',
              },
            }}
          />
        </Box>
      </LoadingOverlay>

      <PatientDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        patient={selectedPatient}
        editMode={editMode}
      />

      <PatientDetails
        open={detailsOpen}
        onClose={handleCloseDetails}
        patient={selectedPatient}
      />
    </Box>
  );
};

export default PatientManagement;