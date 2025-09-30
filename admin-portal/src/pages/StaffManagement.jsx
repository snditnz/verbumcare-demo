import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import { useTranslation } from 'react-i18next';

const StaffManagement = () => {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');

  // Mock data for demonstration
  const mockStaff = [
    {
      staff_id: '1',
      employee_number: 'N001',
      family_name: '佐藤',
      given_name: '美咲',
      role: 'registered_nurse',
      username: 'sato.misaki',
    },
    {
      staff_id: '2',
      employee_number: 'N002',
      family_name: '鈴木',
      given_name: '花子',
      role: 'registered_nurse',
      username: 'suzuki.hanako',
    },
    {
      staff_id: '3',
      employee_number: 'D001',
      family_name: '田中',
      given_name: '健一',
      role: 'physician',
      username: 'tanaka.kenichi',
    },
  ];

  const getRoleColor = (role) => {
    switch (role) {
      case 'physician':
        return 'primary';
      case 'registered_nurse':
        return 'success';
      case 'pharmacist':
        return 'info';
      default:
        return 'default';
    }
  };

  const columns = [
    {
      field: 'employee_number',
      headerName: t('staff.employee_number'),
      width: 150,
    },
    {
      field: 'name',
      headerName: 'Name',
      width: 200,
      valueGetter: (params) => {
        return `${params.row.family_name || ''} ${params.row.given_name || ''}`;
      },
    },
    {
      field: 'role',
      headerName: t('staff.role'),
      width: 180,
      renderCell: (params) => (
        <Chip
          size="small"
          color={getRoleColor(params.value)}
          label={t(`staff.${params.value}`)}
          variant="outlined"
        />
      ),
    },
    {
      field: 'username',
      headerName: t('staff.username'),
      width: 150,
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
          <IconButton size="small" title="Delete" color="error">
            <DeleteIcon />
          </IconButton>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          {t('staff.title')}
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />}>
          {t('staff.add_staff')}
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

      <Box sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={mockStaff}
          columns={columns}
          pageSize={25}
          rowsPerPageOptions={[25, 50, 100]}
          getRowId={(row) => row.staff_id}
          disableSelectionOnClick
          autoHeight
        />
      </Box>
    </Box>
  );
};

export default StaffManagement;