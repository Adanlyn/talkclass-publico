import { useQuery } from '@tanstack/react-query';
import { getMe } from '../services/auth.service';

export function useCurrentAdmin(enabled = true) {
  return useQuery({
    queryKey: ['current-admin'],
    queryFn: getMe,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled,
  });
}
