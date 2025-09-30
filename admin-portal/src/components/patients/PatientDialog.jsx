import React, { useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import dayjs from 'dayjs';

import { useCreatePatient, useUpdatePatient } from '../../hooks/usePatients';

const schema = yup.object({
  mrn: yup.string().required('validation.required'),
  family_name: yup.string().required('validation.required'),
  given_name: yup.string().required('validation.required'),
  date_of_birth: yup.date().required('validation.required'),
  gender: yup.string().required('validation.required'),
  room: yup.string(),
  bed: yup.string(),
  blood_type: yup.string(),
});

const PatientDialog = ({ open, onClose, patient, editMode = false }) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const createPatientMutation = useCreatePatient();
  const updatePatientMutation = useUpdatePatient();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      mrn: '',
      family_name: '',
      given_name: '',
      family_name_kana: '',
      given_name_kana: '',
      date_of_birth: '',
      gender: '',
      room: '',
      bed: '',
      blood_type: '',
    },
  });

  useEffect(() => {
    if (patient && editMode) {
      reset({
        mrn: patient.mrn || '',
        family_name: patient.family_name || '',
        given_name: patient.given_name || '',
        family_name_kana: patient.family_name_kana || '',
        given_name_kana: patient.given_name_kana || '',
        date_of_birth: patient.date_of_birth ? dayjs(patient.date_of_birth).format('YYYY-MM-DD') : '',
        gender: patient.gender || '',
        room: patient.room || '',
        bed: patient.bed || '',
        blood_type: patient.blood_type || '',
      });
    } else if (!editMode) {
      reset({
        mrn: '',
        family_name: '',
        given_name: '',
        family_name_kana: '',
        given_name_kana: '',
        date_of_birth: '',
        gender: '',
        room: '',
        bed: '',
        blood_type: '',
      });
    }
  }, [patient, editMode, reset]);

  const onSubmit = async (data) => {
    try {
      if (editMode) {
        await updatePatientMutation.mutateAsync({
          patientId: patient.patient_id,
          updates: data,
        });
        enqueueSnackbar(t('messages.patient_updated'), { variant: 'success' });
      } else {
        await createPatientMutation.mutateAsync({
          ...data,
          facility_id: '550e8400-e29b-41d4-a716-446655440001',
          admission_date: new Date().toISOString().split('T')[0],
        });
        enqueueSnackbar(t('messages.patient_created'), { variant: 'success' });
      }
      onClose();
    } catch (error) {
      console.error('Error saving patient:', error);
      enqueueSnackbar(t('common.error'), { variant: 'error' });
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {editMode ? t('patients.edit_patient') : t('patients.add_patient')}
      </DialogTitle>

      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <Controller
                name="mrn"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label={t('patients.mrn')}
                    fullWidth
                    error={!!errors.mrn}
                    helperText={errors.mrn?.message && t(errors.mrn.message)}
                    disabled={editMode} // MRN shouldn't be editable
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Controller
                name="gender"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.gender}>
                    <InputLabel>{t('patients.gender')}</InputLabel>
                    <Select {...field} label={t('patients.gender')}>
                      <MenuItem value="male">{t('patients.male')}</MenuItem>
                      <MenuItem value="female">{t('patients.female')}</MenuItem>
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Controller
                name="family_name"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label={t('patients.family_name')}
                    fullWidth
                    error={!!errors.family_name}
                    helperText={errors.family_name?.message && t(errors.family_name.message)}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Controller
                name="given_name"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label={t('patients.given_name')}
                    fullWidth
                    error={!!errors.given_name}
                    helperText={errors.given_name?.message && t(errors.given_name.message)}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Controller
                name="family_name_kana"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label={t('patients.family_name_kana')}
                    fullWidth
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Controller
                name="given_name_kana"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label={t('patients.given_name_kana')}
                    fullWidth
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Controller
                name="date_of_birth"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label={t('patients.date_of_birth')}
                    type="date"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    error={!!errors.date_of_birth}
                    helperText={errors.date_of_birth?.message && t(errors.date_of_birth.message)}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Controller
                name="blood_type"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel>{t('patients.blood_type')}</InputLabel>
                    <Select {...field} label={t('patients.blood_type')}>
                      <MenuItem value="A+">A+</MenuItem>
                      <MenuItem value="A-">A-</MenuItem>
                      <MenuItem value="B+">B+</MenuItem>
                      <MenuItem value="B-">B-</MenuItem>
                      <MenuItem value="AB+">AB+</MenuItem>
                      <MenuItem value="AB-">AB-</MenuItem>
                      <MenuItem value="O+">O+</MenuItem>
                      <MenuItem value="O-">O-</MenuItem>
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Controller
                name="room"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label={t('patients.room')}
                    fullWidth
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Controller
                name="bed"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label={t('patients.bed')}
                    fullWidth
                  />
                )}
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose} disabled={isSubmitting}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting}
          >
            {isSubmitting ? t('common.loading') : t('common.save')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default PatientDialog;