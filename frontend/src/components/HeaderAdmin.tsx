import { useState } from 'react';
import {
  ActionIcon,
  Avatar,
  Divider,
  Group,
  Indicator,
  Menu,
  Popover,
  TextInput,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconBellFilled,
  IconUser,
  IconLogout,
} from '@tabler/icons-react';

import { useNotifications } from '../state/notifications';
import NotificationsMenu from './NotificationsMenu';
import NotificationsCenterModal from './NotificationsCenterModal';
import classes from './HeaderAdmin.module.css';
import { AdminTitleContext } from './Layout/AdminTitleContext';


type Props = {
  title?: string;
  initials?: string;
  onLogout?: () => void;
  onProfile?: () => void;
};

export default function HeaderAdmin({
  title,
  initials = 'AD',
  onLogout,
  onProfile,
}: Props) {
  const { unreadCount, refresh } = useNotifications();

  const [menuOpened, menu] = useDisclosure(false); // popover de notificações
  const [centerOpened, setCenterOpened] = useState(false);

  return (
    <>
      <div className={classes.wrap}>
        <Title order={3} className={classes.h1}>{title}</Title>

        {/* lado direito */}
        <div className={classes.right}>
          <TextInput
            placeholder="Buscar…"
            className={classes.search}
            aria-label="Buscar"
          />

          {/* Notificações */}
          <Popover
            opened={menuOpened}
            onChange={menu.toggle}
            position="bottom-end"
            withArrow
            shadow="md"
            offset={16}
          >
            <Popover.Target>
              <Indicator
                disabled={unreadCount === 0}
                processing
                offset={4}
                size={8}
                color="orange"
              >
                <ActionIcon
                  aria-label="Notificações"
                  variant="subtle"
                  onClick={() => {
                    refresh();
                    menu.toggle();
                  }}
                  className={classes.bell}
                >
                  <IconBellFilled size={22} />
                </ActionIcon>
              </Indicator>
            </Popover.Target>

            <Popover.Dropdown>
              <NotificationsMenu
                onOpenCenter={() => {
                  menu.close();
                  setCenterOpened(true);
                }}
              />
            </Popover.Dropdown>
          </Popover>

          {/* Avatar com MENU de conta */}
          <Menu
            position="bottom-end"
            shadow="md"
            withinPortal
            width={240}                                /* << AUMENTA LARGURA */
            classNames={{ dropdown: classes.menuDropdown }} /* padding opcional */
          >
            <Menu.Target>
              <Avatar
                aria-label="Conta"
                className={classes.avatar}
                variant="filled"
                size="md"
                color="orange"
                styles={{ root: { cursor: 'pointer' }, placeholder: { color: '#fff' } }}
              >
                {initials}
              </Avatar>
            </Menu.Target>

            <Menu.Dropdown>
              <Menu.Label>Conta</Menu.Label>

              <Menu.Item
                leftSection={<IconUser size={16} />}
                onClick={onProfile}
              >
                Meu perfil
              </Menu.Item>

              <Divider />

              <Menu.Item
                color="red"
                leftSection={<IconLogout size={16} />}
                onClick={onLogout}
              >
                Sair
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>
      </div>

      {/* Centro de notificações (modal grande) */}
      <NotificationsCenterModal
        opened={centerOpened}
        onClose={() => setCenterOpened(false)}
      />
    </>
  );
}
