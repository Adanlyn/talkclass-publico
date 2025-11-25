import { useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  Pagination,
  PasswordInput,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconAlertCircle, IconEdit, IconTrash } from '@tabler/icons-react';
import { useForm } from '@mantine/form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import classes from './Admin.module.css';
import { useAdminTitle } from '../../components/Layout/AdminTitleContext';
import { notifyError, notifySuccess } from '../../services/notifications';
import { formatCpf, stripCpf, isValidCpf } from '../../utils/cpf';
import { useCurrentAdmin } from '../../hook/useCurrentAdmin';
import { useNavigate } from 'react-router-dom';
import {
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
  updateAdminUser,
  updateAdminUserStatus,
} from '../../services/adminUsers';
import type { AdminRole, AdminUser } from '../../types/admin';
import { AdminFiltersBar, ItemsPerPageSelect, ResponsiveFiltersShell } from '../../components/filters';

type StatusFilter = 'all' | 'active' | 'inactive';
type RoleFilter = 'all' | AdminRole;

const roleOptions = [
  { value: 'Master', label: 'Master' },
  { value: 'Admin', label: 'Admin' },
];

export default function AdminUsers() {
  useAdminTitle('Usuarios');
  const isMobile = useMediaQuery('(max-width: 64rem)');
  const { data: currentAdmin, isLoading: isLoadingCurrentAdmin } = useCurrentAdmin();
  const navigate = useNavigate();
  const canManage = (currentAdmin?.roles ?? []).includes('Master');
  const showReadOnlyAlert = !isLoadingCurrentAdmin && !canManage;

  useEffect(() => {
    if (!isLoadingCurrentAdmin && !canManage) {
      navigate('/admin', { replace: true });
    }
  }, [canManage, isLoadingCurrentAdmin, navigate]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  const form = useForm({
    initialValues: {
      id: '',
      nome: '',
      email: '',
      cpf: '',
      role: 'Admin' as AdminRole,
      senha: '',
      novaSenha: '',
      isActive: true,
    },
    validate: {
      nome: (value) => (value.trim().length < 3 ? 'Informe o nome completo' : null),
      cpf: (value) => (isValidCpf(value) ? null : 'CPF invalido'),
      email: (value) => {
        if (!value) return null;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? null : 'E-mail invalido';
      },
      senha: (value, values) => {
        if (values.id) return null;
        return value.trim().length >= 6 ? null : 'A senha precisa de pelo menos 6 caracteres';
      },
      novaSenha: (value, values) => {
        if (!values.id) return null;
        if (!value.trim()) return null;
        return value.trim().length >= 6 ? null : 'A nova senha precisa de pelo menos 6 caracteres';
      },
    },
  });

  const filters = useMemo(() => {
    const active =
      statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : null;
    const role = roleFilter === 'all' ? null : roleFilter;
    return { search: search.trim() || undefined, page, pageSize, role, active };
  }, [search, page, pageSize, roleFilter, statusFilter]);

  const { data, isFetching } = useQuery({
    queryKey: ['admin-users', filters],
    queryFn: () => listAdminUsers(filters),
    keepPreviousData: true,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const qc = useQueryClient();

  const handleSuccessRefresh = (message: string) => {
    notifySuccess(message);
    qc.invalidateQueries({ queryKey: ['admin-users'] });
    setDeleteTarget(null);
  };

  const createMutation = useMutation({
    mutationFn: createAdminUser,
    onSuccess: () => {
      handleSuccessRefresh('Usuario criado com sucesso.');
      form.reset();
    },
    onError: notifyError,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateAdminUser>[1] }) =>
      updateAdminUser(id, payload),
    onSuccess: () => {
      handleSuccessRefresh('Usuario atualizado com sucesso.');
      form.reset();
    },
    onError: notifyError,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateAdminUserStatus(id, isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
    onError: notifyError,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAdminUser,
    onSuccess: () => handleSuccessRefresh('Usuario removido com sucesso.'),
    onError: notifyError,
  });

  const isEditing = Boolean(form.values.id);

  const handleSubmit = form.onSubmit((values) => {
    if (!canManage) return;
    const base = {
      nome: values.nome.trim(),
      email: values.email.trim() || undefined,
      role: values.role,
      isActive: values.isActive,
    };

    if (isEditing) {
      updateMutation.mutate({
        id: values.id,
        payload: {
          ...base,
          cpf: stripCpf(values.cpf),
          novaSenha: values.novaSenha.trim() || undefined,
        },
      });
    } else {
      createMutation.mutate({
        ...base,
        cpf: stripCpf(values.cpf),
        senha: values.senha.trim(),
      });
    }
  });

  const handleEdit = (user: AdminUser) => {
    form.setValues({
      id: user.id,
      nome: user.nome,
      email: user.email ?? '',
      cpf: formatCpf(user.cpf),
      role: user.role,
      senha: '',
      novaSenha: '',
      isActive: user.isActive,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => form.reset();

  const formDisabled = isLoadingCurrentAdmin || !canManage || createMutation.isPending || updateMutation.isPending;

  const roleFilterData = [
    { value: 'all', label: 'Todos' },
    ...roleOptions,
  ];

  const statusFilterData = [
    { value: 'all', label: 'Todos' },
    { value: 'active', label: 'Ativos' },
    { value: 'inactive', label: 'Inativos' },
  ];

  const clearListFilters = () => {
    setSearch('');
    setRoleFilter('all');
    setStatusFilter('all');
    setPageSize(10);
    setPage(1);
  };

  const filtersDesktop = (
    <AdminFiltersBar
      left={
        <>
          <TextInput
            label="Buscar"
            placeholder="Nome, e-mail ou CPF"
            value={search}
            onChange={(event) => {
              setSearch(event.currentTarget.value);
              setPage(1);
            }}
          />
          <Select
            label="Perfil"
            data={roleFilterData}
            value={roleFilter}
            onChange={(value) => {
              setRoleFilter((value as RoleFilter) ?? 'all');
              setPage(1);
            }}
          />
          <Select
            label="Status"
            data={statusFilterData}
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter((value as StatusFilter) ?? 'all');
              setPage(1);
            }}
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
          <Button variant="outline" size="sm" onClick={clearListFilters}>
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
        placeholder="Nome, e-mail ou CPF"
        value={search}
        onChange={(event) => {
          setSearch(event.currentTarget.value);
          setPage(1);
        }}
      />
      <Select
        label="Perfil"
        data={roleFilterData}
        value={roleFilter}
        onChange={(value) => {
          setRoleFilter((value as RoleFilter) ?? 'all');
          setPage(1);
        }}
      />
      <Select
        label="Status"
        data={statusFilterData}
        value={statusFilter}
        onChange={(value) => {
          setStatusFilter((value as StatusFilter) ?? 'all');
          setPage(1);
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
        <Button variant="outline" size="sm" onClick={clearListFilters}>
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
      <Stack gap={{ base: 'md', lg: 'xl' }}>
        <Paper p="xl" radius="md" className={classes.panel}>
          <Group justify="space-between" mb="md">
            <div>
              <Title order={4}>Gerenciar usuarios</Title>
              <Text c="dimmed" fz="sm">
                Cadastre novos administradores ou atualize os existentes.
              </Text>
            </div>
          </Group>

          {showReadOnlyAlert && (
            <Alert color="yellow" icon={<IconAlertCircle size={18} />} mb="lg">
              Seu perfil atual permite apenas visualizar usuarios. Contate um Master para solicitar alteracoes.
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
          <Stack gap="xs" className={classes.formTight}>
              <TextInput
                label="Nome completo"
                placeholder="Ex.: Maria Costa"
                {...form.getInputProps('nome')}
                disabled={formDisabled}
              />

              <div className={classes.filtersGrid} style={{ alignItems: 'end' }}>
                <TextInput
                  label="CPF"
                  placeholder="000.000.000-00"
                  value={form.values.cpf}
                  onChange={(event) => form.setFieldValue('cpf', formatCpf(event.currentTarget.value))}
                  error={form.errors.cpf}
                  disabled={formDisabled}
                />
                <TextInput
                  label="E-mail"
                  placeholder="email@dominio.com"
                  {...form.getInputProps('email')}
                  disabled={formDisabled}
                />
              </div>

              <div className={classes.filtersGrid}>
                <Select
                  label="Perfil"
                  data={roleOptions}
                  {...form.getInputProps('role')}
                  disabled={formDisabled}
                />
                <Switch
                  label="Ativo"
                  checked={form.values.isActive}
                  onChange={(event) => form.setFieldValue('isActive', event.currentTarget.checked)}
                  disabled={formDisabled}
                />
              </div>

              {!isEditing && (
                <PasswordInput
                  label="Senha inicial"
                  placeholder="Minimo de 6 caracteres"
                  {...form.getInputProps('senha')}
                  disabled={formDisabled}
                />
              )}

              {isEditing && (
                <PasswordInput
                  label="Nova senha (opcional)"
                  placeholder="Defina apenas se desejar alterar"
                  {...form.getInputProps('novaSenha')}
                  disabled={formDisabled}
                />
              )}

              <Group justify="flex-end" mt="sm" className={classes.toolbarActions}>
                <Button variant="light" onClick={resetForm} disabled={formDisabled}>
                  Limpar
                </Button>
                <Button type="submit" color="orange" disabled={formDisabled}>
                  {isEditing ? 'Atualizar' : 'Salvar'}
                </Button>
              </Group>
            </Stack>
          </form>
        </Paper>

        <Paper p="xl" radius="md" className={classes.panel}>
          <Stack gap="xs" mb="sm">
            <div>
              <Title order={5}>Usuarios cadastrados</Title>
              <Text c="dimmed" fz="sm">
                {total} registro(s) encontrados
              </Text>
            </div>
            <ResponsiveFiltersShell mobile={filtersMobile}>{filtersDesktop}</ResponsiveFiltersShell>
          </Stack>

          {isMobile ? (
            <div className={classes.cardGrid} style={{ gap: 10 }}>
              {items.map((user) => (
                <Paper key={user.id} withBorder radius="md" p="md">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text className={classes.cardTitle}>{user.nome}</Text>
                      <Text size="sm" c="dimmed">{user.email || 'Sem e-mail'}</Text>
                      <Text size="sm" c="dimmed">CPF: {formatCpf(user.cpf)}</Text>
                      <Badge mt={6} color={user.role === 'Master' ? 'orange' : '#6c543eff'}>
                        {user.role}
                      </Badge>
                    </div>
                    <Switch
                      size="sm"
                      checked={user.isActive}
                      onChange={(event) =>
                        statusMutation.mutate({ id: user.id, isActive: event.currentTarget.checked })
                      }
                      disabled={isLoadingCurrentAdmin || !canManage}
                    />
                  </Group>
                  <Group gap="xs" justify="flex-end" mt="sm" className={classes.cardActions}>
                    <ActionIcon
                      variant="subtle"
                      aria-label="Editar"
                      onClick={() => handleEdit(user)}
                      disabled={isLoadingCurrentAdmin || !canManage}
                    >
                      <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label="Excluir"
                      onClick={() => setDeleteTarget(user)}
                      disabled={isLoadingCurrentAdmin || !canManage}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Paper>
              ))}
              {!isFetching && items.length === 0 && (
                <Text c="dimmed" ta="center">
                  Nenhum usuario encontrado.
                </Text>
              )}
            </div>
          ) : (
            <div className={classes.tableWrap}>
              <Table striped highlightOnHover className={classes.tableMin}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Nome</Table.Th>
                    <Table.Th>CPF</Table.Th>
                    <Table.Th>E-mail</Table.Th>
                    <Table.Th>Perfil</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th style={{ width: '120px' }}></Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {items.map((user) => (
                    <Table.Tr key={user.id}>
                      <Table.Td>{user.nome}</Table.Td>
                      <Table.Td>{formatCpf(user.cpf)}</Table.Td>
                      <Table.Td>{user.email ?? '—'}</Table.Td>
                      <Table.Td>
                        <Badge color={user.role === 'Master' ? 'orange' : '#6c543eff'}>{user.role}</Badge>
                      </Table.Td>
                      <Table.Td>
                        {canManage ? (
                          <Switch
                            size="sm"
                            checked={user.isActive}
                            onChange={(event) =>
                              statusMutation.mutate({ id: user.id, isActive: event.currentTarget.checked })
                            }
                            disabled={isLoadingCurrentAdmin}
                          />
                        ) : (
                          <Badge color={user.isActive ? 'teal' : 'gray'}>{user.isActive ? 'Ativo' : 'Inativo'}</Badge>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Group gap={8} justify="flex-end">
                          <ActionIcon
                            variant="subtle"
                            aria-label="Editar"
                            onClick={() => handleEdit(user)}
                            disabled={isLoadingCurrentAdmin || !canManage}
                          >
                            <IconEdit size={18} />
                          </ActionIcon>
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            aria-label="Excluir"
                            onClick={() => setDeleteTarget(user)}
                            disabled={isLoadingCurrentAdmin || !canManage}
                          >
                            <IconTrash size={18} />
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}

                  {!isFetching && items.length === 0 && (
                    <Table.Tr>
                      <Table.Td colSpan={6}>
                        <Text c="dimmed" ta="center">
                          Nenhum usuario encontrado.
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </div>
          )}

          <Group justify="center" mt="lg">
            <Pagination
              value={page}
              onChange={setPage}
              total={totalPages}
              disabled={isFetching}
              size="sm"
            />
          </Group>
        </Paper>
      </Stack>

      <Modal
        opened={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Confirmar exclusao"
        centered
      >
        <Stack>
          <Text>
            Deseja remover o usuario <strong>{deleteTarget?.nome}</strong>?
          </Text>
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              color="red"
              loading={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Remover
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
