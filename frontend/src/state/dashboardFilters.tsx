// Estado global dos filtros do dashboard
import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';

export type FiltersState = {
  from: string;         // data inicial em ISO
  to: string;           // data final em ISO
  categoryId?: string | null;
  questionId?: string | null;
  curso?: string | null;
  turno?: string | null;
  unidade?: string | null;
  identified?: boolean | null;
};

const today = new Date();
const dayStr = (d: Date) => d.toISOString().slice(0, 10); // formato YYYY-MM-DD
const dayStrNext = (d: Date) => {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
  return next.toISOString().slice(0, 10);
};
const minusDays = (base: Date, n: number) => new Date(base.getTime() - n * 24 * 60 * 60 * 1000);

const defaultState: FiltersState = {
  from: dayStr(minusDays(today, 30)),
  to: dayStrNext(today),
  categoryId: null,
  questionId: null,
  curso: null,
  turno: null,
  unidade: null,
  identified: null,
};

type Ctx = {
  value: FiltersState;
  set: (patch: Partial<FiltersState>) => void;
  reset: () => void;
};

const DashboardFiltersCtx = createContext<Ctx | null>(null);

const sameValue = (a: FiltersState, b: FiltersState) =>
  a.from === b.from &&
  a.to === b.to &&
  a.categoryId === b.categoryId &&
  a.questionId === b.questionId &&
  a.curso === b.curso &&
  a.turno === b.turno &&
  a.unidade === b.unidade &&
  a.identified === b.identified;

export function DashboardFiltersProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState<FiltersState>(defaultState);

  const setFilters = useCallback((patch: Partial<FiltersState>) => {
    setValue((v) => {
      const next = { ...v, ...patch };
      return sameValue(next, v) ? v : next;
    });
  }, []);
  const resetFilters = useCallback(() => {
    setValue((prev) => (sameValue(prev, defaultState) ? prev : { ...defaultState }));
  }, []);
  const ctx = useMemo<Ctx>(() => ({
    value,
    set: setFilters,
    reset: resetFilters,
  }), [value, setFilters, resetFilters]);

  return (
    <DashboardFiltersCtx.Provider value={ctx}>{children}</DashboardFiltersCtx.Provider>
  );
}

export function useDashboardFilters() {
  const ctx = useContext(DashboardFiltersCtx);
  if (!ctx) throw new Error('useDashboardFilters must be used inside DashboardFiltersProvider');
  return ctx;
}
