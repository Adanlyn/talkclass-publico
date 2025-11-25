import {
  Alert,
  Anchor,
  Button,
  Checkbox,
  Container,
  Group,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Header from '../components/Header';
import classes from './Login.module.css';
import { login, getMe } from '../services/auth.service';
import type { CurrentAdmin } from '../types/admin';

type FormValues = {
  cpf: string;
  password: string;
  remember: boolean;
};

export default function Login() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    initialValues: { cpf: '', password: '', remember: true },
    validate: {
      cpf: (value) =>
        /^\d{11}$/.test(value.replace(/\D/g, ''))
          ? null
          : 'Informe um CPF valido com 11 digitos',
      password: (value) =>
        value.length >= 6 ? null : 'Senha deve ter no minimo 6 caracteres',
    },
  });

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const cpf = values.cpf.replace(/\D/g, '');

      await login(cpf, values.password);
      const me = await getMe();
      qc.setQueryData<CurrentAdmin | undefined>(['current-admin'], me);

      navigate(me.mustChangePassword ? '/primeiro-acesso' : '/admin');
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401) {
        setErrorMessage('E-mail ou senha incorreta. Verifique seus dados e tente novamente.');
      } else if (status === 400) {
        const serverMessage =
          typeof err?.response?.data === 'string' ? err.response.data : null;
        setErrorMessage(serverMessage ?? 'Seu usuario esta desativado.');
      } else {
        setErrorMessage('Nao foi possivel entrar. Tente novamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = () => {
    const digits = form.values.cpf.replace(/\D/g, '');
    if (!/^\d{11}$/.test(digits)) {
      form.setFieldError('cpf', 'Informe o CPF antes de recuperar a senha.');
      return;
    }

    navigate(`/redefinir-senha?cpf=${digits}`);
  };

  return (
    <div className={classes.page}>
      <Header />

      <main className={classes.main}>
        <Container size="xs">
          <Paper radius="lg" p="xl" className={classes.card} withBorder>
            <Stack gap="sm">
              <Title order={3} ta="center" className={classes.title}>
                Acesso Administrativo
              </Title>
              <Text ta="center" c="dimmed" fz="sm">
                Insira suas credenciais para entrar no painel.
              </Text>

              {errorMessage && (
                <Alert
                  color="red"
                  variant="light"
                  title="Nao foi possivel entrar"
                  withCloseButton
                >
                  {errorMessage}
                </Alert>
              )}

              {/* Campos falsos para impedir prompts de salvar senha */}
              <div
                aria-hidden="true"
                style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
              >
                <input
                  type="text"
                  name="hidden-username"
                  autoComplete="username"
                  tabIndex={-1}
                  defaultValue=""
                  readOnly
                />
                <input
                  type="password"
                  name="hidden-password"
                  autoComplete="new-password"
                  tabIndex={-1}
                  defaultValue=""
                  readOnly
                />
              </div>
              <form onSubmit={form.onSubmit(onSubmit)} autoComplete="off" spellCheck={false}>
                <Stack gap="md" mt="sm">
                  <TextInput
                    name="login-cpf"
                    label="CPF"
                    placeholder="000.000.000-00"
                    withAsterisk
                    autoComplete="off"
                    {...form.getInputProps('cpf')}
                  />

                  <PasswordInput
                    name="login-password"
                    label="Senha"
                    placeholder="********"
                    withAsterisk
                    autoComplete="new-password"
                    {...form.getInputProps('password')}
                  />

                  <Group justify="space-between" align="center">
                    <Checkbox
                      label="Lembrar-me"
                      {...form.getInputProps('remember', { type: 'checkbox' })}
                    />
                    <Anchor component="button" type="button" onClick={handleForgotPassword} fz="sm">
                      Esqueci minha senha
                    </Anchor>
                  </Group>

                  <Button
                    type="submit"
                    fullWidth
                    color="orange"
                    radius="md"
                    size="md"
                    loading={isSubmitting}
                  >
                    Entrar
                  </Button>
                </Stack>
              </form>
            </Stack>
          </Paper>

          <Text ta="center" mt="md" fz="sm" className={classes.notice}>
            * Somente usuarios autorizados pela administracao tem credenciais de acesso.
          </Text>
        </Container>
      </main>

      <footer className={classes.footer}>
        <Container size="lg">
          <Text size="sm">
            (c) {new Date().getFullYear()} TalkClass. Todos os direitos reservados.
          </Text>
        </Container>
      </footer>
    </div>
  );
}
