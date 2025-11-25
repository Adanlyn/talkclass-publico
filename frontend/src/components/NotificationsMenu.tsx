import {
  ActionIcon, Badge, Button, Group, Menu, Paper, Stack, Text, Title,
} from '@mantine/core';
import { IconDots, IconChecks, IconTrash } from '@tabler/icons-react';
import { useNotifications } from '../state/notifications';
import { useNavigate } from 'react-router-dom';
import classes from './NotificationsMenu.module.css';

type Props = { onOpenCenter: () => void };

export default function NotificationsMenu({ onOpenCenter }: Props) {
  const navigate = useNavigate();
  const {
    list,
    markAllRead,
    deleteAll,
    markItemRead,
    removeItem,
    unreadCount,
  } = useNotifications();

  const handleGoToFeedback = (id?: string | null) => {
    if (!id) return;
    navigate(`/admin/feedbacks?feedbackId=${id}`);
  };

  return (
    <Paper className={classes.popup} p="md" radius="md" withBorder>
      <Group justify="space-between" mb="sm">
        <Title order={5}>Notificações</Title>
        <Button
          variant="subtle"
          size="compact-xs"
          leftSection={<IconChecks size={14} />}
          onClick={markAllRead}
        >
          Marcar tudo como lida
        </Button>
      </Group>

      <Stack gap="xs">
        {list.slice(0, 5).map((n) => (
          <Paper
            key={n.id}
            className={`${classes.item} ${!n.read ? classes.unread : ''}`}
            withBorder
            radius="md"
            p="sm"
            onClick={() => handleGoToFeedback(n.feedbackId)}
            style={{ cursor: n.feedbackId ? 'pointer' : 'default' }}
          >
            <Group wrap="nowrap" align="flex-start">
              {/* checkbox opcional: descomentar se quiser no popover também */}
              {/* <Checkbox size="sm" /> */}

              <div style={{ flex: 1 }}>
                <Group gap={8} mb={4}>
                  <Text fw={700}>{n.title}</Text>
                  {n.tag && (
                    <Badge size="sm" radius="sm"
                      variant={n.tag === 'ALERTA' ? 'filled' : 'light'}
                      color={n.tag === 'ALERTA' ? 'red' : n.tag === 'OK' ? 'teal' : 'blue'}>
                      {n.tag}
                    </Badge>
                  )}
                </Group>
                {n.message && <Text c="dimmed" fz="sm">{n.message}</Text>}
                <Text c="dimmed" fz="xs" mt={4}>{n.ago}</Text>
              </div>

              <Menu withinPortal position="bottom-end" shadow="md">
                <Menu.Target>
                  <ActionIcon variant="subtle" aria-label="Mais">
                    <IconDots size={16} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  {!n.read && (
                    <Menu.Item leftSection={<IconChecks size={14} />} onClick={() => markItemRead(n.id)}>
                      Marcar como lida
                    </Menu.Item>
                  )}
                  <Menu.Item leftSection={<IconTrash size={14} />} color="red" onClick={() => removeItem(n.id)}>
                    Excluir
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Paper>
        ))}
      </Stack>

      {list.length > 0 && (
        <Group mt="md" justify="center">
          <Button variant="light" onClick={onOpenCenter}>Ver todas</Button>
        </Group>
      )}

      {unreadCount === 0 && list.length === 0 && (
        <Text c="dimmed" ta="center" mt="sm" fz="sm">Sem notificações.</Text>
      )}
    </Paper>
  );
}
