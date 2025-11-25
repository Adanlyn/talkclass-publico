import {
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  Stack,
  Text,
  Title,
  ActionIcon,
  Menu,
} from '@mantine/core';
import { IconDots, IconChecks, IconTrash } from '@tabler/icons-react';
import { useNotifications } from '../state/notifications';
import classes from './NotificationsCenterModal.module.css';
import { useNavigate } from 'react-router-dom';

type Props = {
  opened: boolean;
  onClose: () => void;
};

export default function NotificationsCenterModal({ opened, onClose }: Props) {
  const navigate = useNavigate();
  const {
    list,
    markItemRead,
    markAllRead,
    isExpanded,
    toggleExpand,
    removeItem,
  } = useNotifications();

  const handleGoToFeedback = (id?: string | null) => {
    if (!id) return;
    navigate(`/admin/feedbacks?feedbackId=${id}`);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      radius="md"
      size="xl"
      padding="lg"
      withCloseButton
      title={<Title order={4}>Notificações</Title>}
      classNames={{ body: classes.modalBody, header: classes.modalHeader }}
      overlayProps={{ opacity: 0.15, blur: 2 }}
      centered
    >
      {/* header de ações simples */}
      <Group mb="md" gap="xs">
        <Button
          leftSection={<IconChecks size={16} />}
          variant="light"
          onClick={markAllRead}
        >
          Ler todas
        </Button>
      </Group>

      <Stack gap="sm">
        {list.length === 0 && (
          <Text c="dimmed">Sem notificações.</Text>
        )}

        {list.map((n) => {
          const expanded = isExpanded(n.id);
          return (
            <Paper
              key={n.id}
              withBorder
              radius="md"
              p="md"
              className={`${classes.item} ${!n.read ? classes.unread : ''}`}
            >
              <div
                className={classes.row}
                onClick={() => (n.feedbackId ? handleGoToFeedback(n.feedbackId) : toggleExpand(n.id))}
                role="button"
                aria-label="Abrir notificação"
              >
                <div className={classes.main}>
                  <Group gap={8} wrap="wrap">
                    <Title order={5} className={classes.title}>
                      {n.title}
                    </Title>

                    {/* chips */}
                    {!n.read && (
                      <Badge size="sm" radius="sm" variant="light" color="orange">
                        NOVO
                      </Badge>
                    )}
                    {n.tag && (
                      <Badge
                        size="sm"
                        radius="sm"
                        variant={n.tag === 'ALERTA' ? 'filled' : 'light'}
                        color={n.tag === 'ALERTA' ? 'red' : n.tag === 'OK' ? 'teal' : 'blue'}
                      >
                        {n.tag}
                      </Badge>
                    )}
                  </Group>

                  {/* resumo */}
                  <Text c="dimmed" fz="sm" mt={4} lineClamp={expanded ? undefined : 1}>
                    {n.message}
                  </Text>

                  <Text c="dimmed" fz="xs" mt={4}>
                    {n.when} · {n.ago}
                  </Text>
                </div>

                {/* menu por item – sem duplicação */}
                <Menu withinPortal position="bottom-end" shadow="md">
                  <Menu.Target>
                    <ActionIcon
                      variant="subtle"
                      aria-label="Mais opções"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <IconDots size={16} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
                    {!n.read && (
                      <Menu.Item
                        leftSection={<IconChecks size={14} />}
                        onClick={() => markItemRead(n.id)}
                      >
                        Marcar como lida
                      </Menu.Item>
                    )}
                    <Menu.Item
                      color="red"
                      leftSection={<IconTrash size={14} />}
                      onClick={() => removeItem(n.id)}
                    >
                      Excluir
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </div>

              {/* área expandida (somente visual) */}
              {expanded && n.meta && (
                <Paper p="sm" mt="sm" radius="sm" className={classes.meta}>
                  <Text fz="sm">{n.meta}</Text>
                </Paper>
              )}
            </Paper>
          );
        })}
      </Stack>
    </Modal>
  );
}
