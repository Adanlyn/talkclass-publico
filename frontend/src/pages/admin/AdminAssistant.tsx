import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Flex,
  Group,
  Paper,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { IconRobot, IconSend, IconSparkles, IconUser } from '@tabler/icons-react';
import { useAdminTitle } from '../../components/Layout/AdminTitleContext';
import classes from './Admin.module.css';
import DashboardFilters from '../../components/DashboardFilters';
import { DashboardFiltersProvider, useDashboardFilters } from '../../state/dashboardFilters';
import { askAssistant } from '../../services/assistant';
import { notifyError } from '../../services/notifications';

type Message = {
  role: 'user' | 'bot';
  text: string;
  highlights?: string[];
  suggestions?: string[];
};

function FiltersHint() {
  const { value: F } = useDashboardFilters();
  const fmt = (v?: string | null) => (v ? v : '—');

  return (
    <Group gap="xs" wrap="wrap">
      <Badge variant="light">Período: {fmt(F.from)} → {fmt(F.to)}</Badge>
      {F.categoryId && <Badge variant="light">Categoria filtrada</Badge>}
      {F.curso && <Badge variant="light">Curso: {F.curso}</Badge>}
      {F.turno && <Badge variant="light">Turno: {F.turno}</Badge>}
      {F.unidade && <Badge variant="light">Unidade: {F.unidade}</Badge>}
      {F.identified && <Badge color="teal" variant="light">Somente identificados</Badge>}
    </Group>
  );
}

function AssistantInner() {
  useAdminTitle('Assistente IA');
  const { value: F } = useDashboardFilters();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'bot',
      text:
        'Olá! Sou a Ady, assistente gratuita do TalkClass 😊\n\nPosso resumir KPIs, séries e heatmaps usando apenas os dados filtrados. Pergunte algo como "resuma os últimos 30 dias" ou "quais categorias têm mais negativas?"',
    },
  ]);

  const filtersForPayload = useMemo(
    () => ({
      from: F.from,
      to: F.to,
      categoryId: F.categoryId,
      curso: F.curso,
      turno: F.turno,
      unidade: F.unidade,
      identified: F.identified,
    }),
    [F.from, F.to, F.categoryId, F.curso, F.turno, F.unidade, F.identified]
  );
  const lastFiltersRef = useRef<string>('');

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await askAssistant({ question: text, ...filtersForPayload });
      setMessages((prev) => [
        ...prev,
        {
          role: 'bot',
          text: res.answer,
          highlights: res.highlights ?? [],
          suggestions: res.suggestions ?? [],
        },
      ]);
    } catch (err: any) {
      console.error(err);
      notifyError('Falha ao perguntar para o assistente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const key = JSON.stringify(filtersForPayload);
    if (key === lastFiltersRef.current) return;
    lastFiltersRef.current = key;
    // Quando os filtros mudam, avisa no chat
    setMessages((prev) => [
      ...prev,
      {
        role: 'bot',
        text: 'Filtros alterados. As próximas respostas considerarão o novo recorte.',
      },
    ]);
  }, [filtersForPayload.from, filtersForPayload.to, filtersForPayload.categoryId, filtersForPayload.curso, filtersForPayload.turno, filtersForPayload.unidade, filtersForPayload.identified]);

  return (
    <>
      <Paper p="md" radius="md" className={classes.panel} mb="md">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={4}>Insights via IA</Title>
            <Text c="dimmed" fz="sm">
              Chatbot que resume os gráficos dados conforme os filtros atuais.
            </Text>
          </div>
          <Group gap="xs">
            <IconSparkles size={18} color="#f97316" />
            <Text fz="sm" c="orange.6">
             Utiliza somente dados da sua base.

            </Text>
          </Group>
        </Group>
        <Box mt="xs">
          <FiltersHint />
        </Box>
      </Paper>

      <div className={classes.assistantLayout}>
        <Paper p="md" radius="md" className={classes.panel}>
          <Stack gap="sm">
            <div className={classes.assistantChatBox} aria-label="Mensagens do assistente">
              {messages.map((m, idx) => (
                <div key={idx} className={classes.msgRow}>
                  <div className={classes.msgIcon} data-role={m.role}>
                    {m.role === 'bot' ? <IconRobot size={16} /> : <IconUser size={16} />}
                  </div>
                  <div className={m.role === 'bot' ? classes.botBubble : classes.userBubble}>
                    <Text fz="sm" style={{ whiteSpace: 'pre-wrap' }}>{m.text}</Text>
                    {m.highlights && m.highlights.length > 0 && (
                      <Stack gap={4} mt={6}>
                        {m.highlights.map((h, i) => (
                          <Text key={i} fz="xs" c="dimmed">
                            • {h}
                          </Text>
                        ))}
                      </Stack>
                    )}
                    {m.suggestions && m.suggestions.length > 0 && (
                      <Stack gap={4} mt={8}>
                        <Text fz="xs" fw={600}>
                          Sugestões:
                        </Text>
                        {m.suggestions.map((s, i) => (
                          <Text key={i} fz="xs" c="dimmed">
                            • {s}
                          </Text>
                        ))}
                      </Stack>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <Flex
              gap="sm"
              direction={{ base: 'column', sm: 'row' }}
              align="stretch"
              className={classes.assistantActions}
            >
              <Textarea
                placeholder="Pergunte algo sobre os gráficos ou período..."
                value={input}
                onChange={(e) => setInput(e.currentTarget.value)}
                autosize
                minRows={2}
                className={classes.assistantTextarea}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <Button
                variant="gradient"
                gradient={{ from: 'orange', to: 'yellow' }}
                rightSection={<IconSend size={16} />}
                loading={loading}
                onClick={send}
                className={classes.assistantSend}
                fullWidth
              >
                Perguntar
              </Button>
            </Flex>
          </Stack>
        </Paper>

        <Paper p="md" radius="md" className={classes.panel}>
          <Title order={5} mb="xs">
            Dicas rápidas
          </Title>
          <Stack gap="xs" fz="sm">
            <Text>• Pergunte por categorias com mais negativos ou evolução do sentimento.</Text>
            <Text>• Explore palavras mais associadas a feedback negativo.</Text>
            <Text>• Peça sugestões de ação (infraestrutura, suporte, docência).</Text>
            <Text>• Alterar filtros muda o contexto do assistente imediatamente.</Text>
          </Stack>
        </Paper>
      </div>
    </>
  );
}

export default function AdminAssistant() {
  return (
    <DashboardFiltersProvider>
      <DashboardFilters />
      <AssistantInner />
    </DashboardFiltersProvider>
  );
}
