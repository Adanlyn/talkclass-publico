import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge,
  Button,
  Collapse,
  Divider,
  Grid,
  Group,
  Loader,
  NumberInput,
  Paper,
  Pagination,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import dayjs from 'dayjs';
import {
  IconChartLine,
  IconChevronDown,
  IconChevronUp,
  IconFileTypeCsv,
  IconFileTypePdf,
  IconFileTypeXls,
  IconRefresh,
} from '@tabler/icons-react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { useQuery } from '@tanstack/react-query';
import '../../chart';
import { useAdminTitle } from '../../components/Layout/AdminTitleContext';
import classes from './Admin.module.css';
import styles from './AdminReports.module.css';
import { listCategories } from '../../services/categories';
import { listQuestions } from '../../services/questions';
import { exportReport, fetchFeedbackSummary, fetchReport, type ExportFormat } from '../../services/reports';
import { notifyError, notifySuccess } from '../../services/notifications';

type IdentFilter = 'all' | 'identified' | 'anonymous';

export default function AdminReports() {
  useAdminTitle('Relatórios');

  const chartAreaRef = useRef<HTMLDivElement>(null);
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [curso, setCurso] = useState('');
  const [identificacao, setIdentificacao] = useState<IdentFilter>('all');
  const [notaMin, setNotaMin] = useState<number | ''>('');
  const [notaMax, setNotaMax] = useState<number | ''>('');
  const [perguntaId, setPerguntaId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [exportingCharts, setExportingCharts] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [categoriaId, curso, identificacao, notaMin, notaMax, perguntaId, dateRange[0], dateRange[1]]);

  useEffect(() => {
    setPerguntaId(null);
  }, [categoriaId]);

  const qCategories = useQuery({
    queryKey: ['categories', 'reports'],
    queryFn: () => listCategories({ page: 1, pageSize: 200, onlyActive: true }),
    staleTime: 5 * 60 * 1000,
  });
  const categoryOptions = useMemo(
    () => (qCategories.data?.items ?? []).map((c) => ({ value: c.id, label: c.nome })),
    [qCategories.data]
  );

  const qQuestions = useQuery({
    queryKey: ['questions', 'reports', categoriaId],
    queryFn: () =>
      listQuestions({
        page: 1,
        pageSize: 400,
        categoriaId: categoriaId ?? undefined,
        onlyActive: true,
      }),
    staleTime: 5 * 60 * 1000,
  });
  const questionOptions = useMemo(
    () => (qQuestions.data?.items ?? []).map((q) => ({ value: q.id, label: q.enunciado })),
    [qQuestions.data]
  );

  const numericMin = typeof notaMin === 'number' ? notaMin : undefined;
  const numericMax = typeof notaMax === 'number' ? notaMax : undefined;

  const filters = useMemo(
    () => ({
      dateStart: dateRange[0],
      dateEnd: dateRange[1],
      categoriaId,
      courseName: curso,
      identified: identificacao,
      notaMin: numericMin,
      notaMax: numericMax,
      perguntaId,
      page,
      pageSize,
    }),
    [dateRange, categoriaId, curso, identificacao, numericMin, numericMax, perguntaId, page, pageSize]
  );

  const qReport = useQuery({
    queryKey: ['reports', 'feedbacks', filters],
    queryFn: () => fetchReport('feedbacks', filters),
    keepPreviousData: true,
    onError: notifyError,
  });

  const qSummary = useQuery({
    queryKey: ['reports', 'feedbacks', 'summary', filters],
    queryFn: () => fetchFeedbackSummary({ ...filters, page: undefined, pageSize: undefined }),
    onError: notifyError,
  });

  const total = qReport.data?.total ?? 0;
  const items = (qReport.data?.items ?? []) as any[];
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleClear = () => {
    setDateRange([null, null]);
    setCategoriaId(null);
    setCurso('');
    setIdentificacao('all');
    setNotaMin('');
    setNotaMax('');
    setPerguntaId(null);
    setPage(1);
  };

  const handleExport = async (format: ExportFormat) => {
    try {
      setExporting(format);
      const blob = await exportReport('feedbacks', format, { ...filters, page: undefined, pageSize: undefined });
      const ext = format === 'excel' ? 'xlsx' : format;
      const stamp = dayjs().format('YYYYMMDD-HHmm');
      const fileName = `relatorio-feedbacks-${stamp}.${ext}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      notifySuccess('Exportação pronta.');
    } catch (err) {
      notifyError(err);
    } finally {
      setExporting(null);
    }
  };

  const handleExportCharts = () => {
    if (!chartAreaRef.current) return;
    setExportingCharts(true);
    try {
      const canvases = Array.from(chartAreaRef.current.querySelectorAll('canvas')) as HTMLCanvasElement[];
      if (!canvases.length) {
        notifyError('Nenhum gráfico para exportar.');
        setExportingCharts(false);
        return;
      }

      const images = canvases.map((c) => c.toDataURL('image/png'));
      const htmlImgs = images
        .map((src, i) => `<div style="margin-bottom:12px"><div style="font:700 14px sans-serif;margin:4px 0">Gráfico ${i + 1}</div><img src="${src}" style="width:100%;max-width:800px" /></div>`)
        .join('');

      const win = window.open('', '_blank');
      if (!win) {
        notifyError('Pop-up bloqueado. Libere pop-ups para exportar.');
        setExportingCharts(false);
        return;
      }
      win.document.write(`
        <html>
          <head>
            <title>Gráficos - Feedbacks</title>
            <style>body{margin:16px;font-family:Arial,sans-serif;} img{page-break-inside:avoid;}</style>
          </head>
          <body>
            ${htmlImgs}
            <script>window.onload = () => { window.print(); }</script>
          </body>
        </html>
      `);
      win.document.close();
      notifySuccess('Gráficos prontos para impressão/PDF.');
    } catch (err) {
      notifyError(err);
    } finally {
      setTimeout(() => setExportingCharts(false), 500);
    }
  };

  const identOptions = [
    { value: 'all', label: 'Todos' },
    { value: 'identified', label: 'Somente identificados' },
    { value: 'anonymous', label: 'Somente anônimos' },
  ];

  const volumeData = useMemo(() => {
    const pts = qSummary.data?.volume ?? [];
    return {
      labels: pts.map((p) => dayjs(p.date).format('DD/MM')),
      datasets: [
        {
          label: 'Feedbacks por dia',
          data: pts.map((p) => p.total),
          tension: 0.3,
          borderColor: '#f76707',
          backgroundColor: 'rgba(247, 103, 7, 0.18)',
          fill: true,
        },
      ],
    };
  }, [qSummary.data?.volume]);

  const catData = useMemo(() => {
    const rows = (qSummary.data?.byCategory ?? []).slice(0, 8);
    return {
      labels: rows.map((r) => r.categoria),
      datasets: [
        {
          label: 'Qtd feedbacks',
          data: rows.map((r) => r.total),
          backgroundColor: '#2f8bff',
        },
      ],
    };
  }, [qSummary.data?.byCategory]);

  const identData = useMemo(() => {
    const id = qSummary.data?.identified ?? { identified: 0, anonymous: 0 };
    return {
      labels: ['Identificados', 'Anônimos'],
      datasets: [
        {
          data: [id.identified, id.anonymous],
          backgroundColor: ['#f08c00', '#ced4da'],
          borderWidth: 1,
        },
      ],
    };
  }, [qSummary.data?.identified]);

  const renderTableRows = () => {
    if (!items.length && !qReport.isFetching) {
      return (
        <Table.Tr>
          <Table.Td colSpan={7}>
            <Text c="dimmed" ta="center">
              Nenhum registro encontrado.
            </Text>
          </Table.Td>
        </Table.Tr>
      );
    }

    return items.map((r) => (
      <Table.Tr key={r.id}>
        <Table.Td>{dayjs(r.criadoEm).format('DD/MM/YYYY HH:mm')}</Table.Td>
        <Table.Td>{r.categoria ?? '—'}</Table.Td>
        <Table.Td>{r.curso ?? <Text c="dimmed">—</Text>}</Table.Td>
        <Table.Td>{r.pergunta}</Table.Td>
        <Table.Td style={{ textAlign: 'center' }}>{r.nota != null ? Number(r.nota).toFixed(2) : '—'}</Table.Td>
        <Table.Td>
          {r.resposta ? (
            <Text lineClamp={2} title={r.resposta}>
              {r.resposta}
            </Text>
          ) : (
            <Text c="dimmed">—</Text>
          )}
        </Table.Td>
        <Table.Td style={{ textAlign: 'center' }}>
          <Badge color={r.identificado ? 'orange' : 'gray'} variant="light">
            {r.identificado ? 'Identificado' : 'Anônimo'}
          </Badge>
        </Table.Td>
      </Table.Tr>
    ));
  };

  return (
    <Stack gap="md">
      <Paper p="md" radius="md" className={classes.panel}>
        <div className={styles.header}>
          <div>
            <Title order={3}>Relatórios</Title>
            <Text className={styles.subtitle}>Exporta apenas feedbacks detalhados com os filtros abaixo.</Text>
          </div>
          <Group gap="xs" className={styles.exportGroup}>
            <Button
              leftSection={<IconFileTypeCsv size={18} />}
              variant="light"
              onClick={() => handleExport('csv')}
              loading={exporting === 'csv'}
            >
              Exportar CSV
            </Button>
            <Button
              leftSection={<IconFileTypeXls size={18} />}
              variant="default"
              onClick={() => handleExport('excel')}
              loading={exporting === 'excel'}
            >
              Exportar
            </Button>
            <Button
              leftSection={<IconFileTypePdf size={18} />}
              color="orange"
              onClick={() => handleExport('pdf')}
              loading={exporting === 'pdf'}
            >
              Exportar PDF
            </Button>
          </Group>
        </div>
      </Paper>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper p="md" radius="md" className={`${classes.panel} ${styles.filtersCard}`}>
            <Stack gap="sm">
              <Divider label="Filtros" labelPosition="left" />

              <DatePickerInput
                type="range"
                label="Período"
                placeholder="Período (início – fim)"
                value={dateRange}
                onChange={(v) => setDateRange(v as [Date | null, Date | null])}
                valueFormat="DD/MM/YYYY"
                locale="pt-BR"
              />

              <Select
                label="Categoria"
                placeholder="Todas"
                data={categoryOptions}
                value={categoriaId}
                onChange={(v) => setCategoriaId(v)}
                clearable
                searchable
                nothingFoundMessage="Sem categorias"
              />

              <TextInput
                label="Curso"
                placeholder="Todos"
                value={curso}
                onChange={(e) => setCurso(e.currentTarget.value)}
              />

              <Select
                label="Identificação"
                data={identOptions}
                value={identificacao}
                onChange={(v) => setIdentificacao((v as IdentFilter) ?? 'all')}
              />

              <Button
                variant="subtle"
                size="sm"
                className={styles.advancedToggle}
                onClick={() => setShowAdvanced((prev) => !prev)}
                rightSection={showAdvanced ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
              >
                {showAdvanced ? 'Ocultar filtros avançados' : 'Mostrar mais filtros'}
              </Button>

              <Collapse in={showAdvanced}>
                <Stack gap="xs" mt="xs">
                  <Group grow>
                    <NumberInput
                      label="Nota mínima"
                      value={notaMin}
                      min={0}
                      max={10}
                      onChange={(v) => setNotaMin(typeof v === 'number' ? v : '')}
                    />
                    <NumberInput
                      label="Nota máxima"
                      value={notaMax}
                      min={0}
                      max={10}
                      onChange={(v) => setNotaMax(typeof v === 'number' ? v : '')}
                    />
                  </Group>
                  <Select
                    label="Pergunta específica"
                    placeholder="Todas"
                    data={questionOptions}
                    value={perguntaId}
                    onChange={(v) => setPerguntaId(v)}
                    searchable
                    clearable
                    nothingFoundMessage={qQuestions.isFetching ? 'Carregando...' : 'Sem perguntas'}
                  />
                </Stack>
              </Collapse>

              <Group justify="space-between" mt="md">
                <Button leftSection={<IconRefresh size={16} />} variant="light" onClick={() => qReport.refetch()}>
                  Atualizar
                </Button>
                <Button variant="outline" color="gray" size="sm" onClick={handleClear}>
                  Limpar filtros
                </Button>
              </Group>
            </Stack>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack gap="md">
            <Paper p="md" radius="md" className={classes.panel} ref={chartAreaRef}>
              <Group justify="space-between" align="center" mb="sm">
                <div>
                  <Text fw={700}>Gráficos do período filtrado</Text>
                  <Text c="dimmed" size="xs">
                    Volume, categorias e identificação, já filtrados por período/curso/identificação.
                  </Text>
                </div>
                <Button
                  leftSection={<IconFileTypePdf size={16} />}
                  variant="default"
                  onClick={handleExportCharts}
                  loading={exportingCharts}
                >
                  Exportar gráficos (PDF)
                </Button>
              </Group>

              <Grid gutter="md">
                <Grid.Col span={{ base: 12 }}>
                  <Paper p="sm" withBorder radius="md">
                    {qSummary.isFetching && (
                      <Group justify="center" py="lg">
                        <Loader size="sm" />
                      </Group>
                    )}
                    {!qSummary.isFetching && (qSummary.data?.volume?.length ?? 0) === 0 ? (
                      <Text c="dimmed" ta="center">
                        Sem dados para o período.
                      </Text>
                    ) : (
                      <Line
                        data={volumeData}
                        options={{
                          plugins: { legend: { display: false } },
                          scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
                          maintainAspectRatio: false,
                        }}
                        height={200}
                      />
                    )}
                  </Paper>
                </Grid.Col>

                <Grid.Col span={{ base: 12, md: 7 }}>
                  <Paper p="sm" withBorder radius="md" style={{ minHeight: 280 }}>
                    {!qSummary.isFetching && (qSummary.data?.byCategory?.length ?? 0) === 0 ? (
                      <Text c="dimmed" ta="center">
                        Sem categorias neste filtro.
                      </Text>
                    ) : (
                      <Bar
                        data={catData}
                        options={{
                          plugins: { legend: { display: false } },
                          indexAxis: 'y',
                          maintainAspectRatio: false,
                        }}
                        height={240}
                      />
                    )}
                  </Paper>
                </Grid.Col>

                <Grid.Col span={{ base: 12, md: 5 }}>
                  <Paper p="sm" withBorder radius="md" style={{ minHeight: 280, position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 10, right: 10 }}>
                      <Badge variant="light" color="orange" leftSection={<IconChartLine size={14} />}>
                        Média: {formatNumber(qSummary.data?.notaMedia)}
                      </Badge>
                    </div>
                    {!qSummary.isFetching &&
                    (qSummary.data?.identified?.identified ?? 0) + (qSummary.data?.identified?.anonymous ?? 0) === 0 ? (
                      <Text c="dimmed" ta="center">
                        Sem respostas
                      </Text>
                    ) : (
                      <Doughnut
                        data={identData}
                        options={{
                          plugins: { legend: { position: 'bottom' } },
                          maintainAspectRatio: false,
                        }}
                        height={240}
                      />
                    )}
                  </Paper>
                </Grid.Col>
              </Grid>
            </Paper>

            <Paper p="md" radius="md" className={classes.panel}>
              <div className={styles.previewBar}>
                <div>
                  <Text fw={700}>{total} registros encontrados</Text>
                  <Text c="dimmed" size="xs">
                    Resultado limitado aos filtros selecionados (pág. {page}/{totalPages}).
                  </Text>
                </div>
                <Group gap="xs">
                  <Button leftSection={<IconRefresh size={16} />} variant="light" onClick={() => qReport.refetch()}>
                    Atualizar
                  </Button>
                  <Button variant="subtle" color="gray" size="sm" onClick={handleClear}>
                    Limpar filtros
                  </Button>
                </Group>
              </div>

              <Divider my="sm" />

              <ScrollArea className={styles.tableWrapper}>
                <Table striped highlightOnHover withColumnBorders>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Data</Table.Th>
                      <Table.Th>Categoria</Table.Th>
                      <Table.Th>Curso</Table.Th>
                      <Table.Th>Pergunta</Table.Th>
                      <Table.Th style={{ textAlign: 'center', width: 90 }}>Nota</Table.Th>
                      <Table.Th style={{ minWidth: 220 }}>Resposta aberta</Table.Th>
                      <Table.Th style={{ textAlign: 'center', width: 130 }}>Identificado?</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {qReport.isFetching && (
                      <Table.Tr>
                        <Table.Td colSpan={7} style={{ textAlign: 'center' }}>
                          <Loader size="sm" />
                        </Table.Td>
                      </Table.Tr>
                    )}
                    {renderTableRows()}
                  </Table.Tbody>
                </Table>
              </ScrollArea>

              <Group justify="center" mt="md">
                <Pagination value={page} onChange={setPage} total={totalPages} disabled={qReport.isFetching} />
              </Group>
            </Paper>
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}

function formatNumber(v: number | null | undefined) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return Number(v).toFixed(2);
}
