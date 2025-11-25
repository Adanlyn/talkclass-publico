import { ActionIcon, Button, Drawer, Stack, Text, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { IconMenu2, IconChevronRight } from '@tabler/icons-react';

import HeaderAdmin from '../../components/HeaderAdmin';
import ProfileModal from '../../components/ProfileModal';
import { logoutAndReload } from '../../utils/auth';
import { AdminTitleContext } from './AdminTitleContext';
import classes from '../../pages/admin/Admin.module.css';
import { useCurrentAdmin } from '../../hook/useCurrentAdmin';

function getInitials(name: string) {
  const parts = (name || '').trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + last).toUpperCase() || 'US';
}

export default function AdminLayout() {
  const [menuOpened, menu] = useDisclosure(false);
  const [profileOpened, profile] = useDisclosure(false);
  const [title, setTitle] = useState('');
  const { data: currentAdmin, isLoading } = useCurrentAdmin();
  const initials = useMemo(() => getInitials(currentAdmin?.nome || ''), [currentAdmin?.nome]);
  const loc = useLocation();
  const isMaster = (currentAdmin?.roles ?? []).includes('Master');
  const mustChangePassword = currentAdmin?.mustChangePassword ?? false;

  if (isLoading) {
    return null;
  }

  if (currentAdmin && mustChangePassword) {
    return <Navigate to="/primeiro-acesso" replace />;
  }

  const profileData = currentAdmin
    ? {
        cpf: currentAdmin.cpf,
        name: currentAdmin.nome,
        email: currentAdmin.email ?? '',
        phone: '',
        role: currentAdmin.role,
      }
    : null;

  const isActive = (path: string) => loc.pathname === path || loc.pathname.startsWith(`${path}/`);
  const handleLogout = () => logoutAndReload('/login');

  return (
    <AdminTitleContext.Provider value={{ title, setTitle }}>
      <div className={classes.page}>
        <main className={classes.main}>
          <div className={classes.shell}>
            <aside className={classes.sidebar} aria-label="Navegacao de administracao">
              <div className={classes.brand}>
                <Title order={4} c="white" fw={900}>
                  Admin
                </Title>
                <Text c="#e8dbd2" fz="xs">
                  Painel TalkClass
                </Text>
              </div>

              <nav className={classes.nav}>
                <Link to="/admin" className={`${classes.navItem} ${isActive('/admin') ? classes.navItemActive : ''}`}>
                  <span>Visao geral</span>
                  <IconChevronRight size={16} />
                </Link>

                <Link
                  to="/admin/assistente"
                  className={`${classes.navItem} ${isActive('/admin/assistente') ? classes.navItemActive : ''}`}
                >
                  <span>Assistente</span>
                  <IconChevronRight size={16} />
                </Link>

                <Link
                  to="/admin/categorias"
                  className={`${classes.navItem} ${isActive('/admin/categorias') ? classes.navItemActive : ''}`}
                >
                  <span>Categorias</span>
                  <IconChevronRight size={16} />
                </Link>

                <Link
                  to="/admin/perguntas"
                  className={`${classes.navItem} ${isActive('/admin/perguntas') ? classes.navItemActive : ''}`}
                >
                  <span>Perguntas</span>
                  <IconChevronRight size={16} />
                </Link>

                <Link
                  to="/admin/feedbacks"
                  className={`${classes.navItem} ${isActive('/admin/feedbacks') ? classes.navItemActive : ''}`}
                >
                  <span>Feedbacks</span>
                  <IconChevronRight size={16} />
                </Link>

                {isMaster && (
                  <Link
                    to="/admin/usuarios"
                    className={`${classes.navItem} ${isActive('/admin/usuarios') ? classes.navItemActive : ''}`}
                  >
                    <span>Usuarios</span>
                    <IconChevronRight size={16} />
                  </Link>
                )}

                <Link
                  to="/admin/alertas"
                  className={`${classes.navItem} ${isActive('/admin/alertas') ? classes.navItemActive : ''}`}
                >
                  <span>Alertas</span>
                  <IconChevronRight size={16} />
                </Link>

              </nav>
            </aside>

            <div className={classes.topbar}>
              <ActionIcon variant="subtle" className={classes.burger} onClick={menu.open} aria-label="Abrir menu">
                <IconMenu2 />
              </ActionIcon>

              <HeaderAdmin
                title={title}
                initials={initials}
                onLogout={handleLogout}
                onProfile={profile.open}
              />
            </div>

            <section className={classes.content}>
              <div className={classes.contentInner}>
                <Outlet />
              </div>
            </section>
          </div>

          <Drawer
            opened={menuOpened}
            onClose={menu.close}
            size="100%"
            padding="md"
            title={<Text fw={700}>Menu</Text>}
            className={classes.drawer}
            overlayProps={{ opacity: 0.35, blur: 2 }}
          >
            <Stack gap="sm" mt="sm">
              <Button variant="light" component={Link} to="/admin" onClick={menu.close}>
                Visao geral
              </Button>
              <Button variant="light" component={Link} to="/admin/assistente" onClick={menu.close}>
                Assistente
              </Button>
              <Button variant="light" component={Link} to="/admin/categorias" onClick={menu.close}>
                Categorias
              </Button>
              <Button variant="light" component={Link} to="/admin/perguntas" onClick={menu.close}>
                Perguntas
              </Button>
              <Button variant="light" component={Link} to="/admin/feedbacks" onClick={menu.close}>
                Feedbacks
              </Button>
              {isMaster && (
                <Button variant="light" component={Link} to="/admin/usuarios" onClick={menu.close}>
                  Usuarios
                </Button>
              )}
              <Button variant="light" component={Link} to="/admin/alertas" onClick={menu.close}>
                Alertas
              </Button>
            </Stack>
          </Drawer>
        </main>

        <ProfileModal opened={profileOpened} onClose={profile.close} profile={profileData} />
      </div>
    </AdminTitleContext.Provider>
  );
}
