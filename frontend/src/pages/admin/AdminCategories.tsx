// Página de categorias do painel
import { useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Pagination,
  Button,
  Group,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
  rem,
  Badge,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconEdit, IconTrash, IconX, IconListDetails  } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminTitle } from '../../components/Layout/AdminTitleContext';
import classes from '../admin/Admin.module.css';
import { Link, useNavigate } from 'react-router-dom';
import { useCurrentAdmin } from '../../hook/useCurrentAdmin';
import { AdminFiltersBar, ItemsPerPageSelect, ResponsiveFiltersShell } from '../../components/filters';



import {
  listCategories,
  createCategory,
  updateCategory,
  toggleCategory,
  deleteCategory,
} from '../../services/categories';
import type { Category } from '../../services/categories';
import { notifySuccess, notifyError } from '../../services/notifications';


export default function Categorias() {
  useAdminTitle('Categorias');
  const isMobile = useMediaQuery('(max-width: 64rem)');
  const nav = useNavigate();

  // Formulário de categoria
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; nome: string } | null>(null);

  // Filtros e paginação
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');

  const qc = useQueryClient();
  const { data: currentAdmin } = useCurrentAdmin();
  const canManage = (currentAdmin?.roles ?? []).includes('Master');

  // Busca de categorias
  const { data, isFetching } = useQuery({
    queryKey: ['categories', { search, page, pageSize, onlyActive: false }],
    queryFn: () => listCategories({ search, page, pageSize, onlyActive: false }),
    keepPreviousData: true,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Ações de criação e edição
  const handleCategoryError = (err: any) => {
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

    if (code === 'CATEGORY_DUPLICATE_NAME' || message?.toLowerCase?.().includes('já existe uma categoria')) {
      show('Já existe uma categoria com esse nome. Altere o nome e tente novamente.');
      return;
    }
    if (code === 'CATEGORY_HAS_QUESTIONS' || message?.toLowerCase?.().includes('perguntas associadas')) {
      show('Essa categoria possui perguntas associadas e não pode ser excluída. Exclua as perguntas ou inative a categoria.');
      return;
    }

    show(message);
  };

  const mCreate = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      notifySuccess('Categoria criada com sucesso.');
      if (items.length === 1 && page > 1) setPage((p) => p - 1);
      else qc.invalidateQueries({ queryKey: ['categories'] });
      setConfirmDelete(null);
      resetForm();
    },
    onError: handleCategoryError,
  });

  const mUpdate = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { nome: string; descricao?: string | null } }) =>
      updateCategory(id, payload),
    onSuccess: () => {
      notifySuccess('Categoria atualizada com sucesso.');
      qc.invalidateQueries({ queryKey: ['categories'] });
      resetForm();
    },
    onError: handleCategoryError,
  });

  const mToggle = useMutation({
    mutationFn: ({ id, ativa }: { id: string; ativa: boolean }) => toggleCategory(id, ativa),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  const mDelete = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      notifySuccess('Categoria excluída com sucesso.');
      qc.invalidateQueries({ queryKey: ['categories'] });
      setConfirmDelete(null);
    },
    onError: handleCategoryError,
  });

  // Ações auxiliares
  function resetForm() {
    setNome('');
    setDescricao('');
    setEditingId(null);
  }

  function onEdit(c: Category) {
    setEditingId(c.id);
    setNome(c.nome);
    setDescricao(c.descricao ?? '');
  }

  function onSubmit() {
    if (!canManage) return;
    const payload = { nome: nome.trim(), descricao: descricao.trim() || undefined };
    if (!payload.nome) {
      notifications.show({ color: 'red', icon: <IconX />, message: 'Informe o nome da categoria.' });
      return;
    }
    if (editingId) mUpdate.mutate({ id: editingId, payload });
    else mCreate.mutate(payload);
  }

  function clearFilters() {
    setSearch('');
    setPageSize(10);
    setPage(1);
  }

  const filtersDesktop = (
    <AdminFiltersBar
      left={
        <TextInput
          label="Buscar"
          placeholder="Nome ou descrição"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.currentTarget.value);
          }}
          w={280}
        />
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
        placeholder="Nome ou descrição"
        value={search}
        onChange={(e) => {
          setPage(1);
          setSearch(e.currentTarget.value);
        }}
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

  // Conteúdo principal da página
  return (
    <>
      <Paper p={{ base: 'md', lg: 'lg' }} radius="md" className={classes.panel}>
        {!canManage && (
          <Alert color="yellow" mb="sm">
            Você possui acesso somente leitura. Apenas Masters podem criar ou atualizar categorias.
          </Alert>
        )}

        <Stack gap={{ base: 'sm', lg: 'md' }} className={classes.formTight}>
          <Title order={4}>Nova categoria</Title>
          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing={{ base: 'sm', lg: 'md' }}>
            <TextInput
              label="Nome da categoria"
              placeholder="Ex.: Atendimento"
              value={nome}
              onChange={(e) => setNome(e.currentTarget.value)}
              disabled={!canManage}
            />
            <TextInput
              label="Descrição (opcional)"
              placeholder="Breve descrição"
              value={descricao}
              onChange={(e) => setDescricao(e.currentTarget.value)}
              disabled={!canManage}
            />
          </SimpleGrid>
          <Group
            className={classes.toolbarActions}
            justify={{ base: 'flex-start', lg: 'flex-end' }}
            gap={{ base: 'sm', lg: 'md' }}
            mt={{ base: 'sm', lg: 0 }}
          >
            <Button
              color="orange"
              onClick={onSubmit}
              loading={mCreate.isPending || mUpdate.isPending}
              disabled={!canManage}
            >
              {editingId ? 'Atualizar' : 'Salvar'}
            </Button>
            <Button variant="light" onClick={resetForm} disabled={!canManage}>
              Limpar
            </Button>
          </Group>
        </Stack>
      </Paper>

      <Paper p="lg" radius="md" className={classes.panel} mt={{ base: 'md', lg: 'lg' }}>
        <Stack gap="sm">
          <ResponsiveFiltersShell mobile={filtersMobile}>{filtersDesktop}</ResponsiveFiltersShell>
          <Text c="dimmed" fz="sm">
            {isFetching ? 'Carregando…' : `Total: ${total}`}
          </Text>

          {isMobile ? (
            <Stack gap="sm">
              {items.map((c) => {
                const questions = c.perguntasCount ?? 0;
                return (
                  <Paper withBorder p="md" radius="md" key={c.id}>
                    <Text className={classes.cardTitle}>{c.nome}</Text>
                    <Text size="sm" c="dimmed" mb="xs">
                      {c.descricao || 'Sem descrição'}
                    </Text>
                    <Group gap="sm" mb="xs">
                      <Badge color={questions > 0 ? 'teal' : 'gray'} variant="light">
                        Perguntas: {questions}
                      </Badge>
                      <Badge color={c.ativa ? 'teal' : 'gray'} variant="light">
                        {c.ativa ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </Group>
                    <Group justify="space-between" align="center">
                      <Button
                        size="xs"
                        variant="light"
                        component={Link}
                        to={`/admin/perguntas?categoriaId=${c.id}`}
                        leftSection={<IconListDetails size={14} />}
                      >
                        Perguntas
                      </Button>
                      <Group gap="xs" className={classes.cardActions}>
                        {canManage && (
                          <>
                            <ActionIcon variant="subtle" onClick={() => onEdit(c)} title="Editar">
                              <IconEdit size={16} />
                            </ActionIcon>
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              onClick={() => setConfirmDelete({ id: c.id, nome: c.nome })}
                              title="Excluir"
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </>
                        )}
                        <Switch
                          size="sm"
                          checked={c.ativa}
                          onChange={(e) => {
                            if (!canManage) return;
                            mToggle.mutate({ id: c.id, ativa: e.currentTarget.checked });
                          }}
                          disabled={!canManage}
                        />
                      </Group>
                    </Group>
                  </Paper>
                );
              })}
              {!isFetching && items.length === 0 && (
                <Text c="dimmed" ta="center">Nenhuma categoria encontrada.</Text>
              )}
            </Stack>
          ) : (
            <div className={classes.tableWrap}>
              <Table striped withColumnBorders highlightOnHover className={classes.tableMin}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Nome</Table.Th>
                    <Table.Th>Descrição</Table.Th>
                    <Table.Th style={{ width: rem(110), textAlign: 'center' }}>Perguntas</Table.Th>
                    <Table.Th style={{ width: rem(110), textAlign: 'center' }}>Ativa</Table.Th>
                    <Table.Th style={{ width: rem(140), textAlign: 'right' }}>Ações</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {items.map((c) => {
                    const qnt = c.perguntasCount ?? 0;
                    return (
                      <Table.Tr key={c.id}>
                        <Table.Td>{c.nome}</Table.Td>
                        <Table.Td>{c.descricao ?? '—'}</Table.Td>
                        <Table.Td style={{ textAlign: 'center' }}>
                          <Badge
                            component={Link}
                            to={`/admin/perguntas?categoriaId=${c.id}`}
                            variant="light"
                            color={qnt > 0 ? 'teal' : 'gray'}
                            style={{ cursor: 'pointer' }}
                            title={qnt > 0 ? 'Ver perguntas desta categoria' : 'Sem perguntas'}
                          >
                            {qnt}
                          </Badge>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'center' }}>
                          <Switch
                            checked={c.ativa}
                            onChange={(e) => {
                              if (!canManage) return;
                              mToggle.mutate({ id: c.id, ativa: e.currentTarget.checked });
                            }}
                            disabled={!canManage}
                          />
                        </Table.Td>
                        <Table.Td>
                          <Group gap={6} justify="flex-end" wrap="nowrap">
                            {canManage && (
                              <>
                                <ActionIcon variant="subtle" title="Editar" onClick={() => onEdit(c)}>
                                  <IconEdit size={18} />
                                </ActionIcon>
                                <ActionIcon
                                  color="red"
                                  variant="subtle"
                                  title="Excluir"
                                  onClick={() => setConfirmDelete({ id: c.id, nome: c.nome })}
                                >
                                  <IconTrash size={18} />
                                </ActionIcon>
                              </>
                            )}
                            <ActionIcon
                              component={Link}
                              to={`/admin/perguntas?categoriaId=${c.id}`}
                              variant="light"
                              title="Ver perguntas"
                            >
                              <IconListDetails size={18} />
                            </ActionIcon>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                  {!isFetching && items.length === 0 && (
                    <Table.Tr>
                      <Table.Td colSpan={5}>
                        <Text c="dimmed" ta="center">Nenhuma categoria encontrada.</Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </div>
          )}

          <Group justify="center" mt="md">
            <Pagination value={page} onChange={setPage} total={totalPages} disabled={isFetching} />
          </Group>
        </Stack>
      </Paper>

      {/* Modal de confirmação de exclusão */}
      <Modal
        opened={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Confirmar exclusão"
        centered
      >
        <Stack>
          <Text>
            Tem certeza que deseja excluir a categoria <b>{confirmDelete?.nome}</b>?
          </Text>
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button
              color="red"
              onClick={() => confirmDelete && mDelete.mutate(confirmDelete.id)}
              loading={mDelete.isPending}
            >
              Excluir
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
