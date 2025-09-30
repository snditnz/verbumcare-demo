import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

export function useMedicationOrders(facilityId, status = null) {
  return useQuery({
    queryKey: ['medication-orders', facilityId, status],
    queryFn: () => api.getMedicationOrders(facilityId, status),
    staleTime: 30000,
  });
}

export function useCreateMedicationOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.createMedicationOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medication-orders'] });
      queryClient.invalidateQueries({ queryKey: ['patient-medications'] });
    },
  });
}

export function useUpdateMedicationOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, updates }) => api.updateMedicationOrder(orderId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medication-orders'] });
      queryClient.invalidateQueries({ queryKey: ['patient-medications'] });
    },
  });
}