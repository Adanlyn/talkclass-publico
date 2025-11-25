import {
  Avatar,
  Button,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useMemo } from 'react';
import { formatCpf } from '../utils/cpf';
import classes from './ProfileModal.module.css';

export type ProfileData = {
  cpf: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
};

const STORAGE_KEY = 'tc_profile';

export function loadProfile(): ProfileData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ProfileData;
      return {
        cpf: parsed.cpf || '00000000000',
        name: parsed.name || 'Admin TalkClass',
        email: parsed.email || 'admin@talkclass.edu',
        phone: parsed.phone || '',
        role: parsed.role || 'Admin',
      };
    }
  } catch {
  }

  return {
    cpf: '00000000000',
    name: 'Admin TalkClass',
    email: 'admin@talkclass.edu',
    phone: '',
    role: 'Admin',
  };
}

function getInitials(name: string) {
  const parts = (name || '').trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + last).toUpperCase() || 'US';
}

type Props = {
  opened: boolean;
  onClose: () => void;
  profile?: ProfileData | null;
};

export default function ProfileModal({ opened, onClose, profile }: Props) {
  const data = useMemo(() => profile ?? loadProfile(), [profile]);
  const initials = useMemo(() => getInitials(data.name), [data.name]);
  const cpf = useMemo(() => formatCpf(data.cpf), [data.cpf]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={700}>Meu perfil</Text>}
      centered
      radius="md"
      size="lg"
      overlayProps={{ opacity: 0.35, blur: 2 }}
      classNames={{ body: classes.modalBody, header: classes.modalHeader }}
    >
      <Stack gap="md">
        <Group align="center" gap="md">
          <Avatar
            size={72}
            radius="xl"
            bg="var(--mantine-color-orange-6)"
            color="white"
            className={classes.avatar}
            aria-label="Avatar do usuario"
          >
            {initials}
          </Avatar>
          <Text c="dimmed" fz="sm">
            Dados gerenciados pela administração. Edição direta desabilitada.
          </Text>
        </Group>

        <TextInput label="Perfil" value={data.role || 'Admin'} readOnly radius="md" />
        <TextInput label="CPF" value={cpf} readOnly radius="md" />
        <TextInput label="Nome" value={data.name} readOnly radius="md" />
        <TextInput label="E-mail" value={data.email} readOnly radius="md" />
        <TextInput label="Celular" value={data.phone || ''} readOnly radius="md" />

        <Group justify="flex-end" mt="xs">
          <Button onClick={onClose} color="orange">
            Fechar
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
