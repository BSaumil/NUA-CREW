import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { EMPTY_FILTERS, type JobFilters } from '@/features/filters';

const KEY = 'nua.filters';

type Ctx = {
  filters: JobFilters;
  setFilters: (f: JobFilters | ((prev: JobFilters) => JobFilters)) => void;
  reset: () => void;
};
const FiltersContext = createContext<Ctx | null>(null);

/** Remembers the last search so reopening the app shows what the person was looking at. */
export function FiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setState] = useState<JobFilters>(EMPTY_FILTERS);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        // "Near me" is never restored: location is requested again, on purpose, each session.
        setState({
          ...EMPTY_FILTERS,
          ...(JSON.parse(raw) as Partial<JobFilters>),
          near: null,
          radius_km: null,
        });
      })
      .catch(() => undefined);
  }, []);

  const setFilters = useCallback((f: JobFilters | ((prev: JobFilters) => JobFilters)) => {
    setState((prev) => {
      const next = typeof f === 'function' ? f(prev) : f;
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ filters, setFilters, reset: () => setFilters(EMPTY_FILTERS) }),
    [filters, setFilters],
  );
  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters(): Ctx {
  const v = useContext(FiltersContext);
  if (!v) throw new Error('useFilters must be used inside FiltersProvider');
  return v;
}
