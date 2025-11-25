import {
  Badge,
  Button,
  Container,
  Grid,
  Group,
  List,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconListCheck,
  IconChartHistogram,
  IconReportAnalytics,
  IconRocket,
  IconSettingsAutomation,
  IconShieldLock,
  IconMail,
} from '@tabler/icons-react';
import Header from '../components/Header';
import classes from './Servicos.module.css';

export default function Servicos() {
  return (
    <div className={classes.page}>
      <Header />

      <main className={classes.main}>
        {/* HERO */}
        <section className={classes.hero}>
          <Container size="lg">
            <Stack gap="sm" className={classes.heroInner}>
              <Badge size="lg" radius="sm" variant="filled" color="orange" className={classes.badge}>
                Soluções ponta a ponta
              </Badge>

              <Title className={classes.title} c="white">
                Serviços para coletar, analisar e agir sobre feedbacks acadêmicos
              </Title>

              <Text c="#d6c9c0" className={classes.subtitle}>
                Do formulário ao dashboard — entregamos estrutura, métricas e rotinas para melhoria contínua.
              </Text>
            </Stack>
          </Container>
        </section>

        {/* BLOCOS DE SERVIÇO */}
        <section id="servicos" className={classes.section}>
          <Container size="lg">
            <Title order={2} ta="center" className={classes.sectionTitle}>
              O que entregamos
            </Title>

            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg" mt="lg" className={classes.cardsGrid}>
              <Paper p="lg" radius="md" className={classes.card}>
                <ThemeIcon size={40} radius="md" className={classes.icon}>
                  <IconListCheck />
                </ThemeIcon>
                <Title order={4}>Formulários customizados</Title>
                <Text c="dimmed" mt={6}>
                  Escalas, categorias e perguntas sob medida para seu campus/curso.
                </Text>
              </Paper>

              <Paper p="lg" radius="md" className={classes.card}>
                <ThemeIcon size={40} radius="md" className={classes.icon}>
                  <IconShieldLock />
                </ThemeIcon>
                <Title order={4}>Anonimato & proteção</Title>
                <Text c="dimmed" mt={6}>
                  Coleta anônima, validações e consolidação para evitar identificação.
                </Text>
              </Paper>

              <Paper p="lg" radius="md" className={classes.card}>
                <ThemeIcon size={40} radius="md" className={classes.icon}>
                  <IconChartHistogram />
                </ThemeIcon>
                <Title order={4}>Dashboards e KPIs</Title>
                <Text c="dimmed" mt={6}>
                  Indicadores por disciplina, professor, período e ambiente.
                </Text>
              </Paper>

              <Paper p="lg" radius="md" className={classes.card}>
                <ThemeIcon size={40} radius="md" className={classes.icon}>
                  <IconSettingsAutomation />
                </ThemeIcon>
                <Title order={4}>Alertas & priorização</Title>
                <Text c="dimmed" mt={6}>
                  Regras de prioridade e acompanhamento do plano de ação.
                </Text>
              </Paper>

              <Paper p="lg" radius="md" className={classes.card}>
                <ThemeIcon size={40} radius="md" className={classes.icon}>
                  <IconReportAnalytics />
                </ThemeIcon>
                <Title order={4}>Relatórios executivos</Title>
                <Text c="dimmed" mt={6}>
                  Sumários mensais com insights e recomendações práticas.
                </Text>
              </Paper>

              <Paper p="lg" radius="md" className={classes.card}>
                <ThemeIcon size={40} radius="md" className={classes.icon}>
                  <IconRocket />
                </ThemeIcon>
                <Title order={4}>Onboarding guiado</Title>
                <Text c="dimmed" mt={6}>
                  Implantação rápida, treinamento da equipe e materiais de apoio.
                </Text>
              </Paper>
            </SimpleGrid>
          </Container>
        </section>

        {/* COMO TRABALHAMOS */}
        <section className={classes.sectionAlt}>
          <Container size="lg">
            <Grid gutter="xl" align="center">
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Title order={2} className={classes.sectionTitle}>Como trabalhamos</Title>
                <List spacing="md" size="sm" mt="md"
                  icon={<ThemeIcon radius="md" className={classes.bullet}><IconRocket size={16} /></ThemeIcon>}>
                  <List.Item><b>Kickoff</b> — diagnóstico rápido e definição de metas.</List.Item>
                  <List.Item><b>Configuração</b> — formulários, categorias e integrações.</List.Item>
                  <List.Item><b>Coleta</b> — campanha de adesão e acompanhamento.</List.Item>
                  <List.Item><b>Visualização</b> — dashboards, alertas e relatórios.</List.Item>
                  <List.Item><b>Ação</b> — priorização, responsáveis e revisão periódica.</List.Item>
                </List>
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 6 }}>
                <Paper p="lg" radius="md" className={classes.preview}>
                  <Text fw={700} mb="xs">Resultados que buscamos</Text>
                  <List spacing="xs" size="sm" mt="xs">
                    <List.Item>↑ Satisfação geral e NPS acadêmico</List.Item>
                    <List.Item>↓ Tempo para resposta às ocorrências</List.Item>
                    <List.Item>↑ Engajamento dos estudantes e docentes</List.Item>
                    <List.Item>Transparência com indicadores públicos</List.Item>
                  </List>
                </Paper>
              </Grid.Col>
            </Grid>
          </Container>
        </section>

        {/* CTA CONTATO */}
        <section className={classes.cta}>
          <Container size="lg" className={classes.ctaInner}>
            <Group gap="sm" wrap="nowrap" align="center">
              <ThemeIcon radius="md" size={40} className={classes.iconCta}><IconMail /></ThemeIcon>
              <div>
                <Title order={3} c="white" fw={900} lh={1}>Vamos conversar?</Title>
                <Text c="#eddcd2">contato@talkclass.app • resposta em até 1 dia útil</Text>
              </div>
            </Group>
            <Button component="a" href="mailto:contato@talkclass.app" size="md" radius="md" color="orange">
              Enviar mensagem
            </Button>
          </Container>
        </section>
      </main>

      {/* FOOTER */}
      <footer className={classes.footer}>
        <Container size="lg">
          <Text size="sm">©{new Date().getFullYear()} TalkClass. Todos os direitos reservados.</Text>
        </Container>
      </footer>
    </div>
  );
}
