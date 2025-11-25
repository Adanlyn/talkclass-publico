import { useEffect, useState } from 'react';
import {
  ActionIcon, Alert, Badge, Button, Group, Modal, Paper, Select, Stack, Switch, Table, Text,
  TextInput, Title, rem, Pagination, NumberInput
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useSearchParams } from 'react-router-dom';
import { IconEdit, IconTrash, IconX } from '@tabler/icons-react';
import { useAdminTitle } from '../../components/Layout/AdminTitleContext';
import classes from '../../pages/admin/Admin.module.css';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';

import { listCategories } from '../../services/categories';
import { listQuestions, createQuestion, updateQuestion, toggleQuestion, deleteQuestion } from '../../services/questions';
import type { Pergunta, TipoAvaliacao, PerguntaOpcao } from '../../services/questions';
import { notifyError, notifySuccess } from '../../services/notifications';
import OptionEditor from '../../components/OptionEditor';
import { useCurrentAdmin } from '../../hook/useCurrentAdmin';
import { AdminFiltersBar, CategoryFilter, ItemsPerPageSelect, ResponsiveFiltersShell } from '../../components/filters';

const TYPES: { value: TipoAvaliacao; label: string; needsOptions?: boolean }[] = [
  { value: 'Nota', label: 'Nota (1–5)' },
  { value: 'Multipla', label: 'Múltipla escolha', needsOptions: true },
  { value: 'Texto', label: 'Texto (resposta aberta)' },
];

export default function Perguntas() {
  useAdminTitle('Perguntas');
  const isMobile = useMediaQuery('(max-width: 64rem)');

  const [sp] = useSearchParams();
const categoriaFromUrl = sp.get('categoriaId');

const [fCategoria, setFCategoria] = useState<string | null>(categoriaFromUrl);
const [categoriaId, setCategoriaId] = useState<string | null>(categoriaFromUrl);
const [fTipo, setFTipo] = useState<TipoAvaliacao | null>(null);


useEffect(() => {
  setFCategoria(categoriaFromUrl);
  setCategoriaId(categoriaFromUrl);
}, [categoriaFromUrl]);

  // Filtros da listagem
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  
  // Formulário de criação/edição
  const [editId, setEditId] = useState<string | null>(null);
  const [enunciado, setEnunciado] = useState('');
  const [tipo, setTipo] = useState<TipoAvaliacao>('Texto');
  const [obrigatoria, setObrigatoria] = useState(true);
  const [ordem, setOrdem] = useState<number>(0);
  const [opcoes, setOpcoes] = useState<PerguntaOpcao[]>([]);
  const [confirm, setConfirm] = useState<{ id: string; texto: string } | null>(null);

  const qc = useQueryClient();
  const { data: currentAdmin } = useCurrentAdmin();
  const canManage = (currentAdmin?.roles ?? []).includes('Master');

  // Carrega categorias ativas
  const qCats = useQuery({
    queryKey: ['categories', { search: '', page: 1, pageSize: 1000, onlyActive: true }],
    queryFn: () => listCategories({ search: '', page: 1, pageSize: 1000, onlyActive: true }),
  });
  const catOptions = (qCats.data?.items ?? []).map((c: any) => ({ value: c.id, label: c.nome }));

  // Busca perguntas
  const q = useQuery({
    queryKey: ['questions', { search, page, pageSize, categoriaId: fCategoria ?? undefined, tipo: fTipo ?? undefined, onlyActive: false }],
    queryFn: () => listQuestions({ search, page, pageSize, categoriaId: fCategoria ?? undefined, tipo: fTipo ?? undefined, onlyActive: false }),
    keepPreviousData: true,
  });

  const items: Pergunta[] = q.data?.items ?? [];
  const total = q.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const needsOptions = TYPES.find(t => t.value === tipo)?.needsOptions === true;

  function resetForm() {
    setEditId(null); setEnunciado(''); setTipo('Texto');
    setCategoriaId(null); setObrigatoria(true); setOrdem(0); setOpcoes([]);
  }
  function fillForm(p: Pergunta) {
    setEditId(p.id); setEnunciado(p.enunciado); setTipo(p.tipo);
    setCategoriaId(p.categoriaId); setObrigatoria(p.obrigatoria); setOrdem(p.ordem);
    setOpcoes(p.opcoes ?? []);
  }

  function clearFilters() {
    setSearch('');
    setFCategoria(null);
    setFTipo(null);
    setPageSize(10);
    setPage(1);
  }

  // Ações de criação e edição
  const handleQuestionError = (err: any) => {
    const data = err?.response?.data;
    const code = data?.code || data?.errorCode || data?.ErrorCode;
    const message = typeof data === 'string' ? data : data?.message;
    const show = (text?: string) => {
      if (text) {
        notifications.show({ message: text, color: 'red' });
      } else {
        notifyError(err);
      }
    };

    if (code === 'QUESTION_DUPLICATE_TEXT' || message?.toLowerCase?.().includes('enunciado')) {
      show('Já existe uma pergunta com esse enunciado nessa categoria. Altere o enunciado e tente novamente.');
      return;
    }
    if (code === 'QUESTION_DUPLICATE_ORDER' || message?.toLowerCase?.().includes('essa ordem')) {
      show('Já existe uma pergunta com essa ordem nessa categoria. Ajuste o campo Ordem antes de salvar.');
      return;
    }
    if (code === 'QUESTION_HAS_FEEDBACKS' || message?.toLowerCase?.().includes('feedback')) {
      show('Essa pergunta já foi utilizada em feedbacks e não pode ser excluída. Você pode inativá-la.');
      return;
    }

    show(message);
  };

  const mCreate = useMutation({
    mutationFn: createQuestion,
    onSuccess: () => { notifySuccess('Pergunta criada com sucesso.'); qc.invalidateQueries({ queryKey: ['questions'] }); resetForm(); },
    onError: handleQuestionError,
  });
  const mUpdate = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => updateQuestion(id, payload),
    onSuccess: () => { notifySuccess('Pergunta atualizada com sucesso.'); qc.invalidateQueries({ queryKey: ['questions'] }); resetForm(); },
    onError: handleQuestionError,
  });
  const mToggle = useMutation({
    mutationFn: ({ id, ativa }: { id: string; ativa: boolean }) => toggleQuestion(id, ativa),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['questions'] }),
  });
  const mDelete = useMutation({
    mutationFn: (id: string) => deleteQuestion(id),
    onSuccess: () => { notifySuccess('Pergunta excluída.'); qc.invalidateQueries({ queryKey: ['questions'] }); setConfirm(null); },
    onError: handleQuestionError,
  });

  function onSubmit() {
    if (!canManage) return;
    const payload: any = {
      categoriaId: categoriaId!,
      enunciado: enunciado.trim(),
      tipo, obrigatoria, ordem,
      opcoes: needsOptions ? opcoes.filter(o => o.texto.trim() !== '') : undefined,
    };
    if (!payload.enunciado) { notifications.show({ color: 'red', icon: <IconX />, message: 'Informe o enunciado.' }); return; }
    if (!payload.categoriaId) { notifications.show({ color: 'red', icon: <IconX />, message: 'Selecione uma categoria.' }); return; }
    if (needsOptions && (!payload.opcoes || payload.opcoes.length < 2)) {
      notifications.show({ color: 'red', icon: <IconX />, message: 'Informe ao menos 2 opções.' }); return;
    }
    editId ? mUpdate.mutate({ id: editId, payload }) : mCreate.mutate(payload);
  }

  const filtersDesktop = (
    <AdminFiltersBar
      left={
        <>
          <TextInput
            label="Buscar"
            placeholder="Pergunta ou palavra-chave"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.currentTarget.value);
            }}
            w={260}
          />
          <CategoryFilter
            data={catOptions}
            value={fCategoria}
            onChange={(v) => {
              setPage(1);
              setFCategoria(v);
            }}
          />
          <Select
            label="Tipo"
            placeholder="Todos"
            data={TYPES.map((t) => ({ value: t.value, label: t.label }))}
            value={fTipo}
            onChange={(v) => {
              setPage(1);
              setFTipo((v as TipoAvaliacao) ?? null);
            }}
            clearable
            w={200}
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
          <Button variant="outline" size="sm" onClick={clearFilters}>
            Limpar filtros
          </Button>
        </>
      }
    />
  );

  const filtersMobile = ({ close }: { close: () => void }) => (
    <Stack gap="sm">
      <TextInput
        label="Buscar"
        placeholder="Pergunta ou palavra-chave"
        value={search}
        onChange={(e) => {
          setPage(1);
          setSearch(e.currentTarget.value);
        }}
      />
      <CategoryFilter
        data={catOptions}
        value={fCategoria}
        onChange={(v) => {
          setPage(1);
          setFCategoria(v);
        }}
        w="100%"
      />
      <Select
        label="Tipo"
        placeholder="Todos"
        data={TYPES.map((t) => ({ value: t.value, label: t.label }))}
        value={fTipo}
        onChange={(v) => {
          setPage(1);
          setFTipo((v as TipoAvaliacao) ?? null);
        }}
        clearable
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
        <Button variant="outline" size="sm" onClick={clearFilters}>
          Limpar filtros
        </Button>
        <Button color="orange" size="sm" onClick={close}>
          Aplicar
        </Button>
      </Group>
    </Stack>
  );

  return (
    <>
      {!canManage && (
        <Paper p="lg" radius="md" className={classes.panel}>
          <Alert color="yellow">
            Você possui acesso somente leitura. Apenas usuários Master podem criar ou editar perguntas.
          </Alert>
        </Paper>
      )}

      {canManage && (
        <Paper p="lg" radius="md" className={classes.panel}>
          <Stack gap="sm" className={classes.formTight}>
            <Title order={4}>Nova pergunta</Title>
            <div className={classes.filtersGrid}>
              <TextInput label="Enunciado" value={enunciado} onChange={(e) => setEnunciado(e.currentTarget.value)} />
              <Select label="Categoria" data={catOptions} value={categoriaId} onChange={setCategoriaId} searchable />
            </div>
            <div className={classes.filtersGrid}>
              <Select label="Tipo" data={TYPES.map(t => ({ value: t.value, label: t.label }))} value={tipo} onChange={(v) => setTipo((v as TipoAvaliacao) ?? 'Texto')} />
              <NumberInput label="Ordem" value={ordem} onChange={(v) => setOrdem(Number(v ?? 0))} />
              <Switch label="Obrigatória" checked={obrigatoria} onChange={(e) => setObrigatoria(e.currentTarget.checked)} />
            </div>
            {needsOptions && (
              <>
                <Text size="sm" c="dimmed">Opções (texto e valor):</Text>
                <OptionEditor value={opcoes} onChange={setOpcoes} />
              </>
            )}
            <Group className={classes.toolbarActions}>
              <Button color="orange" onClick={onSubmit} loading={mCreate.isPending || mUpdate.isPending}>{editId ? 'Atualizar' : 'Salvar'}</Button>
              <Button variant="light" onClick={resetForm}>Limpar</Button>
            </Group>
          </Stack>
        </Paper>
      )}

      {/* Lista de perguntas */}
      <Paper p="lg" radius="md" className={classes.panel} mt={{ base: 'md', lg: 'xl' }}>
        <Stack gap="sm">
          <ResponsiveFiltersShell mobile={filtersMobile}>{filtersDesktop}</ResponsiveFiltersShell>

          {isMobile ? (
            <div className={classes.cardGrid}>
              {items.map((p) => (
                <Paper key={p.id} withBorder radius="md" p="md">
                  <Text className={classes.cardTitle}>{p.enunciado}</Text>
                  <Text size="sm" c="dimmed" mb={6}>
                    {p.categoriaNome ?? 'Sem categoria'}
                  </Text>
                  <Group gap="xs" mb="xs">
                    <Badge variant="light">{p.tipo}</Badge>
                    <Badge variant="light" color={p.obrigatoria ? 'orange' : 'gray'}>
                      {p.obrigatoria ? 'Obrigatória' : 'Opcional'}
                    </Badge>
                    <Badge variant="light">Ordem {p.ordem}</Badge>
                  </Group>
                  <Group justify="space-between" align="center">
                    <Switch
                      size="sm"
                      checked={p.ativa}
                      onChange={(e) => {
                        if (!canManage) return;
                        mToggle.mutate({ id: p.id, ativa: e.currentTarget.checked });
                      }}
                      disabled={!canManage}
                    />
                    <Group gap="xs" className={classes.cardActions}>
                      {canManage && (
                        <>
                          <ActionIcon variant="subtle" onClick={() => fillForm(p)} title="Editar">
                            <IconEdit size={16} />
                          </ActionIcon>
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => setConfirm({ id: p.id, texto: p.enunciado })}
                            title="Excluir"
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </>
                      )}
                    </Group>
                  </Group>
                </Paper>
              ))}
              {items.length === 0 && (
                <Text c="dimmed" ta="center">Nenhuma pergunta encontrada.</Text>
              )}
            </div>
          ) : (
            <div className={classes.tableWrap}>
              <Table striped withColumnBorders highlightOnHover className={classes.tableMin}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Enunciado</Table.Th>
                    <Table.Th>Categoria</Table.Th>
                    <Table.Th>Tipo</Table.Th>
                    <Table.Th>Obrig.</Table.Th>
                    <Table.Th>Ordem</Table.Th>
                    <Table.Th style={{ width: rem(120) }}>Ativa</Table.Th>
                    <Table.Th style={{ width: rem(120) }}>Ações</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {items.map((p) => (
                    <Table.Tr key={p.id}>
                      <Table.Td>{p.enunciado}</Table.Td>
                      <Table.Td>{p.categoriaNome ?? <Text c="dimmed">—</Text>}</Table.Td>
                      <Table.Td>{p.tipo}</Table.Td>
                      <Table.Td>{p.obrigatoria ? 'Sim' : 'Não'}</Table.Td>
                      <Table.Td>{p.ordem}</Table.Td>
                      <Table.Td>
                        <Switch
                          checked={p.ativa}
                          onChange={(e) => {
                            if (!canManage) return;
                            mToggle.mutate({ id: p.id, ativa: e.currentTarget.checked });
                          }}
                          disabled={!canManage}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          {canManage && (
                            <>
                              <ActionIcon variant="light" onClick={() => fillForm(p)} title="Editar">
                                <IconEdit size={18} />
                              </ActionIcon>
                              <ActionIcon variant="light" color="red" onClick={() => setConfirm({ id: p.id, texto: p.enunciado })} title="Excluir">
                                <IconTrash size={18} />
                              </ActionIcon>
                            </>
                          )}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                  {items.length === 0 && (
                    <Table.Tr><Table.Td colSpan={7}><Text c="dimmed" ta="center">Nenhuma pergunta encontrada.</Text></Table.Td></Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </div>
          )}

          <Group justify="center" mt="md">
            <Pagination value={page} onChange={setPage} total={totalPages} disabled={q.isFetching} />
          </Group>
        </Stack>
      </Paper>

      {/* Modal de confirmação */}
      {canManage && (
        <Modal opened={!!confirm} onClose={() => setConfirm(null)} title="Confirmar exclusão" centered>
          <Stack>
            <Text>Excluir a pergunta <b>{confirm?.texto}</b>?</Text>
            <Group justify="flex-end">
              <Button variant="light" onClick={() => setConfirm(null)}>Cancelar</Button>
              <Button color="red" onClick={() => confirm && mDelete.mutate(confirm.id)} loading={mDelete.isPending}>Excluir</Button>
            </Group>
          </Stack>
        </Modal>
      )}
    </>
  );
}
