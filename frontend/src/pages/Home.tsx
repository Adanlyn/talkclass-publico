import { Button, Container, Group, Paper, Text, Title, Box, Stack } from '@mantine/core';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import classes from './Home.module.css';
import {
  IconLock, IconBolt, IconChartHistogram,
  IconDeviceMobile, IconChecklist, IconSend
} from '@tabler/icons-react';
import type { ElementType } from 'react';

type FeatureItem = { icon: ElementType; title: string; desc: string };

const features: FeatureItem[] = [
  { icon: IconLock, title: 'Anonimato Garantido', desc: 'Nenhuma informação pessoal é coletada ou divulgada.' },
  { icon: IconBolt, title: 'Simples e Intuitivo', desc: 'Sua opinião importa e você pode enviá-la em poucos minutos e quando quiser.' },
  { icon: IconChartHistogram, title: 'Melhoria Contínua', desc: 'Seus feedbacks ajudam a universidade construir um ambiente melhor para todos.' },
];

const HowItem = ({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) => (
  <Stack align="center" gap={8} className={classes.howItem}>
    <Box className={classes.howIcon}>
      <Icon size={40} color="var(--mantine-color-orange-6)" />
    </Box>
    <Title order={4} c="#2F2A23">{title}</Title>
    <Text size="sm" c="#000" ta="center" className={classes.howDesc}>
      {desc}
    </Text>
  </Stack>
);

export default function Home() {
  return (
    <>
      <Header />

      {/* HERO */}
      <section className={classes.hero}>
        <Container size="lg">
          <div className={classes.heroInner}>
            <div className={classes.heroHead}>
              <Title className={classes.heroTitle} c="white" fw={800} lh={1.1}>
                Sua voz <Text span c="orange.5" fw={900} inherit>transforma</Text> a universidade
              </Title>

              <Text c="#d6c9c0" fz="lg" className={classes.subtitle}>
                Participe do nosso sistema de feedback anônimo e ajude a melhorar a experiência acadêmica.
              </Text>

              <Group justify="center" className={classes.cta}>
                <Link to="/feedback" style={{ textDecoration: 'none' }}>
                  <Button color="orange" size="lg" radius="md" fw={700} px="xl" h={56}>
                    Feedback
                  </Button>
                </Link>
              </Group>
            </div>

            {/* FEATURES */}
            <div className={classes.featuresRow}>
              {features.map(({ icon: Icon, title, desc }) => (
                <Paper key={title} className={classes.featureCard}>
                  <Box className={classes.featureIcon}>
                    <Icon size={28} color="var(--mantine-color-orange-6)" />
                  </Box>
                  <div>
                    <Title order={4} c="#2F2A23" fw={800} className={classes.featureTitle}>{title}</Title>
                    <Text size="sm" c="#000000" className={classes.featureDesc}>{desc}</Text>
                  </div>
                </Paper>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* COMO FUNCIONA */}
      <section className={classes.howSection}>
        <Container size="lg">
          <Title order={3} ta="center" mb={24} c="cocoa.7">Como funciona</Title>
          <div className={classes.howGrid}>
            <HowItem icon={IconDeviceMobile} title="Acesse" desc="Abra a página de Feedback no seu dispositivo" />
            <HowItem icon={IconChecklist} title="Responda" desc="Compartilhe sua experiência de forma segura e reservada." />
            <HowItem icon={IconSend} title="Envie" desc="Pronto! Seu feedback é registrado e enviado para a equipe responsável." />
          </div>
        </Container>
      </section>

      <footer className={classes.footer}>
        <Container size="lg">
          <Text size="sm">©2025 TalkClass. Todos os direitos reservados.</Text>
        </Container>
      </footer>
    </>
  );
}
