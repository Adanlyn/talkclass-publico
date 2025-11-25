import { DatePickerInput } from '@mantine/dates';
import { Button, Modal, Select, Stack, Switch, useMantineTheme } from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { IconFilter } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import classes from '../pages/admin/Admin.module.css';

const cx = (...names: Array<string | undefined | null | false>) =>
  names.filter(Boolean).join(' ');

type PeriodFilterProps = {
  value: [Date | null, Date | null];
  onChange: (v: [Date | null, Date | null]) => void;
  label?: string;
  w?: number | string;
};

export function PeriodFilter({ value, onChange, label = 'Período', w = 260 }: PeriodFilterProps) {
  return (
    <DatePickerInput
      type="range"
      label={label}
      placeholder="Período (início – fim)"
      value={value}
      onChange={(v) => onChange(v as [Date | null, Date | null])}
      valueFormat="DD/MM/YYYY"
      locale="pt-BR"
      popoverProps={{ withinPortal: true }}
      w={w}
    />
  );
}

type CategoryFilterProps = {
  value: string | null;
  onChange: (v: string | null) => void;
  data: { value: string; label: string }[];
  w?: number | string;
};

export function CategoryFilter({ value, onChange, data, w = 240 }: CategoryFilterProps) {
  return (
    <Select
      label="Filtrar por categoria"
      placeholder="Filtrar por categoria"
      data={data}
      value={value}
      onChange={(v) => onChange(v)}
      searchable
      clearable
      nothingFoundMessage="Nenhuma categoria"
      w={w}
    />
  );
}

type CourseOption = { value: string; label: string };

type CourseFilterProps = {
  value: string | null;
  onChange: (v: string | null) => void;
  data?: CourseOption[];
  allowCustom?: boolean;
  w?: number | string;
};

export function CourseFilter({
  value,
  onChange,
  data = [],
  allowCustom = true,
  w = 220,
}: CourseFilterProps) {
  const [options, setOptions] = useState<CourseOption[]>(data);

  useEffect(() => {
    setOptions((prev) => {
      const merged = new Map<string, CourseOption>();
      [...data, ...prev].forEach((opt) => merged.set(opt.value, opt));
      if (value && !merged.has(value)) {
        merged.set(value, { value, label: value });
      }
      return Array.from(merged.values());
    });
  }, [data, value]);

  const creatableProps = useMemo(() => {
    if (!allowCustom) return {};
    return {
      creatable: true as const,
      getCreateLabel: (query: string) => `Usar "${query}"`,
      onCreate: (query: string) => {
        const item = { value: query, label: query } satisfies CourseOption;
        setOptions((prev) => [...prev, item]);
        return item;
      },
    };
  }, [allowCustom]);

  return (
    <Select
      label="Filtrar por curso"
      placeholder="Filtrar por curso"
      data={options}
      searchable
      clearable
      value={value ?? null}
      onChange={(v) => onChange(v ?? null)}
      nothingFoundMessage="Digite para buscar"
      w={w}
      {...creatableProps}
    />
  );
}

type ItemsPerPageSelectProps = {
  value: number;
  onChange: (v: number) => void;
  w?: number | string;
};

export function ItemsPerPageSelect({ value, onChange, w = 120 }: ItemsPerPageSelectProps) {
  return (
    <Select
      label="Itens/pág."
      data={['5', '10', '20', '50', '100']}
      value={String(value)}
      onChange={(v) => onChange(Number(v ?? value))}
      allowDeselect={false}
      w={w}
    />
  );
}

type OnlyIdentifiedSwitchProps = {
  value: boolean;
  onChange: (v: boolean) => void;
};

export function OnlyIdentifiedSwitch({ value, onChange }: OnlyIdentifiedSwitchProps) {
  return (
    <Switch
      label="Somente identificados"
      checked={value}
      onChange={(e) => onChange(e.currentTarget.checked)}
    />
  );
}

type AdminFiltersBarProps = {
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
};

export function AdminFiltersBar({ left, right, className }: AdminFiltersBarProps) {
  return (
    <div className={cx(classes.filtersBar, className)}>
      <div className={classes.filtersLeft}>{left}</div>
      <div className={classes.filtersRight}>{right}</div>
    </div>
  );
}

type ResponsiveFiltersShellProps = {
  children: ReactNode;
  mobile?: (ctx: { close: () => void }) => ReactNode;
  buttonLabel?: string;
  drawerTitle?: string;
};

export function ResponsiveFiltersShell({
  children,
  mobile,
  buttonLabel = 'Filtros',
  drawerTitle = 'Filtros',
}: ResponsiveFiltersShellProps) {
  const theme = useMantineTheme();
  const isDesktop = useMediaQuery(`(min-width: ${theme.breakpoints.lg})`);
  const [opened, { open, close }] = useDisclosure(false);

  if (isDesktop) {
    return <>{children}</>;
  }

  return (
    <>
      <div className={classes.filtersMobileTrigger}>
        <Button
          variant="outline"
          leftSection={<IconFilter size={16} />}
          onClick={open}
          size="sm"
          fullWidth
        >
          {buttonLabel}
        </Button>
      </div>

      <Modal
        opened={opened}
        onClose={close}
        title={drawerTitle}
        radius="lg"
        centered
        size="auto"
        overlayProps={{ opacity: 0.4, blur: 2 }}
        withinPortal
      >
        <Stack gap="sm" className={classes.filtersDrawerContent}>
          {(typeof mobile === 'function' ? mobile({ close }) : children) ?? null}
        </Stack>
      </Modal>
    </>
  );
}
