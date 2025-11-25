import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  MultiSelect,
  NumberInput,
  Paper,
  Radio,
  Select,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { IconAlertCircle, IconEdit, IconPower } from '@tabler/icons-react';
import { useForm } from '@mantine/form';
import { useAdminTitle } from '../../components/Layout/AdminTitleContext';
import classes from './Admin.module.css';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAlertEmailConfig,
  listAlertRules,
  saveAlertEmailConfig,
  setAlertRuleStatus,
  upsertAlertRule,
  type AlertRule,
} from '../../services/alerts';
import { notifyError, notifySuccess } from '../../services/notifications';
import { listAdminUsers } from '../../services/adminUsers';
import { listCategories } from '../../services/categories';
import { useCurrentAdmin } from '../../hook/useCurrentAdmin';

type RuleFormValues = {
  id?: string;
  nome: string;
  categoriaId: string;
  notaMinima: number;
  periodoDias: number;
  enviarEmail: boolean;
  ativa: boolean;
};

type EmailFormValues = {
  adminRecipients: string[];
  extraEmails: string;
  sendMode: 'immediate' | 'daily';
  criticalKeywords: string;
};

const ALL_VALUE = '__all_categories__';

export default function AdminAlerts() {
  useAdminTitle('Alertas');

  const { data: currentAdmin } = useCurrentAdmin();
  const roles = useMemo(
    () => currentAdmin?.roles ?? (currentAdmin?.role ? [currentAdmin.role] : []),
    [currentAdmin]
  );
  const canEditEmail = roles.includes('Master');

  const [tab, setTab] = useState<'rules' | 'email'>('rules');
  const [modalOpened, modal] = useDisclosure(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const qc = useQueryClient();
  const isCompact = useMediaQuery('(max-width: 64rem)');

  const form = useForm<RuleFormValues>({
    initialValues: {
      nome: '',
      categoriaId: ALL_VALUE,
      notaMinima: 3,
      periodoDias: 7,
      enviarEmail: true,
      ativa: true,
    },
    validate: {
      nome: (value) => (value.trim().length ? null : 'Informe o nome da regra'),
      notaMinima: (value) =>
        value > 0 && value <= 5 ? null : 'A nota mínima deve estar entre 0 e 5',
      periodoDias: (value) => (value >= 1 ? null : 'Informe um período em dias'),
    },
  });

  const emailForm = useForm<EmailFormValues>({
    initialValues: {
      adminRecipients: [],
      extraEmails: '',
      sendMode: 'immediate',
      criticalKeywords: '',
    },
  });

  const qRules = useQuery({
    queryKey: ['alert-rules'],
    queryFn: listAlertRules,
    refetchOnWindowFocus: false,
  });

  const qCategories = useQuery({
    queryKey: ['categories', 'alert-rules'],
    queryFn: () => listCategories({ page: 1, pageSize: 200, onlyActive: true }),
    refetchOnWindowFocus: false,
  });

  const qAdmins = useQuery({
    queryKey: ['admin-users', 'alert-recipients'],
    queryFn: () => listAdminUsers({ page: 1, pageSize: 200, active: true }),
    refetchOnWindowFocus: false,
  });

  const qEmail = useQuery({
    queryKey: ['alert-email-config'],
    queryFn: getAlertEmailConfig,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (qEmail.data) {
      emailForm.setValues({
        adminRecipients: qEmail.data.adminRecipients ?? [],
        extraEmails: qEmail.data.extraEmails ?? '',
        sendMode: qEmail.data.sendMode ?? 'immediate',
        criticalKeywords: qEmail.data.criticalKeywords ?? '',
      });
      emailForm.resetDirty(qEmail.data);
    }
  }, [qEmail.data]);

  const categoryOptions = useMemo(
    () => [
      { value: ALL_VALUE, label: 'Todas as categorias' },
      ...((qCategories.data?.items ?? []).map((c) => ({
        value: c.id,
        label: c.nome,
      })) ?? []),
    ],
    [qCategories.data]
  );

  const categoryLabels = useMemo(() => {
    const map = new Map<string, string>();
    (qCategories.data?.items ?? []).forEach((c) => map.set(c.id, c.nome));
    return map;
  }, [qCategories.data]);

  const adminOptions = useMemo(
    () =>
      (qAdmins.data?.items ?? []).map((admin) => ({
        value: admin.id,
        label: admin.email ? `${admin.nome} · ${admin.email}` : admin.nome,
      })),
    [qAdmins.data]
  );

  const mSaveRule = useMutation({
    mutationFn: (values: RuleFormValues) =>
      upsertAlertRule({
        id: values.id,
        nome: values.nome.trim(),
        categoriaId: values.categoriaId === ALL_VALUE ? null : values.categoriaId,
        notaMinima: values.notaMinima,
        periodoDias: values.periodoDias,
        enviarEmail: values.enviarEmail,
        ativa: values.ativa,
      }),
    onSuccess: (_rule, vars) => {
      notifySuccess(vars.id ? 'Regra atualizada com sucesso.' : 'Regra criada com sucesso.');
      qc.invalidateQueries({ queryKey: ['alert-rules'] });
      closeModal();
    },
    onError: (err) => notifyError(err),
  });

  const mToggleRule = useMutation({
    mutationFn: ({ id, ativa }: { id: string; ativa: boolean }) => setAlertRuleStatus(id, ativa),
    onSuccess: (_r, vars) => {
      notifySuccess(vars.ativa ? 'Regra ativada.' : 'Regra desativada.');
      qc.invalidateQueries({ queryKey: ['alert-rules'] });
    },
    onError: (err) => notifyError(err),
  });

  const mSaveEmail = useMutation({
    mutationFn: saveAlertEmailConfig,
    onSuccess: () => {
      notifySuccess('Configuração de e-mail atualizada.');
      qc.invalidateQueries({ queryKey: ['alert-email-config'] });
    },
    onError: (err) => notifyError(err),
  });

  function handleNewRule() {
    setEditingRule(null);
    form.reset();
    modal.open();
  }

  function handleEditRule(rule: AlertRule) {
    setEditingRule(rule);
    form.setValues({
      id: rule.id,
      nome: rule.nome,
      categoriaId: rule.categoriaId ?? ALL_VALUE,
      notaMinima: rule.notaMinima,
      periodoDias: rule.periodoDias,
      enviarEmail: rule.enviarEmail,
      ativa: rule.ativa,
    });
    modal.open();
  }

  function closeModal() {
    modal.close();
    setEditingRule(null);
    form.reset();
  }

  const handleSubmitRule = form.onSubmit((values) => mSaveRule.mutate(values));

  const handleSubmitEmail = emailForm.onSubmit((values) => {
    if (!canEditEmail) return;
    mSaveEmail.mutate(values);
  });

  const rules = qRules.data ?? [];

  const renderCondition = (rule: AlertRule) =>
    `Média abaixo de ${rule.notaMinima.toLocaleString('pt-BR', {
      maximumFractionDigits: 1,
    })} nos últimos ${rule.periodoDias} dias`;

  const getCategoryLabel = (categoriaId: string | null) =>
    categoriaId ? categoryLabels.get(categoriaId) ?? 'Categoria removida' : 'Todas';

  return (
    <Stack gap={{ base: 'md', lg: 'lg' }} px={{ base: 'md', lg: 0 }} py={{ base: 'md', lg: 'lg' }}>



      <Paper className={classes.panel} p={{ base: 'md', lg: 'lg' }} withBorder>
        <Tabs
          value={tab}
          onChange={(value) => setTab((value as 'rules' | 'email') || 'rules')}
          keepMounted={false}
        >
          <Tabs.List mb={{ base: 'sm', lg: 'lg' }}>
            <Tabs.Tab value="rules">Regras de alerta</Tabs.Tab>
            <Tabs.Tab value="email">Configuração de e-mail (apenas Master edita)</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="rules">
            <Stack gap={{ base: 'md', lg: 'lg' }}>
              <Stack gap={4}>
                <Title order={4}>Regras de alerta</Title>
                <Text c="dimmed" fz="sm">
                  Defina condições para monitorar médias abaixo do esperado.
                </Text>
              </Stack>
              <Group
                justify="space-between"
                align={isCompact ? 'stretch' : 'center'}
                gap="sm"
                wrap="wrap"
              >
                <Text size="sm" c="dimmed">
                  {rules.length} regra(s) configuradas
                </Text>
                <Button onClick={handleNewRule} fullWidth={isCompact} mt={isCompact ? 'xs' : 0}>
                  Nova regra
                </Button>
              </Group>

              {qRules.isError && (
                <Alert color="red" icon={<IconAlertCircle size={18} />}>
                  Não foi possível carregar as regras. Recarregue a página para tentar novamente.
                </Alert>
              )}

              {qRules.isLoading && (
                <Group justify="center" py="xl">
                  <Loader />
                </Group>
              )}

              {!qRules.isLoading && rules.length === 0 && (
                <Text c="dimmed" ta="center" py="lg">
                  Nenhuma regra cadastrada ainda. Clique em &quot;Nova regra&quot; para começar.
                </Text>
              )}

              {!qRules.isLoading && rules.length > 0 && (
                <>
                  {isCompact ? (
                    <Stack gap="sm">
                      {rules.map((rule) => (
                        <Paper key={rule.id} withBorder p="md" radius="md">
                          <Stack gap={6}>
                            <Text fw={600}>{rule.nome}</Text>
                            <Text size="sm" c="dimmed">
                              Categoria: {getCategoryLabel(rule.categoriaId)}
                            </Text>
                            <Text size="sm">{renderCondition(rule)}</Text>
                            <Group gap="xs">
                              <Badge color={rule.enviarEmail ? 'green' : 'gray'} variant="light">
                                {rule.enviarEmail ? 'Envia e-mail' : 'Sem e-mail'}
                              </Badge>
                              <Badge color={rule.ativa ? 'green' : 'gray'} variant="light">
                                {rule.ativa ? 'Ativa' : 'Inativa'}
                              </Badge>
                            </Group>
                            <Group gap="xs" wrap="wrap">
                              <Button
                                variant="subtle"
                                size="xs"
                                leftSection={<IconEdit size={14} />}
                                onClick={() => handleEditRule(rule)}
                              >
                                Editar
                              </Button>
                              <Button
                                variant="light"
                                size="xs"
                                color={rule.ativa ? 'gray' : 'green'}
                                leftSection={<IconPower size={14} />}
                                loading={
                                  mToggleRule.isPending && mToggleRule.variables?.id === rule.id
                                }
                                onClick={() =>
                                  mToggleRule.mutate({ id: rule.id, ativa: !rule.ativa })
                                }
                              >
                                {rule.ativa ? 'Desativar' : 'Ativar'}
                              </Button>
                            </Group>
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                  ) : (
                    <div className={`${classes.tableWrap}`}>
                      <Table className={`${classes.table} ${classes.tableMin}`} highlightOnHover>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Nome da regra</Table.Th>
                            <Table.Th>Categoria</Table.Th>
                            <Table.Th>Condição</Table.Th>
                            <Table.Th>Envia e-mail?</Table.Th>
                            <Table.Th>Status</Table.Th>
                            <Table.Th>Ações</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {rules.map((rule) => (
                            <Table.Tr key={rule.id}>
                              <Table.Td>{rule.nome}</Table.Td>
                              <Table.Td>{getCategoryLabel(rule.categoriaId)}</Table.Td>
                              <Table.Td>{renderCondition(rule)}</Table.Td>
                              <Table.Td>
                                <Badge color={rule.enviarEmail ? 'green' : 'gray'} variant="light">
                                  {rule.enviarEmail ? 'Sim' : 'Não'}
                                </Badge>
                              </Table.Td>
                              <Table.Td>
                                <Badge color={rule.ativa ? 'green' : 'gray'} variant="light">
                                  {rule.ativa ? 'Ativa' : 'Inativa'}
                                </Badge>
                              </Table.Td>
                              <Table.Td>
                                <Group gap="xs">
                                  <Button
                                    variant="subtle"
                                    size="xs"
                                    leftSection={<IconEdit size={14} />}
                                    onClick={() => handleEditRule(rule)}
                                  >
                                    Editar
                                  </Button>
                                  <Button
                                    variant="light"
                                    size="xs"
                                    color={rule.ativa ? 'gray' : 'green'}
                                    leftSection={<IconPower size={14} />}
                                    loading={
                                      mToggleRule.isPending &&
                                      mToggleRule.variables?.id === rule.id
                                    }
                                    onClick={() =>
                                      mToggleRule.mutate({ id: rule.id, ativa: !rule.ativa })
                                    }
                                  >
                                    {rule.ativa ? 'Desativar' : 'Ativar'}
                                  </Button>
                                </Group>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </div>
                  )}
                </>
              )}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="email">
            <Stack gap={{ base: 'md', lg: 'lg' }}>
              <Stack gap={4}>
                <Title order={4}>Configuração de e-mail</Title>
                <Text c="dimmed" fz="sm">
                  Defina quem recebe os alertas que possuem envio habilitado e como os e-mails são
                  disparados.
                </Text>
              </Stack>

              {!canEditEmail && (
                <Alert color="yellow" icon={<IconAlertCircle size={18} />}>
                  Apenas administradores Master podem alterar esta configuração. Você tem acesso de
                  leitura.
                </Alert>
              )}

              {qEmail.isError && (
                <Alert color="red" icon={<IconAlertCircle size={18} />}>
                  Não foi possível carregar a configuração de e-mail.
                </Alert>
              )}

              {qEmail.isLoading ? (
                <Group justify="center" py="xl">
                  <Loader />
                </Group>
              ) : (
                <form onSubmit={handleSubmitEmail}>
                  <Stack gap="md">
                    <Paper p={{ base: 'md', lg: 'lg' }} radius="md" withBorder>
                      <Stack gap="sm">
                        <Title order={5}>Quem recebe esses alertas por e-mail</Title>
                        <MultiSelect
                          label="Admins destinatários"
                          placeholder="Selecione administradores"
                          data={adminOptions}
                          searchable
                          disabled={!canEditEmail}
                          {...emailForm.getInputProps('adminRecipients')}
                        />
                        <TextInput
                          label="E-mails extras (opcional)"
                          placeholder="coord@faculdade.com, diretor@faculdade.com"
                          disabled={!canEditEmail}
                          {...emailForm.getInputProps('extraEmails')}
                        />
                        <TextInput
                          label="Palavras-chave críticas (separe por vírgula ou ponto e vírgula)"
                          placeholder="greve, assédio, agressão"
                          disabled={!canEditEmail}
                          {...emailForm.getInputProps('criticalKeywords')}
                        />
                        <Text c="dimmed" fz="sm">
                          Esta lista é usada para todas as regras com envio de e-mail habilitado. Palavras-chave críticas geram alerta imediato se encontradas em respostas de texto (últimos 30 dias).
                        </Text>
                      </Stack>
                    </Paper>

                    <Paper p={{ base: 'md', lg: 'lg' }} radius="md" withBorder>
                      <Stack gap="sm">
                        <Title order={5}>Como enviar os e-mails</Title>
                        <Radio.Group {...emailForm.getInputProps('sendMode')}>
                          <Stack gap={8}>
                            <Radio
                              value="immediate"
                              label="Imediato – envia um e-mail toda vez que a regra dispara."
                              disabled={!canEditEmail}
                            />
                            <Radio
                              value="daily"
                              label="Resumo diário – envia um e-mail consolidado por dia."
                              disabled={!canEditEmail}
                            />
                          </Stack>
                        </Radio.Group>
                      </Stack>
                    </Paper>

                    <Group justify="flex-end">
                      <Button type="submit" disabled={!canEditEmail} loading={mSaveEmail.isPending}>
                        Salvar
                      </Button>
                    </Group>
                  </Stack>
                </form>
              )}
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Paper>

      <Modal
        opened={modalOpened}
        onClose={closeModal}
        title={editingRule ? 'Editar regra de alerta' : 'Nova regra de alerta'}
        size="lg"
        centered
      >
        <form onSubmit={handleSubmitRule}>
          <Stack gap="md">
            <TextInput label="Nome da regra" withAsterisk {...form.getInputProps('nome')} />

            <Select
              label="Categoria (opcional)"
              data={categoryOptions}
              value={form.values.categoriaId}
              onChange={(value) =>
                form.setFieldValue('categoriaId', value ?? ALL_VALUE)
              }
              withinPortal
              nothingFoundMessage="Nenhuma categoria"
              loading={qCategories.isLoading}
              searchable
            />

            <Stack gap="xs">
              <Text fw={600} fz="sm">
                Condição básica
              </Text>
              <Text c="dimmed" fz="sm">
                Tipo fixo: Média abaixo de X nos últimos Y dias
              </Text>
              <Group grow>
                <NumberInput
                  label="Nota mínima (X)"
                  min={0}
                  max={5}
                  step={0.1}
                  value={form.values.notaMinima}
                  onChange={(value) =>
                    form.setFieldValue(
                      'notaMinima',
                      typeof value === 'number' ? value : Number(value) || 0
                    )
                  }
                  error={form.errors.notaMinima}
                />
                <NumberInput
                  label="Período em dias (Y)"
                  min={1}
                  value={form.values.periodoDias}
                  onChange={(value) =>
                    form.setFieldValue(
                      'periodoDias',
                      typeof value === 'number' ? value : Number(value) || 1
                    )
                  }
                  error={form.errors.periodoDias}
                />
              </Group>
            </Stack>

            <Switch
              label="Enviar e-mail quando essa regra disparar"
              checked={form.values.enviarEmail}
              onChange={(event) =>
                form.setFieldValue('enviarEmail', event.currentTarget.checked)
              }
            />

            <Switch
              label="Regra ativa?"
              checked={form.values.ativa}
              onChange={(event) => form.setFieldValue('ativa', event.currentTarget.checked)}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={closeModal}>
                Cancelar
              </Button>
              <Button type="submit" loading={mSaveRule.isPending}>
                Salvar
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
