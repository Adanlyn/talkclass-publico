// src/pages/Feedback.tsx
import {
  Box,
  Button,
  Container,
  Group,
  Paper,
  Radio,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Header from '../components/Header';
import classes from './Feedback.module.css';

import {
  getCategorias,
  getPerguntasDaCategoria,
  createFeedback,
  type Categoria,
  type Pergunta,
  type CreateFeedbackDto,
  TipoAvaliacao,
} from '../services/feedback.service';

/** Mantém a MESMA peça visual da sua versão (escala 1..5) */
function Likert({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <Stack gap={8} className={classes.block}>
      <Title order={4} ta="center" c="#2b231f">
        {label}
      </Title>
      <SegmentedControl
        fullWidth
        radius="md"
        size="md"
        classNames={{
          root: classes.likertRoot,
          indicator: classes.likertIndicator,
          label: classes.likertLabel,
        }}
        value={value}
        onChange={onChange}
        data={[
          { label: '1', value: '1' },
          { label: '2', value: '2' },
          { label: '3', value: '3' },
          { label: '4', value: '4' },
          { label: '5', value: '5' },
        ]}
      />
    </Stack>
  );
}

type DynamicFormValues = {
  cursoTurma?: string;
  [perguntaId: string]: any;
};

export default function Feedback() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaAtivaId, setCategoriaAtivaId] = useState<string | null>(null);
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [carregandoPerguntas, setCarregandoPerguntas] = useState(false);

  // Rolagem horizontal das categorias
  const tabsRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = tabsRef.current;
    if (!el) return;
    const { scrollLeft, clientWidth, scrollWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
  }, []);

  const scrollTabs = (dir: 'left' | 'right') => {
    const el = tabsRef.current;
    if (!el) return;
    const delta = Math.round(el.clientWidth * 0.8);
    el.scrollBy({ left: dir === 'left' ? -delta : delta, behavior: 'smooth' });
  };

  useEffect(() => {
    updateArrows();
  }, [categorias, updateArrows]);

  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const onScroll = () => updateArrows();
    const onResize = () => updateArrows();
    el.addEventListener('scroll', onScroll);
    window.addEventListener('resize', onResize);
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, [updateArrows]);

  const form = useForm<DynamicFormValues>({ initialValues: { cursoTurma: '' } });

  // 1) Carrega categorias do banco (abas dinâmicas)
  useEffect(() => {
    (async () => {
      const cats = await getCategorias();
      setCategorias(cats);
      if (cats.length > 0) setCategoriaAtivaId(cats[0].id);
    })();
  }, []);

  // 2) Carrega perguntas da categoria ativa
  useEffect(() => {
  if (!categoriaAtivaId) return;
  setCarregandoPerguntas(true);

  getPerguntasDaCategoria(categoriaAtivaId)
    .then((qs) => {
      const arr = Array.isArray(qs) ? qs : [];
      setPerguntas(arr);

      // valores padrão no form
      const patch: Record<string, any> = {};
      for (const p of arr) {
        if (form.values[p.id] === undefined) {
          patch[p.id] = p.tipo === TipoAvaliacao.Nota ? '3' : '';
        }
      }
      if (Object.keys(patch).length) {
        form.setValues({ ...form.values, ...patch });
      }
    })
    .catch((e) => {
      console.error('Erro ao carregar perguntas:', e);
      setPerguntas([]); 
    })
    .finally(() => setCarregandoPerguntas(false));
}, [categoriaAtivaId]);


  const categoriaAtiva = useMemo(
    () => categorias.find((c) => c.id === categoriaAtivaId) ?? null,
    [categorias, categoriaAtivaId],
  );

  // 3) Envia
  const handleSubmit = async () => {
    if (!categoriaAtivaId) return;

    const dto: CreateFeedbackDto = {
      categoriaId: categoriaAtivaId,
      cursoOuTurma: form.values.cursoTurma?.trim() || undefined,
      nomeIdentificado: form.values.nomeIdentificado?.trim() || undefined,
      contatoIdentificado: form.values.contatoIdentificado?.trim() || undefined,
      respostas: perguntas.map((p) => {
        const tipo =
          p.tipo === TipoAvaliacao.Nota ||
          p.tipo === TipoAvaliacao.SimNao ||
          p.tipo === TipoAvaliacao.Multipla ||
          p.tipo === TipoAvaliacao.Texto
            ? p.tipo
            : TipoAvaliacao.Texto;
        const raw = form.values[p.id];
        return {
          perguntaId: p.id,
          tipo,
          valorNota: tipo === TipoAvaliacao.Nota ? Number(raw || 0) : null,
          valorBool:
            tipo === TipoAvaliacao.SimNao
              ? raw === 'sim'
                ? true
                : raw === 'nao'
                  ? false
                  : null
              : null,
          valorOpcao:
            tipo === TipoAvaliacao.Multipla ? (String(raw ?? '') || null) : null,
          valorTexto: tipo === TipoAvaliacao.Texto ? (String(raw ?? '').trim() || null) : null,
        };
      }),
    };

    await createFeedback(dto);
    alert('Feedback enviado!');

    // reseta respostas (mantém categoria)
    const reset: Record<string, any> = { cursoTurma: '' };
    for (const p of perguntas) reset[p.id] = p.tipo === TipoAvaliacao.Nota ? '3' : '';
    form.setValues(reset);
  };

  return (
    <div className={classes.page}>
      <Header />

      <main className={classes.main}>
        {/* HERO — como no seu layout original */}
        <section className={classes.hero}>
          <Container size="lg">
            <div className={classes.heroInner}>
              <Title className={classes.heroTitle} c="white" fw={800} lh={1.1}>
                Sua voz{' '}
                <Text span c="orange.5" fw={900} inherit>
                  transforma
                </Text>{' '}
                a universidade
              </Title>
              <Text c="#d6c9c0" fz="sm" className={classes.subtitle}>
                Participe do nosso sistema de feedback anônimo e ajude a melhorar a
                experiência acadêmica.
              </Text>
            </div>
          </Container>
        </section>

        {/* ABAS — visual intacto (agora vindas do banco) */}
        <div className={classes.tabsBar}>
          <Container size="lg">
            <div className={classes.tabsRow}>
              {/* seta ESQ */}
              {categorias.length > 0 && (
                <button
                  type="button"
                  aria-label="Anterior"
                  className={classes.arrowBtn}
                  onClick={() => scrollTabs('left')}
                  disabled={!canScrollLeft}
                  title="Anterior"
                >
                  <span className={classes.arrowIcon}>‹</span>
                </button>
              )}

              {/* faixa: 1 linha, ocupa o centro */}
              <div className={classes.tabsScroll} ref={tabsRef}>
                {categorias.map((cat) => {
                  return (
                    <button
                      key={cat.id}
                      className={`${classes.tab} ${categoriaAtivaId === cat.id ? classes.tabActive : ''}`}
                      onClick={() => setCategoriaAtivaId(cat.id)}
                      type="button"
                      title={cat.nome}
                    >
                      <span className={classes.tabText}>{cat.nome}</span>
                    </button>
                  );
                })}
              </div>

              {/* seta DIR */}
              {categorias.length > 0 && (
                <button
                  type="button"
                  aria-label="Próximo"
                  className={classes.arrowBtn}
                  onClick={() => scrollTabs('right')}
                  disabled={!canScrollRight}
                  title="Próximo"
                >
                  <span className={classes.arrowIcon}>›</span>
                </button>
              )}
            </div>

          </Container>
        </div>


        {/* FORM — mesma estrutura visual; perguntas dinâmicas */}
        <section className={classes.formSection}>
          <Container size="lg">
            <form onSubmit={form.onSubmit(() => handleSubmit())} className={classes.formWrap}>
              <Paper p="lg" radius="md" className={classes.formCard}>
                <Stack gap={28}>
                  {/* Campo Curso/Turma (mantido) */}
                  <Box>
                    <Title order={4} ta="center" mb={10} c="#2b231f">
                      Curso/Turma (opcional)
                    </Title>
                    <Textarea
                      placeholder="Ex.: ADS - TADS 5º período"
                      minRows={1}
                      autosize
                      classNames={{ input: classes.textarea }}
                      {...form.getInputProps('cursoTurma')}
                    />
                  </Box>

                  {/* Campo Nome (identificação opcional) */}
                  <Box>
                    <Title order={4} ta="center" mb={10} c="#2b231f">
                      Nome (opcional)
                    </Title>
                    <Textarea
                      placeholder="Digite seu nome (caso queira se identificar)"
                      minRows={1}
                      autosize
                      classNames={{ input: classes.textarea }}
                      {...form.getInputProps('nomeIdentificado')}
                    />
                  </Box>

                  <Box>
                    <Title order={4} ta="center" mb={10} c="#2b231f">
                      Contato (opcional)
                    </Title>
                    <Textarea
                      placeholder="E-mail ou telefone (caso queira retorno)"
                      minRows={1}
                      autosize
                      classNames={{ input: classes.textarea }}
                      {...form.getInputProps('contatoIdentificado')}
                    />
                  </Box>


                  {!categoriaAtiva && (
                    <Text ta="center" c="dimmed">
                      Selecione uma categoria para começar.
                    </Text>
                  )}

                  {categoriaAtiva &&
                    (carregandoPerguntas ? (
                      <Text ta="center" c="dimmed">
                        Carregando perguntas…
                      </Text>
                    ) : perguntas.length === 0 ? (
                      <Text ta="center" c="dimmed">
                        Nenhuma pergunta cadastrada.
                      </Text>
                    ) : (
                      perguntas.map((p) => {
                        // NOTA 1..5 (Likert)
                        if (p.tipo === TipoAvaliacao.Nota) {
                          return (
                            <Likert
                              key={p.id}
                              label={p.enunciado}
                              value={String(form.values[p.id] ?? '3')}
                              onChange={(v) => form.setFieldValue(p.id, v)}
                            />
                          );
                        }

                        // SIM / NÃO
                        if (p.tipo === TipoAvaliacao.SimNao) {
                          return (
                            <Box key={p.id}>
                              <Title order={4} ta="center" mb={10} c="#2b231f">
                                {p.enunciado}
                              </Title>
                              <Radio.Group
                                value={form.values[p.id] ?? ''}
                                onChange={(v) => form.setFieldValue(p.id, v)}
                                className={classes.radioGroup}
                              >
                                <div className={classes.radioScroll}>
                                  <div className={classes.radioRow}>
                                    <Radio value="sim" label="Sim" />
                                    <Radio value="nao" label="Não" />
                                  </div>
                                </div>
                              </Radio.Group>
                            </Box>
                          );
                        }

                        // MÚLTIPLA (se existir no seu banco)
                        if (p.tipo === TipoAvaliacao.Multipla && p.opcoes?.length) {
                          return (
                            <Box key={p.id}>
                              <Title order={4} ta="center" mb={10} c="#2b231f">
                                {p.enunciado}
                              </Title>
                              <Radio.Group
                                value={form.values[p.id] ?? ''}
                                onChange={(v) => form.setFieldValue(p.id, v)}
                                className={classes.radioGroup}
                              >
                                <div className={classes.radioScroll}>
                                  <div className={classes.radioRow}>
                                    {p.opcoes.map((op) => (
                                      <Radio key={op.id} value={op.texto} label={op.texto} />
                                    ))}
                                  </div>
                                </div>
                              </Radio.Group>
                            </Box>
                          );
                        }

                        // TEXTO ABERTO
                        return (
                          <Box key={p.id}>
                            <Title order={4} ta="center" mb={10} c="#2b231f">
                              {p.enunciado}
                            </Title>
                            <Textarea
                              placeholder="Se quiser, descreva detalhes que possam ajudar a melhorar."
                              minRows={3}
                              autosize
                              classNames={{ input: classes.textarea }}
                              value={form.values[p.id] ?? ''}
                              onChange={(e) => form.setFieldValue(p.id, e.currentTarget.value)}
                            />
                          </Box>
                        );
                      })
                    ))}

                  <Group justify="center" mt={8}>
                    <Button type="submit" color="orange" size="lg" radius="md" px="xl">
                      Enviar
                    </Button>
                  </Group>
                </Stack>
              </Paper>
            </form>
          </Container>
        </section>
      </main>

      <footer className={classes.footer}>
        <Container size="lg">
          <Text size="sm">©{new Date().getFullYear()} TalkClass. Todos os direitos reservados.</Text>
        </Container>
      </footer>
    </div>
  );
}
