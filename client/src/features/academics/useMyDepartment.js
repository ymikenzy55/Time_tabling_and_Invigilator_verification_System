import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { departmentsApi } from './departmentsApi';
import { useAuth } from '@/context/AuthContext';

export const useMyDepartment = (options = {}) => {
  const { user, refresh } = useAuth();
  const {
    queryKey = ['my-department'],
    refetchIntervalMs = 30_000,
    enabled = true,
    staleTime,
    refetchOnWindowFocus,
    refetchInterval,
    refetchIntervalInBackground,
    ...rest
  } = options;

  const query = useQuery({
    queryKey,
    queryFn: () => departmentsApi.getMine(),
    enabled,
    staleTime: staleTime ?? 5 * 60_000,
    refetchOnWindowFocus: refetchOnWindowFocus ?? false,
    refetchInterval: refetchInterval ?? ((data) => (data?.meta?.placeholder ? refetchIntervalMs : false)),
    refetchIntervalInBackground: refetchIntervalInBackground ?? false,
    ...rest,
  });

  useEffect(() => {
    const departmentId = query.data?.department?.id;
    if (departmentId && user?.departmentId !== departmentId) {
      refresh().catch(() => {/* ignored */});
    }
  }, [query.data?.department?.id, user?.departmentId, refresh]);

  return query;
};
