import { QueryClient, keepPreviousData } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
      staleTime: 5 * 60_000,
      gcTime: 10 * 60_000,
      placeholderData: keepPreviousData,
    },
    mutations: {
      retry: 0,
    },
  },
});
