import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

export function usePatients(facilityId) {
  return useQuery({
    queryKey: ['patients', facilityId],
    queryFn: () => api.getPatients(facilityId),
    staleTime: 30000, // 30 seconds
  });
}

export function usePatient(patientId) {
  return useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => api.getPatient(patientId),
    enabled: !!patientId,
  });
}

export function usePatientMedications(patientId) {
  return useQuery({
    queryKey: ['patient-medications', patientId],
    queryFn: () => api.getPatientMedications(patientId),
    enabled: !!patientId,
  });
}

export function usePatientVitals(patientId, limit = 50) {
  return useQuery({
    queryKey: ['patient-vitals', patientId, limit],
    queryFn: () => api.getPatientVitals(patientId, limit),
    enabled: !!patientId,
  });
}

export function usePatientAssessments(patientId, limit = 20) {
  return useQuery({
    queryKey: ['patient-assessments', patientId, limit],
    queryFn: () => api.getPatientAssessments(patientId, limit),
    enabled: !!patientId,
  });
}

export function useCreatePatient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.createPatient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}

export function useUpdatePatient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ patientId, updates }) => api.updatePatient(patientId, updates),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['patient', variables.patientId] });
    },
  });
}