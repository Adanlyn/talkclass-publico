import {
  Alert,
  Button,
  Container,
  Group,
  Loader,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import classes from './RedefinirSenha.module.css';
import {
  confirmPasswordReset,
  requestPasswordReset,
  verifyResetToken,
} from '../services/auth.service';
import { notifyError, notifySuccess } from '../services/notifications';

type FormValues = {
  token: string;
  password: string;
  confirm: string;
};

function formatSeconds(total: number) {
  const minutes = Math.floor(total / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (total % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export default function RedefinirSenha() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const cpf = (params.get('cpf') ?? '').replace(/\D/g, '');

  const [emailMask, setEmailMask] = useState<string | null>(null);
  const [sendingToken, setSendingToken] = useState(false);
  const [initializing, setInitializing] = useState(Boolean(cpf));
  const [tokenValidated, setTokenValidated] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [validationLoading, setValidationLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const form = useForm<FormValues>({
    initialValues: { token: '', password: '', confirm: '' },
    validate: {
      token: (value) =>
        value.trim().length >= 6 ? null : 'Informe o token recebido por e-mail.',
      password: (value) =>
        value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value)
          ? null
          : 'Mínimo 8 caracteres com letras e números.',
      confirm: (value, values) =>
        value === values.password ? null : 'As senhas não conferem.',
    },
  });

  const countdown = useMemo(() => formatSeconds(remainingSeconds), [remainingSeconds]);

  useEffect(() => {
    if (!expiresAt) {
      setRemainingSeconds(0);
      return;
    }

    const update = () => {
      setRemainingSeconds(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    };

    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  useEffect(() => {
    if (!cpf) {
      setInitializing(false);
      return;
    }

    let active = true;
    (async () => {
      try {
        await sendToken(true);
      } finally {
        if (active) setInitializing(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [cpf]);

  useEffect(() => {
    if (!expiresAt) return;
    if (remainingSeconds > 0) return;
    if (Date.now() < expiresAt) return;
    setTokenValidated(false);
    setTokenError('Token expirado. Clique em reenviar para gerar um novo código.');
  }, [remainingSeconds, expiresAt]);

  const sendToken = async (silent = false) => {
    if (!cpf) return;

    try {
      if (!silent) setSendingToken(true);
      setTokenValidated(false);
      setTokenError(null);
      const data = await requestPasswordReset(cpf);
      setEmailMask(data.emailMask);
      setExpiresAt(Date.now() + data.expiresInSeconds * 1000);
      form.setFieldValue('token', '');
      form.setFieldError('token', null);
      if (!silent) notifySuccess('Enviamos um novo token para o seu e-mail cadastrado.');
    } catch (err: any) {
      notifyError(err);
      const message =
        typeof err?.response?.data === 'string'
          ? err.response.data
          : 'Nao foi possivel enviar o token.';
      setTokenError(message);
    } finally {
      if (!silent) setSendingToken(false);
    }
  };

  const handleValidateToken = async () => {
    const normalized = form.values.token.trim().toUpperCase();
    if (normalized.length < 6) {
      form.setFieldError('token', 'Informe o token recebido por e-mail.');
      return;
    }

    form.setFieldValue('token', normalized);

    try {
      setValidationLoading(true);
      const data = await verifyResetToken(normalized);
      setTokenValidated(true);
      setTokenError(null);
      if (typeof data?.remainingSeconds === 'number' && data.remainingSeconds > 0) {
        setExpiresAt(Date.now() + data.remainingSeconds * 1000);
      }
      notifySuccess('Token validado! Agora defina uma nova senha.');
    } catch (err: any) {
      setTokenValidated(false);
      const status = err?.response?.status;
      const message = err?.response?.data;
      const fallback =
        typeof message === 'string' ? message : 'Token inválido ou expirado.';
      setTokenError(fallback);
      if (status !== 400) notifyError(err);
    } finally {
      setValidationLoading(false);
    }
  };

  const handleReset = form.onSubmit(async (values) => {
    if (!tokenValidated) {
      setTokenError('Valide o token antes de redefinir sua senha.');
      return;
    }

    try {
      setResetLoading(true);
      await confirmPasswordReset(values.token.trim().toUpperCase(), values.password);
      notifySuccess('Senha redefinida com sucesso! Faça login novamente.');
      navigate('/login');
    } catch (err) {
      notifyError(err);
    } finally {
      setResetLoading(false);
    }
  });

  const renderContent = () => {
    if (!cpf) {
      return (
        <Alert
          icon={<IconAlertTriangle size={16} />}
          color="red"
          title="CPF não informado"
          variant="light"
        >
          Volte para a página de login, informe o CPF do administrador e clique em
          &quot;Esqueci minha senha&quot; para receber o token automaticamente.
          <Button mt="sm" color="orange" onClick={() => navigate('/login')}>
            Voltar para login
          </Button>
        </Alert>
      );
    }

    return (
      <form onSubmit={handleReset}>
        <Stack gap="md">
          <TextInput
            label="E-mail cadastrado"
            value={emailMask ?? '***********'}
            readOnly
            disabled
          />

          <Text size="sm" c="dimmed">
            Enviamos um token para o e-mail cadastrado. Ele expira em 5 minutos para sua
            segurança.
          </Text>

          <Group justify="space-between" align="center">
            <Text size="sm" c={remainingSeconds <= 30 ? 'red' : 'dimmed'}>
              <strong>Tempo restante:</strong> {countdown}
            </Text>
            <Button
              type="button"
              variant="subtle"
              color="orange"
              size="xs"
              onClick={() => sendToken(false)}
              loading={sendingToken}
            >
              Reenviar token
            </Button>
          </Group>

          {initializing && (
            <Group justify="center">
              <Loader size="sm" />
            </Group>
          )}

          {tokenError && (
            <Alert
              icon={<IconAlertTriangle size={16} />}
              color="red"
              variant="light"
            >
              {tokenError}
            </Alert>
          )}

          <TextInput
            label="Token"
            placeholder="ABC123"
            withAsterisk
            disabled={initializing}
            {...form.getInputProps('token')}
          />

          <Group>
            <Button
              type="button"
              color="orange"
              onClick={handleValidateToken}
              loading={validationLoading}
              disabled={initializing}
            >
              Validar token
            </Button>
          </Group>

          {tokenValidated && (
            <Stack gap="md">
              <PasswordInput
                label="Nova senha"
                placeholder="********"
                withAsterisk
                {...form.getInputProps('password')}
              />
              <PasswordInput
                label="Confirmar nova senha"
                placeholder="********"
                withAsterisk
                {...form.getInputProps('confirm')}
              />
              <Button
                type="submit"
                color="orange"
                radius="md"
                size="md"
                loading={resetLoading}
              >
                Redefinir senha
              </Button>
            </Stack>
          )}
        </Stack>
      </form>
    );
  };

  return (
    <div className={classes.page}>
      <Header />

      <main className={classes.main}>
        <Container size="xs">
          <Paper radius="lg" p="xl" className={classes.card} withBorder>
            <Stack gap="sm">
              <Title order={3} ta="center" className={classes.title}>
                Redefinir senha
              </Title>
              <Text ta="center" c="dimmed" fz="sm">
                Token enviado automaticamente para o e-mail cadastrado.
              </Text>

              {renderContent()}
            </Stack>
          </Paper>

          <Text ta="center" mt="md" fz="sm" className={classes.notice}>
            * Por segurança, o token expira poucos minutos após o envio.
          </Text>
        </Container>
      </main>

      <footer className={classes.footer}>
        <Container size="lg">
          <Text size="sm">
            ©{new Date().getFullYear()} TalkClass. Todos os direitos reservados.
          </Text>
        </Container>
      </footer>
    </div>
  );
}
