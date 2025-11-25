//frontend\src\components\DashboardFilters.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Group, SegmentedControl, Stack } from '@mantine/core';
import { useDashboardFilters } from '../state/dashboardFilters';
import { getPublicCategories } from '../services/categories';
import {
  AdminFiltersBar,
  CategoryFilter,
  OnlyIdentifiedSwitch,
  PeriodFilter,
  ResponsiveFiltersShell,
} from './filters';

const DAY_MS = 24 * 60 * 60 * 1000;

const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (date: Date, amount: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount, 0, 0, 0, 0);
const parseDate = (value?: string | null) => {
  if (!value) return null;
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt;
};
const normalizeRangeEnd = (value?: string | null) => {
  const dt = parseDate(value);
  if (!dt) return null;
  dt.setTime(dt.getTime() - DAY_MS);
  return dt;
};
const sameRange = (a: [Date | null, Date | null], b: [Date | null, Date | null]) => {
  const get = (d: Date | null) => (d instanceof Date && !Number.isNaN(d.getTime()) ? d.getTime() : null);
  return get(a?.[0] ?? null) === get(b?.[0] ?? null) && get(a?.[1] ?? null) === get(b?.[1] ?? null);
};

export default function DashboardFilters() {
  const { value, set, reset } = useDashboardFilters();
  const range = useMemo<[Date | null, Date | null]>(
    () => [parseDate(value.from), normalizeRangeEnd(value.to)],
    [value.from, value.to]
  );
  const [localRange, setLocalRange] = useState<[Date | null, Date | null]>(range);
  const [preset, setPreset] = useState<'7' | '30' | '90'>('30');
  const [usingCustomRange, setUsingCustomRange] = useState(false);
  const [cats, setCats] = useState<{ value: string; label: string }[]>([]);

  const applyRange = useCallback(
    (v: [Date | null, Date | null]) => {
      if (!v?.[0] || !v?.[1]) return;
      if (sameRange(range, v)) return;
      setUsingCustomRange(true);
      set({ from: isoDay(v[0]), to: isoDay(addDays(v[1], 1)) });
    },
    [range, set]
  );

  // aplica preset -> datas
  useEffect(() => {
    if (usingCustomRange) return;
    const days = preset === '7' ? 7 : preset === '30' ? 30 : 90;
    const now = new Date();
    const from = new Date(now.getTime() - days * DAY_MS);
    set({ from: isoDay(from), to: isoDay(addDays(now, 1)) });
  }, [preset, set, usingCustomRange]);

  // Mantém o DatePicker controlado e sincronizado com o contexto
  useEffect(() => {
    setLocalRange((prev) => (sameRange(prev, range) ? prev : range));
  }, [range]);

  useEffect(() => {
    let mounted = true;

    getPublicCategories()
      .then((list) => {
        if (!mounted) return;
        setCats(list.map((c) => ({ value: String(c.id), label: c.nome })));
      })
      .catch(() => {
        if (mounted) setCats([]);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleReset = () => {
    reset();
    setPreset('30');
    setUsingCustomRange(false);
  };

  const handleExport = () => {
    window.dispatchEvent(new CustomEvent('tc:dashboard-export'));
  };

  const desktopFilters = (
    <AdminFiltersBar
      left={
        <>
          <PeriodFilter
            value={localRange}
            onChange={(v) => {
              setLocalRange(v as [Date | null, Date | null]);
              applyRange(v as [Date | null, Date | null]);
            }}
            w={280}
          />
          <SegmentedControl
            data={[
              { label: '7d', value: '7' },
              { label: '30d', value: '30' },
              { label: '90d', value: '90' },
            ]}
            value={preset}
            onChange={(v) => {
              setUsingCustomRange(false);
              setPreset((v as '7' | '30' | '90') ?? '30');
            }}
          />
          <CategoryFilter
            data={cats}
            value={value.categoryId ?? null}
            onChange={(v) => set({ categoryId: v })}
          />
          <OnlyIdentifiedSwitch
            value={Boolean(value.identified)}
            onChange={(checked) => set({ identified: checked ? true : null })}
          />
        </>
      }
      right={
        <>
          <Button variant="outline" size="sm" onClick={handleReset}>
            Limpar filtros
          </Button>
          <Button color="orange" size="sm" onClick={handleExport}>
            Exportar
          </Button>
        </>
      }
    />
  );

  const mobileFilters = ({ close }: { close: () => void }) => (
    <Stack gap="sm">
      <PeriodFilter
        value={localRange}
        onChange={(v) => {
          setLocalRange(v as [Date | null, Date | null]);
          applyRange(v as [Date | null, Date | null]);
        }}
        w="100%"
      />
      <SegmentedControl
        data={[
          { label: '7d', value: '7' },
          { label: '30d', value: '30' },
          { label: '90d', value: '90' },
        ]}
        value={preset}
        onChange={(v) => {
          setUsingCustomRange(false);
          setPreset((v as '7' | '30' | '90') ?? '30');
        }}
        fullWidth
      />
      <CategoryFilter
        data={cats}
        value={value.categoryId ?? null}
        onChange={(v) => set({ categoryId: v })}
        w="100%"
      />
      <OnlyIdentifiedSwitch
        value={Boolean(value.identified)}
        onChange={(checked) => set({ identified: checked ? true : null })}
      />
      <Group justify="space-between" mt="md" gap="sm">
        <Button variant="outline" size="sm" onClick={handleReset}>
          Limpar filtros
        </Button>
        <Button color="orange" size="sm" onClick={close}>
          Aplicar
        </Button>
      </Group>
      <Button color="orange" onClick={() => { handleExport(); close(); }} fullWidth>
        Exportar
      </Button>
    </Stack>
  );

  return (
    <ResponsiveFiltersShell mobile={mobileFilters}>{desktopFilters}</ResponsiveFiltersShell>
  );
}
