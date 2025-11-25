import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge, Button, Divider, Drawer, Group, Paper, Pagination, Select, Stack, Table, Text, Title, rem
} from '@mantine/core';
import dayjs from 'dayjs';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useAdminTitle } from '../../components/Layout/AdminTitleContext';
import classes from './Admin.module.css';
import { listCategories } from '../../services/categories';
import { listFeedbacks, getFeedbackDetail } from '../../services/feedback.service';
import { exportReport } from '../../services/reports';
import { notifyError, notifySuccess } from '../../services/notifications';
import { IconArrowsSort, IconArrowUp, IconArrowDown } from '@tabler/icons-react';
import { useMediaQuery } from '@mantine/hooks';
import { AdminFiltersBar, CategoryFilter, CourseFilter, ItemsPerPageSelect, PeriodFilter, ResponsiveFiltersShell } from '../../components/filters';

const sameRange = (a: [Date | null, Date | null], b: [Date | null, Date | null]) => {
  const get = (d: Date | null) => (d instanceof Date && !Number.isNaN(d.getTime()) ? d.getTime() : null);
  return get(a?.[0] ?? null) === get(b?.[0] ?? null) && get(a?.[1] ?? null) === get(b?.[1] ?? null);
};

function IdentBadge({ v }: { v: boolean }) {
  return <Badge variant="light" color={v ? 'orange' : 'gray'}>{v ? 'Identificado' : 'Anônimo'}</Badge>;
}

export default function AdminFeedbacks() {
  useAdminTitle('Feedbacks');
  const isMobile = useMediaQuery('(max-width: 64rem)');
  const [searchParams, setSearchParams] = useSearchParams();
  const feedbackIdFromUrl = searchParams.get('feedbackId');
  const lastFeedbackIdRef = useRef<string | null>(null);

  // Filtros principais
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<[Date | null, Date | null]>([null, null]); // intervalo início/fim

  const toYMD = (d: unknown) => {
    if (!d) return undefined;
    const m = dayjs(d);
    return m.isValid() ? m.format('YYYY-MM-DD') : undefined;
  };


  const [sort, setSort] = useState<'desc' | 'asc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [curso, setCurso] = useState<string | null>(null);
  const [identificado, setIdentificado] = useState<'all' | 'true' | 'false'>('all');

  const [opened, setOpened] = useState(false);
  const [detail, setDetail] = useState<any>(null); // modelo simples
  async function openDetail(id: string, fromUrl = false) {
   try {
      const d = await getFeedbackDetail(id);
      setDetail(d);
      setOpened(true);
      if (fromUrl) return;
      const current = searchParams.get('feedbackId');
      if (current !== id) {
        setSearchParams({ feedbackId: id }, { replace: true });
      }
    } catch (e) {
      console.error('Falha ao carregar detalhe do feedback', e);
    }
  }

  // Abre o detalhe quando a URL traz um feedbackId
  useEffect(() => {
    if (feedbackIdFromUrl && lastFeedbackIdRef.current !== feedbackIdFromUrl) {
      lastFeedbackIdRef.current = feedbackIdFromUrl;
      openDetail(feedbackIdFromUrl, true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedbackIdFromUrl]);

  // Carrega categorias para o filtro
  const qCats = useQuery({
    queryKey: ['categories', { search: '', page: 1, pageSize: 1000, onlyActive: true }],
    queryFn: () => listCategories({ search: '', page: 1, pageSize: 1000, onlyActive: true }),
  });
  const catOptions = (qCats.data?.items ?? []).map((c: any) => ({ value: c.id, label: c.nome }));

  // Busca feedbacks
  const q = useQuery({
    queryKey: ['feedbacks', {
      page, pageSize,
      categoriaId: categoriaId ?? undefined,
      sort,
      dateStart: periodo?.[0] ? toYMD(periodo[0]) : undefined,
      dateEnd: periodo?.[1] ? toYMD(periodo[1]) : undefined,
      courseName: curso ?? undefined,
      identified: identificado === 'all' ? undefined : identificado === 'true',
    }],
    queryFn: () => listFeedbacks({
      page, pageSize,
      categoriaId: categoriaId ?? undefined,
      sort,
      dateStart: periodo?.[0] ? toYMD(periodo[0]) : undefined,
      dateEnd: periodo?.[1] ? toYMD(periodo[1]) : undefined,
      courseName: curso ?? undefined,
      identified: identificado === 'all' ? undefined : identificado === 'true',
    }),
    keepPreviousData: true,
  });

  const items = (q.data?.items ?? []) as any[];
  const total = q.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const courseOptions = useMemo(() => {
    const labels = Array.from(
      new Set(
        items
          .map((f) => (typeof f.cursoOuTurma === 'string' ? f.cursoOuTurma.trim() : ''))
          .filter((name) => name.length > 0)
      )
    ).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return labels.map((label) => ({ value: label, label }));
  }, [items]);

  function toggleSort() {
    setPage(1);
    setSort((s) => (s === 'desc' ? 'asc' : 'desc'));
  }
  const respostasComNota = (detail?.respostas ?? []).some((r: any) => r.nota != null);

  async function handleExportExcel() {
    try {
      const blob = await exportReport('feedbacks', 'excel', {
        page: undefined,
        pageSize: undefined,
        categoriaId: categoriaId ?? undefined,
        dateStart: periodo?.[0] ? toYMD(periodo[0]) : undefined,
        dateEnd: periodo?.[1] ? toYMD(periodo[1]) : undefined,
        courseName: curso ?? undefined,
        identified: identificado === 'all' ? undefined : identificado === 'true' ? 'identified' : 'anonymous',
        notaMin: undefined,
        notaMax: undefined,
        perguntaId: undefined,
      });
      const stamp = dayjs().format('YYYYMMDD-HHmm');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `feedbacks-${stamp}.xls`;
      a.click();
      URL.revokeObjectURL(a.href);
      notifySuccess('Exportação em Excel gerada.');
    } catch (err) {
      notifyError(err);
    }
  }

  const handleClearFilters = () => {
    setPeriodo([null, null]);
    setCategoriaId(null);
    setCurso(null);
    setIdentificado('all');
    setSort('desc');
    setPageSize(10);
    setPage(1);
  };

  return (
    <Paper p="lg" radius="md" className={classes.panel}>
      <Group justify="space-between" mb="sm">
        <Title order={4}>Feedbacks</Title>
        <Text c="dimmed" fz="sm">
          {q.isFetching ? 'Carregando…' : `Total: ${total}`}
        </Text>
      </Group>

      <ResponsiveFiltersShell
        mobile={({ close }) => (
          <Stack gap="sm">
            <PeriodFilter
              value={periodo}
              onChange={(v) => {
                setPeriodo((prev) => {
                  if (sameRange(prev, v as [Date | null, Date | null])) return prev;
                  setPage(1);
                  return v as [Date | null, Date | null];
                });
              }}
              w="100%"
            />
            <CategoryFilter
              data={catOptions}
              value={categoriaId}
              onChange={(v) => {
                setPage(1);
                setCategoriaId(v);
              }}
              w="100%"
            />
            <CourseFilter
              data={courseOptions}
              value={curso}
              onChange={(v) => {
                setPage(1);
                setCurso(v);
              }}
              w="100%"
            />
            <Select
              label="Identificação"
              data={[
                { value: 'all', label: 'Todos' },
                { value: 'true', label: 'Identificado' },
                { value: 'false', label: 'Anônimo' },
              ]}
              value={identificado}
              onChange={(v) => {
                setPage(1);
                setIdentificado((v as 'all' | 'true' | 'false') ?? 'all');
              }}
              w="100%"
            />
            <ItemsPerPageSelect
              value={pageSize}
              onChange={(n) => {
                setPage(1);
                setPageSize(n);
              }}
              w="100%"
            />
            <Group justify="space-between" mt="md" gap="sm">
              <Button variant="outline" size="sm" onClick={handleClearFilters}>
                Limpar filtros
              </Button>
              <Button color="orange" size="sm" onClick={() => { close(); }}>
                Aplicar
              </Button>
            </Group>
            <Button color="orange" variant="filled" onClick={handleExportExcel} fullWidth>
              Exportar
            </Button>
          </Stack>
        )}
      >
        <AdminFiltersBar
          left={
            <>
              <PeriodFilter
                value={periodo}
                onChange={(v) => {
                  setPeriodo((prev) => {
                    if (sameRange(prev, v as [Date | null, Date | null])) return prev;
                    setPage(1);
                    return v as [Date | null, Date | null];
                  });
                }}
              />
              <CategoryFilter
                data={catOptions}
                value={categoriaId}
                onChange={(v) => {
                  setPage(1);
                  setCategoriaId(v);
                }}
              />
              <CourseFilter
                data={courseOptions}
                value={curso}
                onChange={(v) => {
                  setPage(1);
                  setCurso(v);
                }}
              />
              <Select
                label="Identificação"
                data={[
                  { value: 'all', label: 'Todos' },
                  { value: 'true', label: 'Identificado' },
                  { value: 'false', label: 'Anônimo' },
                ]}
                value={identificado}
                onChange={(v) => {
                  setPage(1);
                  setIdentificado((v as 'all' | 'true' | 'false') ?? 'all');
                }}
                w={160}
              />
            </>
          }
          right={
            <>
              <ItemsPerPageSelect
                value={pageSize}
                onChange={(n) => {
                  setPage(1);
                  setPageSize(n);
                }}
              />
              <Button variant="outline" size="sm" onClick={handleClearFilters}>
                Limpar filtros
              </Button>
              <Button color="orange" size="sm" onClick={handleExportExcel}>
                Exportar
              </Button>
            </>
          }
        />
      </ResponsiveFiltersShell>

      {/* Tabela de feedbacks */}
      {isMobile ? (
        <div className={classes.cardGrid}>
          {items.map((f) => (
            <Paper key={f.id} withBorder radius="md" p="md">
              <Group justify="space-between" mb={6}>
                <div>
                  <Text className={classes.cardTitle}>{f.categoriaNome}</Text>
                  <Text size="sm" c="dimmed">
                    {dayjs(f.criadoEm).format('DD/MM/YYYY, HH:mm')}
                  </Text>
                </div>
                <IdentBadge v={f.identificado} />
              </Group>
              <Text size="sm" mb={4}>{f.cursoOuTurma || '—'}</Text>
              <Group gap="xs" mb="xs">
                <Badge variant="light">Resp: {f.qtdRespostas}</Badge>
                <Badge variant="light" color="orange">
                  Nota: {Number.isFinite(f.notaMedia as any) ? f.notaMedia?.toFixed(2) : '—'}
                </Badge>
              </Group>
              <Group justify="flex-end">
                <Button size="xs" variant="light" onClick={() => openDetail(f.id)}>
                  Ver mais
                </Button>
              </Group>
            </Paper>
          ))}
          {!q.isFetching && items.length === 0 && (
            <Text c="dimmed" ta="center">Nenhum feedback encontrado.</Text>
          )}
        </div>
      ) : (
        <div className={classes.tableWrap}>
          <Table striped withColumnBorders highlightOnHover className={classes.tableMin}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th onClick={toggleSort} style={{ cursor: 'pointer' }}>
                  <Group gap={6}>
                    <span>Data/Hora</span>
                    {sort === 'desc' ? <IconArrowDown size={16} /> : <IconArrowUp size={16} />}
                  </Group>
                </Table.Th>
                <Table.Th>Categoria</Table.Th>
                <Table.Th>Curso</Table.Th>
                <Table.Th style={{ width: rem(120), textAlign: 'center' }}>Ident.</Table.Th>
                <Table.Th style={{ width: rem(100), textAlign: 'center' }}>Resp.</Table.Th>
                <Table.Th style={{ width: rem(120), textAlign: 'center' }}>Nota média</Table.Th>
                <Table.Th style={{ width: rem(90) }}></Table.Th>
              </Table.Tr>
            </Table.Thead>

            <Table.Tbody>
              {items.map((f) => (
                <Table.Tr key={f.id}>
                  <Table.Td>{dayjs(f.criadoEm).format('DD/MM/YYYY, HH:mm:ss')}</Table.Td>
                  <Table.Td>{f.categoriaNome}</Table.Td>
                  <Table.Td>{f.cursoOuTurma ?? <Text c="dimmed">—</Text>}</Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}><IdentBadge v={f.identificado} /></Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    <Badge variant="light">{f.qtdRespostas}</Badge>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    {Number.isFinite(f.notaMedia as any) ? f.notaMedia?.toFixed(2) : <Text c="dimmed">—</Text>}
                  </Table.Td>
                  <Table.Td>
                    <Button size="xs" variant="subtle" onClick={() => openDetail(f.id)}>Ver mais</Button>
                  </Table.Td>
                </Table.Tr>
              ))}

              {!q.isFetching && items.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={7}><Text c="dimmed" ta="center">Nenhum feedback encontrado.</Text></Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </div>
      )}

      <Group justify="center" mt="md">
        <Pagination value={page} onChange={setPage} total={totalPages} disabled={q.isFetching} />
      </Group>

      <Drawer opened={opened} onClose={() => setOpened(false)} title="Feedback completo" position="right" size="lg">
        {!detail ? (
          <Text c="dimmed">Carregando…</Text>
        ) : (
          <>
            <Group justify="space-between" mb="xs">
              <Text fw={600}>{dayjs(detail.criadoEm).format('DD/MM/YYYY, HH:mm:ss')}</Text>
              <IdentBadge v={detail.identificado} />
            </Group>
            <Text size="sm">Categoria: <b>{detail.categoria}</b></Text>
            <Text size="sm" mb="sm">Curso: <b>{detail.curso ?? '—'}</b></Text>
            {detail.identificado && (detail.nome || detail.contato) && (
              <Paper p="sm" withBorder mb="sm">
                {detail.nome && <Text size="sm">Nome: <b>{detail.nome}</b></Text>}
                {detail.contato && <Text size="sm">Contato: <b>{detail.contato}</b></Text>}
              </Paper>
            )}
            <Divider label="Perguntas & Respostas" mb="sm" />
            {((detail.respostas ?? []).filter((r: any) =>
              r.nota != null ||
              (typeof r.texto === 'string' && r.texto.trim() !== '') ||
              (typeof r.opcao === 'string' && r.opcao.trim() !== '')
            )).map((r: any, i: number) => (
              <Paper key={i} p="sm" withBorder mb="sm">
                <Text fw={600}>{r.pergunta}</Text>

                {/* Quando for texto, mostra apenas o conteúdo */}
                {typeof r.texto === 'string' && r.texto.trim() !== '' ? (
     <Text mt={4}>{r.texto}</Text>
                ) : (
                  (r.nota != null || (r.opcao && r.opcao.trim() !== '')) && (
                    <Text size="sm" mt={2}>
                      {r.nota != null ? `Nota: ${r.nota}` : ''}
                      {r.nota != null && r.opcao ? ' | ' : ''}
                      {r.opcao ? `Opção: ${r.opcao}` : ''}
                    </Text>
                  )
                )}
              </Paper>
            ))}
            <Divider mb="sm" />
           {respostasComNota && (
   <Group gap="xs">
     <Text>Nota média:</Text>
     <Badge>{Number.isFinite(detail.notaMedia as any) ? Number(detail.notaMedia).toFixed(2) : '—'}</Badge>
   </Group>
 )}
          </>
        )}
      </Drawer>

    </Paper>
  );

}
