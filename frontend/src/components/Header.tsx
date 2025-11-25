import {
  Container, Group, Button, Text, Burger, Drawer, Stack, Divider
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Link } from 'react-router-dom';
import classes from './Header.module.css';

const nav = [
  { to: '/', label: 'Página Inicial' },
  { to: '/feedback', label: 'Feedback' },
  { to: '/sobre', label: 'Sobre' },
  { to: '/servicos', label: 'Serviços' },
];

export default function Header() {
  const [opened, { toggle, close }] = useDisclosure(false);

  return (
    <header className={classes.header}>
      <Container size="90rem" px="xs" py="md">
        <Group justify="space-between" align="center" wrap="nowrap">
          <Link to="/" style={{ textDecoration: 'none' }}>
            <Text fw={900} fz="clamp(22px, 2.2vw, 30px)" c="white" lh={1}>
              TalkClass
            </Text>
          </Link>

          {/* Desktop */}
          <Group className={classes.nav} visibleFrom="lg">
            {nav.map(i => (
              <Link key={i.to} to={i.to} className={classes.navLink}>
                {i.label}
              </Link>
            ))}
            <Link to="/login" style={{ textDecoration: 'none' }}>
              <Button color="orange">Login</Button>
            </Link>

          </Group>

          {/* Burger */}
          <Burger hiddenFrom="lg" opened={opened} onClick={toggle} aria-label="Abrir menu" color="white" />
        </Group>
      </Container>

      {/* Drawer full-screen */}
      <Drawer
        opened={opened}
        onClose={close}
        withCloseButton
        title={<Text c="white" fw={700}>Menu</Text>}
        hiddenFrom="lg"
        size="100%"
        padding="md"
        overlayProps={{ opacity: 0.35, blur: 2 }}
        styles={{
          // ✅ Linha só no cabeçalho do Drawer (menu hambúrguer)
          header: {
            background: 'var(--mantine-color-cocoa-9)',
            borderBottom: 'none',   // força sem linha
            boxShadow: 'none',      // remove qualquer sombra
          },
          title: { color: 'white' },
          close: { color: 'white' },
          content: {
            background: 'var(--mantine-color-cocoa-9)',
            height: '100dvh',
            paddingTop: 'calc(env(safe-area-inset-top) + 8px)',
          },
          body: { background: 'var(--mantine-color-cocoa-9)' },
        }}
      >
        <Stack gap="lg" align="stretch" mt="sm">
          {nav.map(i => (
            <Link key={i.to} to={i.to} className={classes.drawerLink} onClick={close}>
              {i.label}
            </Link>
          ))}
          <Divider my="sm" color="rgba(255,255,255,.12)" />
          <Button component={Link} to="/login" color="orange" size="lg" onClick={close}>
            Login
          </Button>
        </Stack>
      </Drawer>
    </header>
  );
}
