import {
  Alert,
  Button,
  Container,
  Paper,
  PasswordInput,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import Header from '../components/Header';
import classes from './Login.module.css';
import { changePassword, login, getMe } from '../services/auth.service';
import { notifyError, notifySuccess } from '../services/notifications';
import { useCurrentAdmin } from '../hook/useCurrentAdmin';
import type { CurrentAdmin } from '../types/admin';

export default function FirstAccess() {
  const { data: currentAdmin, isLoading } = useCurrentAdmin();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (isLoading) return;
    if (currentAdmin && !currentAdmin.mustChangePassword) {
      navigate('/admin', { replace: true });
    }
  }, [currentAdmin, isLoading, navigate]);

  const form = useForm({
    initialValues: { senhaAtual: '', novaSenha: '', confirmacao: '' },
  });

  const handleSubmit = form.onSubmit(async (values) => {
    const nova = values.novaSenha.trim();
    if (nova.length < 6) {
      form.setFieldError('novaSenha', 'Use ao menos 6 caracteres');
      return;
    }
    if (nova !== values.confirmacao.trim()) {
      form.setFieldError('confirmacao', 'As senhas não conferem');
      return;
    }

    try {
      await changePassword(values.senhaAtual, nova);
      if (currentAdmin?.cpf) {
        await login(currentAdmin.cpf, nova);
      }
      const fresh = await getMe();
      qc.setQueryData<CurrentAdmin | undefined>(['current-admin'], fresh);
      notifySuccess('Senha atualizada com sucesso.');
      await qc.invalidateQueries({ queryKey: ['current-admin'] });
      navigate('/admin', { replace: true });
    } catch (err) {
      notifyError(err);
    }
  });

  return (
    <div className={classes.page}>
      <Header />

      <main className={classes.main}>
        <Container size="xs">
          <Paper radius="lg" p="xl" className={classes.card} withBorder>
            <Stack gap="sm">
              <Title order={3} ta="center" className={classes.title}>
                Defina sua nova senha
              </Title>
              <Text ta="center" c="dimmed" fz="sm">
                Este é seu primeiro acesso com uma senha temporária. Informe a senha provisória atual e crie uma nova para continuar usando o painel.
              </Text>

              <Alert color="yellow">
                Após a troca, você será redirecionado para a área administrativa.
              </Alert>

              <form onSubmit={handleSubmit}>
                <Stack gap="md" mt="sm">
                  <PasswordInput
                    label="Senha provisória"
                    placeholder="Senha que você usou para entrar"
                    withAsterisk
                    {...form.getInputProps('senhaAtual')}
                  />

                  <PasswordInput
                    label="Nova senha"
                    placeholder="Mínimo de 6 caracteres"
                    withAsterisk
                    {...form.getInputProps('novaSenha')}
                  />

                  <PasswordInput
                    label="Confirme a nova senha"
                    placeholder="Repita a nova senha"
                    withAsterisk
                    {...form.getInputProps('confirmacao')}
                  />

                  <Button type="submit" fullWidth color="orange" radius="md" size="md">
                    Salvar nova senha
                  </Button>
                </Stack>
              </form>
            </Stack>
          </Paper>
        </Container>
      </main>
    </div>
  );
}
