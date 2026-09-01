import { QueryClient, keepPreviousData } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
      staleTime: 2 * 60_000,
      gcTime: 5 * 60_000,
      placeholderData: keepPreviousData,
    },
    mutations: {
      retry: 0,
    },
  },
});
