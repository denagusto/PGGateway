import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { ScreenState } from './useScreenState'

/**
 * Wraps mock data in a real TanStack Query so screens use genuine
 * loading/error/data semantics, while the demo ?state= param can force
 * loading / error / empty for DESIGN.md §8 demonstration.
 */
export function useMockQuery<T>(
  key: unknown[],
  data: T,
  emptyData: T,
  screenState: ScreenState,
): UseQueryResult<T, Error> {
  return useQuery<T, Error>({
    queryKey: [...key, screenState],
    queryFn: async () => {
      // small delay so loading skeletons are perceptible when forced
      await new Promise((r) => setTimeout(r, screenState === 'loading' ? 100000 : 120))
      if (screenState === 'error') {
        throw new Error('Simulated API 5xx')
      }
      if (screenState === 'empty') {
        return emptyData
      }
      return data
    },
    // when forcing loading, keep it pending forever (no cached resolve)
    staleTime: 0,
    gcTime: 0,
  })
}
