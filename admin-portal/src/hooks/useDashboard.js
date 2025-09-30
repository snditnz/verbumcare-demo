import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

export function useDashboardMetrics(facilityId, date = null) {
  return useQuery({
    queryKey: ['dashboard-metrics', facilityId, date],
    queryFn: () => api.getDashboardMetrics(facilityId, date),
    staleTime: 60000, // 1 minute
    refetchInterval: 60000, // Refresh every minute
  });
}

export function usePatientStatus(facilityId) {
  return useQuery({
    queryKey: ['patient-status', facilityId],
    queryFn: () => api.getPatientStatus(facilityId),
    staleTime: 30000,
    refetchInterval: 30000,
  });
}

export function useRecentActivity(facilityId, limit = 20) {
  return useQuery({
    queryKey: ['recent-activity', facilityId, limit],
    queryFn: () => api.getRecentActivity(facilityId, limit),
    staleTime: 30000,
    refetchInterval: 30000,
  });
}

export function useAlerts(facilityId) {
  return useQuery({
    queryKey: ['alerts', facilityId],
    queryFn: () => api.getAlerts(facilityId),
    staleTime: 30000,
    refetchInterval: 30000,
  });
}