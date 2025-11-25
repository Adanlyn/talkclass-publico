import {
  Badge, Box, Button, Container, Grid, Group, List, Paper, SimpleGrid, Stack, Text, ThemeIcon, Title,
} from '@mantine/core';
import { IconCheck, IconShieldLock, IconChartBar, IconStars } from '@tabler/icons-react';
import Header from '../components/Header';
import classes from './Sobre.module.css';

export default function Sobre() {
  return (
    <div className={classes.page}>
      <Header />

      <main className={classes.main}>
        {/* HERO */}
        <section className={classes.hero}>
          <Container size="lg">
            <Stack gap="sm" className={classes.heroInner}>
              <Badge size="lg" radius="sm" variant="filled" color="orange" className={classes.badge}>
                Projeto acadêmico com impacto real
              </Badge>

              <Title className={classes.title} c="white">
                Transparência que melhora a experiência universitária
              </Title>

              <Text c="#d6c9c0" className={classes.subtitle}>
                O TalkClass coleta feedback anônimo sobre <b>infraestrutura</b>, <b>atendimento</b>, <b>aulas</b> e outros pilares,
                gerando painéis de acompanhamento para decisões rápidas e assertivas.
              </Text>

              <Group justify="center" mt="xs">
                <Button component="a" href="/feedback" size="md" radius="md" color="orange">
                  Enviar feedback
                </Button>
                <Button variant="white" color="dark" size="md" radius="md" component="a" href="#como-funciona">
                  Como funciona
                </Button>
              </Group>
            </Stack>
          </Container>
        </section>

        {/* VALOR / DIFERENCIAIS */}
        <section className={classes.section}>
          <Container size="lg">
            <Title order={2} ta="center" className={classes.sectionTitle}>Por que o TalkClass?</Title>

            <SimpleGrid
  cols={{ base: 1, sm: 2, md: 3 }}
  spacing="lg"
  mt="lg"
  className={classes.featuresGrid}>
              <Paper p="lg" radius="md" className={classes.card}>
                <ThemeIcon size={40} radius="md" className={classes.icon}><IconShieldLock /></ThemeIcon>
                <Title order={4}>Anonimato garantido</Title>
                <Text c="dimmed" mt={6}>Coleta sem identificação pessoal. Opinou sem medo, dados protegidos.</Text>
              </Paper>

              <Paper p="lg" radius="md" className={classes.card}>
                <ThemeIcon size={40} radius="md" className={classes.icon}><IconChartBar /></ThemeIcon>
                <Title order={4}>Métricas acionáveis</Title>
                <Text c="dimmed" mt={6}>Painéis com médias e tendências por categorias</Text>
              </Paper>

              <Paper p="lg" radius="md" className={classes.card}>
                <ThemeIcon size={40} radius="md" className={classes.icon}><IconStars /></ThemeIcon>
                <Title order={4}>Foco em melhoria contínua</Title>
                <Text c="dimmed" mt={6}>Alertas e priorização para resolver o que mais impacta os alunos.</Text>
              </Paper>
            </SimpleGrid>
          </Container>
        </section>

        {/* COMO FUNCIONA */}
        <section id="como-funciona" className={classes.sectionAlt}>
          <Container size="lg">
            <Grid gutter="xl" align="center">
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Title order={2} className={classes.sectionTitle}>Como funciona</Title>
                <List spacing="md" size="sm" mt="md"
                  icon={<ThemeIcon radius="md" className={classes.bullet}><IconCheck size={16} /></ThemeIcon>}>
                  <List.Item><b>Coleta</b> — formulário simples e anônimo.</List.Item>
                  <List.Item><b>Processamento</b> — normalização, validações e prevenção de duplicatas.</List.Item>
                  <List.Item><b>Dashboards</b> — médias, filtros dinâmicos e comparativos ao longo do tempo.</List.Item>
                  <List.Item><b>Alertas</b> — notificações para áreas com quedas significativas.</List.Item>
                </List>

                <Group mt="lg">
                  <Button component="a" href="/feedback" color="orange" radius="md">Dar meu feedback</Button>
                  <Button variant="light" component="a" href="#principios" radius="md">Nossos princípios</Button>
                </Group>
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 6 }}>
                <Paper p="lg" radius="md" className={classes.preview}>
                  <Text fw={700} mb="xs">Tecnologias</Text>
                  <Text c="dimmed" fz="sm">
                   Front-end em React + TypeScript com Mantine UI; back-end em ASP.NET Core (.NET 8) com API REST e serviço de IA em Python/FastAPI integrado; autenticação de administradores com JWT; persistência em PostgreSQL; rotas para cadastro e gestão de categorias, perguntas e feedbacks; dashboards com gráficos em Chart.js e análises automáticas de sentimento e palavras-chave.
                  </Text>
                  <Box mt="md">
                    <Badge mr="xs" variant="light">React</Badge>
                    <Badge mr="xs" variant="light">IA</Badge>
                    <Badge mr="xs" variant="light">Chart.js</Badge>
                    <Badge mr="xs" variant="light">.NET</Badge>
                    <Badge mr="xs" variant="light">PostgreSQL</Badge>
                  </Box>
                </Paper>
              </Grid.Col>
            </Grid>
          </Container>
        </section>

      
      </main>

      {/* FOOTER fora do conteúdo */}
      <footer className={classes.footer}>
        <Container size="lg">
          <Text size="sm">©{new Date().getFullYear()} TalkClass. Todos os direitos reservados.</Text>
        </Container>
      </footer>
    </div>
  );
}
