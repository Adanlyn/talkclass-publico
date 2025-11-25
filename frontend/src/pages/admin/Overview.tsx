import {
  Badge,
  Box,
  Button,
  Grid,
  Group,
  Paper,
  SimpleGrid,
  Table,
  Text,
  Title,
  Loader,
  Alert,
  Select,
} from "@mantine/core";

import EchartsWordCloud from "../../components/EchartsWordCloud";

import {
  IconChartHistogram,
  IconSchool,
  IconBuilding,
  IconAlertTriangle,
  IconRefresh,
  IconAlertCircle,
} from "@tabler/icons-react";

import { useNavigate } from "react-router-dom";
import { useAdminTitle } from "../../components/Layout/AdminTitleContext";
import classes from "../admin/Admin.module.css";
import { useQuery } from "@tanstack/react-query";

import {
  getKpis,
  getSeries,
  getDistribution,
  getTopAreas,
  getNpsSeries,
  getVolumeSeries,
  getTopicsHeatmap,
  getTopicsPolarity,
  getWorstQuestions,
  getAreasAlerts,
  getHourly,
  getBoxplotNotas,
  getWordsHeatmapByPolarity,
} from "../../services/dashboard";

import { Line as LineChart, Bar as BarChart } from "react-chartjs-2";

import { useMemo, useRef, useState, useEffect } from "react";
import dayjs from "dayjs";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

import "../../chart";
import { DashboardFiltersProvider } from "../../state/dashboardFilters";
import DashboardFilters from "../../components/DashboardFilters";
import { useDashboardFilters } from "../../state/dashboardFilters";
import type { ChartOptions } from "chart.js";
import { getPublicCategories } from "../../services/categories";
import { notifyError, notifySuccess } from "../../services/notifications";

// Configuração padrão dos gráficos
const baseChartOptions: ChartOptions<"line" | "bar" | "doughnut"> = {
  responsive: true,
  maintainAspectRatio: false, // usa todo o espaço do card
  animation: { duration: 250 },
  plugins: {
    legend: { display: true, position: "top" },
    tooltip: { intersect: false, mode: "index" },
  },
  interaction: { intersect: false, mode: "index" },
};

// Funções auxiliares
const toFixedSafe = (n: number | null | undefined, digits = 1) =>
  typeof n === "number" && Number.isFinite(n) ? n.toFixed(digits) : "—";

const toNumSafe = (n: number | null | undefined, digits = 2) =>
  typeof n === "number" && Number.isFinite(n)
    ? Number(n.toFixed(digits))
    : null;

const asArray = <T,>(v: any): T[] =>
  Array.isArray(v)
    ? v
    : Array.isArray(v?.data)
    ? v.data
    : Array.isArray(v?.items)
    ? v.items
    : Array.isArray(v?.rows)
    ? v.rows
    : [];

const C = {
  red: "#ef4444",
  gray: "#94a3b8",
  emerald: "#10b981",
  teal: "#14b8a6",
  brown: "#8B5E3C",
  orange: "#FF8C00",
};

const TOPIC_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#f59e0b",
  "#f43f5e",
  "#10b981",
  "#06b6d4",
  "#a855f7",
  "#ef4444",
  "#22c55e",
  "#eab308",
];

const topicColor = (i: number) => TOPIC_COLORS[i % TOPIC_COLORS.length];
type Ds = { label: string; data: any[]; [k: string]: any };

const paint = (ds: Ds, color: string): Ds => ({
  ...ds,
  borderColor: color,
  backgroundColor: withAlpha(color, 0.18),
  pointBorderColor: color,
  pointBackgroundColor: color,
});

const withAlpha = (hex: string, a: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
};

type WordItem = { text: string; count: number; score?: number };
type AnyRow = Record<string, any>;

const get = (r: AnyRow, ...keys: string[]) =>
  keys.find((k) => r[k] !== undefined)
    ? r[keys.find((k) => r[k] !== undefined)!]
    : undefined;

export type WordWeekItem = {
  week: string; // semana no formato yyyy-MM-dd
  text: string; // palavra tratada
  count: number; // frequência registrada
  score?: number; // média quando existir
};

const parseWordWeekItems = (rows: any): WordWeekItem[] =>
  (Array.isArray(rows)
    ? rows
    : Array.isArray(rows?.data)
    ? rows.data
    : Array.isArray(rows?.items)
    ? rows.items
    : Array.isArray(rows?.rows)
    ? rows.rows
    : []
  )
    .map((r: AnyRow) => {
      const week = String(
        get(r, "week", "Week", "bucket", "Bucket") ?? ""
      ).trim();
      const text = String(
        get(r, "word", "Word", "keyword", "Keyword", "term", "Term") ?? ""
      )
        .trim()
        .toLowerCase();
      const count = Number(
        get(r, "total", "Total", "count", "Count", "freq", "Freq") ?? 0
      );
      const scoreRaw = get(r, "avg_score", "avgScore", "score", "Score");
      const score = scoreRaw !== undefined ? Number(scoreRaw) : undefined;
      return { week, text, count, score };
    })
    // garante campos mínimos
    .map((it) => ({
      ...it,
      week: it.week || "unknown",
    }))
    .filter((it) => it.text.length >= 3 && it.count > 0);

const fromWeekToFlat = (items: WordWeekItem[]): WordItem[] => {
  const acc = new Map<string, { count: number; sum: number; n: number }>();
  for (const it of items) {
    const cur = acc.get(it.text) ?? { count: 0, sum: 0, n: 0 };
    cur.count += it.count;
    if (typeof it.score === "number") {
      cur.sum += it.score;
      cur.n += 1;
    }
    acc.set(it.text, cur);
  }
  return [...acc.entries()].map(([text, { count, sum, n }]) => ({
    text,
    count,
    score: n ? +(sum / n).toFixed(3) : undefined,
  }));
};

const splitTopBottom = (items: WordItem[], k = 8) => {
  const sorted = [...items].sort((a, b) => b.count - a.count);
  const hot = sorted.slice(0, k);
  const cold = sorted.slice(-k).reverse(); // palavras menos citadas
  return { hot, cold };
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const hsl = (h: number, s: number, l: number) => `hsl(${h} ${s}% ${l}%)`;

// Cores para negativas: azul até vermelho
const colorNeg = (t: number) => hsl(210 - 210 * t, 85, 50 - 2 * t);
// Cores para positivas: verde até laranja
const colorPos = (t: number) => hsl(120 - 85 * t, 80, 45 + 5 * t);

type Pol = "neg" | "pos";

const makeWordBar = (items: WordItem[], pol: Pol) => {
  const max = Math.max(1, ...items.map((i) => i.count));
  const t = (v: number) => clamp01(v / max);
  const color = pol === "neg" ? colorNeg : colorPos;
  return {
    labels: items.map((i) => i.text),
    datasets: [
      {
        label: "Frequência",
        data: items.map((i) => i.count),
        backgroundColor: items.map((i) => color(t(i.count))),
        borderWidth: 0,
        barThickness: 18,
        maxBarThickness: 22,
      },
    ],
  };
};

// Stopwords básicas usadas pelo heatmap
const RAW_STOP = [
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "a",
  "o",
  "os",
  "as",
  "um",
  "uma",
  "que",
  "com",
  "pra",
  "pro",
  "na",
  "no",
  "em",
  "por",
  "para",
  "se",
  "ser",
  "foi",
  "era",
  "é",
  "são",
];
const STOP = new Set(
  RAW_STOP.map((s) =>
    s
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .trim()
  )
);
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

function willRenderHeatmap(
  items: WordItem[],
  _pol: "pos" | "neg",
  _gap = 0.25,
  minFreq = 1
) {
  return items.some((it) => {
    const k = normalize(it.text || "");
    if (!k || k.length < 3 || STOP.has(k)) return false;
    return (it.count ?? 0) >= minFreq;
  });
}

const wordBarOptions = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: "y" as const,
  scales: {
    x: { beginAtZero: true, grid: { display: true }, ticks: { precision: 0 } },
    y: { grid: { display: false } },
  },
  plugins: { legend: { display: false } },
};

function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <Alert
      color="red"
      icon={<IconAlertCircle size={16} />}
      mt="xs"
      className={classes.alertCompact}
    >
      <Group justify="space-between" wrap="nowrap">
        <Text
          size="sm"
          c="red.9"
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {message || "Falha ao carregar dados."}
        </Text>
        <Button
          size="xs"
          leftSection={<IconRefresh size={14} />}
          variant="light"
          color="red"
          onClick={onRetry}
        >
          Tentar novamente
        </Button>
      </Group>
    </Alert>
  );
}

export function OverviewFilters() {
  // Busca categorias disponíveis
  const { data: cats = [], isLoading } = useQuery({
    queryKey: ["categories-public"],
    queryFn: getPublicCategories,
    staleTime: 5 * 60 * 1000,
  });

  // Formata para value/label
  const options = cats.map((c) => ({ value: String(c.id), label: c.nome }));

  // Mantém o filtro controlado
  const [categoryId, setCategoryId] = useState<string | null>(null);

  return (
    <Select
      label="Categoria"
      placeholder="Digite para buscar"
      searchable
      clearable
      data={options} // precisa ter value/label
      value={categoryId} // string ou null
      onChange={setCategoryId} // já recebe string ou null
      nothingFound={isLoading ? "Carregando..." : "Sem resultados"}
      maxDropdownHeight={280}
      filter={(value, item) =>
        item.label?.toLowerCase().includes(value.toLowerCase().trim()) ?? false
      }
    />
  );
}

function OverviewInner() {
  useAdminTitle("Visão geral");
  const nav = useNavigate();
  const exportAreaRef = useRef<HTMLDivElement>(null);
  const [exportingCharts, setExportingCharts] = useState(false);

  // Filtros principais do dashboard
  const { value: F, setValue } = useDashboardFilters();

  // Chaves que disparam recarga quando mudam
  const FK = [
    F.from,
    F.to,
    F.categoryId,
    F.questionId,
    F.curso,
    F.turno,
    F.unidade,
    F.identified,
  ] as const;

  // Opções padrão das consultas
  const qOpts = {
    retry: 0,
    refetchOnWindowFocus: false as const,
    staleTime: 60_000,
  };

  // Datas base calculadas uma vez
  const nowRef = useRef(new Date());
  const nowIso = useMemo(() => nowRef.current.toISOString(), []);
  const from30 = useMemo(
    () =>
      new Date(
        nowRef.current.getTime() - 30 * 24 * 60 * 60 * 1000
      ).toISOString(),
    []
  );
  const from12w = useMemo(
    () =>
      new Date(
        nowRef.current.getTime() - 84 * 24 * 60 * 60 * 1000
      ).toISOString(),
    []
  );

  // Consulta das piores perguntas
  const qWorst = useQuery({
    queryKey: ["questions-worst", 5, ...FK],
    queryFn: () =>
      getWorstQuestions({
        limit: 5,
        from: F.from,
        to: F.to,
        categoryId: F.categoryId ?? undefined,
        questionId: F.questionId ?? undefined,
        curso: F.curso ?? undefined,
        turno: F.turno ?? undefined,
        unidade: F.unidade ?? undefined,
        identified: F.identified ? true : undefined,
      }),
    retry: 0,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  // Cartões de resumo
  const {
    data: kpis,
    isLoading: loadingKpis,
    isError: errorKpis,
    error: kpisErr,
    refetch: refetchKpis,
  } = useQuery({
    queryKey: ["kpis", ...FK],
    queryFn: () =>
      getKpis({
        from: F.from,
        to: F.to,
        categoryId: F.categoryId ?? undefined,
        questionId: F.questionId ?? undefined,
        curso: F.curso ?? undefined,
        turno: F.turno ?? undefined,
        unidade: F.unidade ?? undefined,
        identified: F.identified ? true : undefined,
      }),
    ...qOpts,
  });

  // Série semanal
  const {
    data: series,
    isLoading: loadingSeries,
    isError: errorSeries,
    error: seriesErr,
    refetch: refetchSeries,
  } = useQuery({
    queryKey: ["series", "week", ...FK],
    queryFn: () =>
      getSeries({
        interval: "week",
        from: F.from,
        to: F.to,
        categoryId: F.categoryId ?? undefined,
        questionId: F.questionId ?? undefined,
        curso: F.curso ?? undefined,
        turno: F.turno ?? undefined,
        unidade: F.unidade ?? undefined,
        identified: F.identified ? true : undefined,
      }),
    ...qOpts,
  });

  // Distribuição das notas
  const {
    data: dist,
    isLoading: loadingDist,
    isError: errorDist,
    error: distErr,
    refetch: refetchDist,
  } = useQuery({
    queryKey: ["distribution", ...FK],
    queryFn: () =>
      getDistribution({
        from: F.from,
        to: F.to,
        categoryId: F.categoryId ?? undefined,
        questionId: F.questionId ?? undefined,
        curso: F.curso ?? undefined,
        turno: F.turno ?? undefined,
        unidade: F.unidade ?? undefined,
        identified: F.identified ? true : undefined,
      }),
    ...qOpts,
  });

  // Áreas com pior desempenho
  const {
    data: topAreas,
    isLoading: loadingTop,
    isError: errorTop,
    error: topErr,
    refetch: refetchTop,
  } = useQuery({
    queryKey: ["top-areas", 5, ...FK],
    queryFn: () =>
      getTopAreas({
        limit: 5,
        from: F.from,
        to: F.to,
        categoryId: F.categoryId ?? undefined,
        questionId: F.questionId ?? undefined,
        curso: F.curso ?? undefined,
        turno: F.turno ?? undefined,
        unidade: F.unidade ?? undefined,
        identified: F.identified ? true : undefined,
      }),
    ...qOpts,
  });

  // Dados usados nos gráficos
  const kpiCards = [
    {
      label: "NPS Acadêmico",
      value: kpis ? (kpis.nps > 0 ? `+${kpis.nps}` : `${kpis.nps}`) : "--",
      icon: IconChartHistogram,
    },
    {
      label: "Feedbacks recebidos",
      value: kpis?.totalFeedbacks?.toLocaleString("pt-BR") ?? "--",
      icon: IconSchool,
    },
    {
      label: "Áreas com alerta",
      value: kpis?.areasComAlerta?.toString() ?? "--",
      icon: IconAlertTriangle,
    },
    {
      label: "Áreas cadastradas",
      value: kpis?.totalAreas?.toString() ?? "--",
      icon: IconBuilding,
    },
  ];

  const lineData = useMemo(() => {
    const labels = (series ?? []).map((p) => p.bucket);
    const dataset = (series ?? []).map((p) => toNumSafe(p.avg, 2));
    return {
      labels,
      datasets: [
        paint(
          {
            label: "Média semanal",
            data: dataset,
            tension: 0.3,
            pointRadius: 2,
          },
          C.brown
        ),
      ],
    };
  }, [series]);

  const barData = useMemo(() => {
    const labels = (dist ?? []).map((b) => b.rating.toString());
    const dataset = (dist ?? []).map((b) => toNumSafe(b.total));
    return {
      labels,
      datasets: [paint({ label: "Quantidade", data: dataset }, C.orange)],
    };
  }, [dist]);

  const noSeries =
    !loadingSeries && !errorSeries && (series?.length ?? 0) === 0;
  const noDist =
    !loadingDist &&
    !errorDist &&
    (dist?.reduce((s, b) => s + b.total, 0) ?? 0) === 0;
  const noTop = !loadingTop && !errorTop && (topAreas?.length ?? 0) === 0;

  // NPS por semana e volume diário
  const qNpsA = useQuery({
    queryKey: ["nps-series", "week", ...FK],
    queryFn: () =>
      getNpsSeries({
        interval: "week",
        from: F.from,
        to: F.to,
        categoryId: F.categoryId ?? undefined,
        questionId: F.questionId ?? undefined,
        curso: F.curso ?? undefined,
        turno: F.turno ?? undefined,
        unidade: F.unidade ?? undefined,
        identified: F.identified ? true : undefined,
      }),
    ...qOpts,
  });

  const qVol = useQuery({
    queryKey: ["volume-series", "day", ...FK],
    queryFn: () =>
      getVolumeSeries({
        interval: "day",
        from: F.from,
        to: F.to,
        categoryId: F.categoryId ?? undefined,
        questionId: F.questionId ?? undefined,
        curso: F.curso ?? undefined,
        turno: F.turno ?? undefined,
        unidade: F.unidade ?? undefined,
        identified: F.identified ? true : undefined,
      }),
    ...qOpts,
  });

  // Polaridade por tópico e heatmap semanal
  const qPol = useQuery({
    queryKey: ["topics-polarity", ...FK],
    queryFn: () =>
      getTopicsPolarity({
        from: F.from,
        to: F.to,
        categoryId: F.categoryId ?? undefined,
        questionId: F.questionId ?? undefined,
        curso: F.curso ?? undefined,
        turno: F.turno ?? undefined,
        unidade: F.unidade ?? undefined,
        identified: F.identified ? true : undefined,
      }),
    ...qOpts,
  });

  const catParam =
    F.categoryId && /^[0-9a-fA-F-]{36}$/.test(F.categoryId)
      ? F.categoryId
      : undefined;

  const qHeat = useQuery({
    queryKey: [
      "topics-heatmap",
      6,
      F.from,
      F.to,
      catParam,
      F.curso ?? null,
      F.turno ?? null,
      F.unidade ?? null,
      F.identified ?? null,
    ],
    queryFn: () =>
      getTopicsHeatmap({
        top: 6,
        from: F.from,
        to: F.to,
        categoryId: catParam,
        curso: F.curso ?? undefined,
        turno: F.turno ?? undefined,
        unidade: F.unidade ?? undefined,
        identified: F.identified ? true : undefined,
      }),
    ...qOpts,
  });

  // Alertas por área e horários
  const qAlerts = useQuery({
    queryKey: ["areas-alerts", 8, ...FK],
    queryFn: () =>
      getAreasAlerts({
        limit: 8,
        from: F.from,
        to: F.to,
        categoryId: F.categoryId ?? undefined,
        questionId: F.questionId ?? undefined,
        curso: F.curso ?? undefined,
        turno: F.turno ?? undefined,
        unidade: F.unidade ?? undefined,
        identified: F.identified ? true : undefined,
      }),
    ...qOpts,
  });

  const qHourly = useQuery({
    queryKey: ["hourly", ...FK],
    queryFn: () =>
      getHourly({
        from: F.from,
        to: F.to,
        categoryId: F.categoryId ?? undefined,
        questionId: F.questionId ?? undefined,
        curso: F.curso ?? undefined,
        turno: F.turno ?? undefined,
        unidade: F.unidade ?? undefined,
        identified: F.identified ? true : undefined,
      }),
    ...qOpts,
  });

  // Palavras positivas
  const qWordsPos = useQuery({
    queryKey: [
      "words-heatmap",
      "pos",
      F.from,
      F.to,
      F.categoryId,
      F.curso,
      F.turno,
      F.unidade,
      F.identified,
    ],
    queryFn: () =>
      getWordsHeatmapByPolarity({
        polarity: "pos",
        top: 24,
        from: F.from,
        to: F.to,
        categoryId: F.categoryId ?? undefined,
        curso: F.curso ?? undefined,
        turno: F.turno ?? undefined,
        unidade: F.unidade ?? undefined,
        identified: F.identified ? true : undefined,
      }),
    ...qOpts,
  });

  // Palavras negativas
  const qWordsNeg = useQuery({
    queryKey: [
      "words-heatmap",
      "neg",
      F.from,
      F.to,
      F.categoryId,
      F.curso,
      F.turno,
      F.unidade,
      F.identified,
    ],
    queryFn: () =>
      getWordsHeatmapByPolarity({
        polarity: "neg",
        top: 24,
        from: F.from,
        to: F.to,
        categoryId: F.categoryId ?? undefined,
        curso: F.curso ?? undefined,
        turno: F.turno ?? undefined,
        unidade: F.unidade ?? undefined,
        identified: F.identified ? true : undefined,
      }),
    ...qOpts,
  });

  const MINFREQ = 1;

  const posItems = useMemo(() => {
    const weekly = parseWordWeekItems(qWordsPos.data);
    return fromWeekToFlat(weekly).filter((w) => w.count >= MINFREQ);
  }, [qWordsPos.data]);

  const negItems = useMemo(() => {
    const weekly = parseWordWeekItems(qWordsNeg.data);
    return fromWeekToFlat(weekly).filter((w) => w.count >= MINFREQ);
  }, [qWordsNeg.data]);

  const posItemsKW = useMemo(
    () =>
      posItems.map((w) => ({ week: w.week, keyword: w.text, total: w.count })),
    [posItems]
  );
  const negItemsKW = useMemo(
    () =>
      negItems.map((w) => ({ week: w.week, keyword: w.text, total: w.count })),
    [negItems]
  );

  const { hot: posHot, cold: posCold } = useMemo(
    () => splitTopBottom(posItems.slice(0, 24), 8),
    [posItems]
  );
  const { hot: negHot, cold: negCold } = useMemo(
    () => splitTopBottom(negItems.slice(0, 24), 8),
    [negItems]
  );

  const dataNegHot = useMemo(() => makeWordBar(negHot, "neg"), [negHot]);
  const dataNegCold = useMemo(() => makeWordBar(negCold, "neg"), [negCold]);
  const dataPosHot = useMemo(() => makeWordBar(posHot, "pos"), [posHot]);
  const dataPosCold = useMemo(() => makeWordBar(posCold, "pos"), [posCold]);

  // Boxplot por curso e nuvem de palavras
  const qBox = useQuery({
    queryKey: [
      "boxplot",
      "curso",
      F.from,
      F.to,
      F.categoryId,
      F.questionId,
      F.curso,
      F.turno,
      F.unidade,
      F.identified,
    ],
    queryFn: () =>
      getBoxplotNotas({
        groupBy: "curso",
        from: F.from,
        to: F.to,
        categoryId: F.categoryId ?? undefined,
        questionId: F.questionId ?? undefined,
        curso: F.curso ?? undefined,
        turno: F.turno ?? undefined,
        unidade: F.unidade ?? undefined,
        identified: F.identified ? true : undefined,
      }),
    ...qOpts,
  });

  // Dados de NPS no eixo -100..100
  const npsLabels = (qNpsA.data ?? []).map((d) => d.bucket);
  const npsDatasets = [
    {
      label: "NPS",
      data: (qNpsA.data ?? []).map((d) => d.nps),
      tension: 0.35,
      borderColor: C.brown,
      backgroundColor: withAlpha(C.brown, 0.18),
      pointRadius: 2,
    },
  ];
  const npsData = { labels: npsLabels, datasets: npsDatasets };

  // Volume diário de feedbacks
  const volData = {
    labels: (qVol.data ?? []).map((d) => d.bucket),
    datasets: [
      {
        label: "Feedbacks/dia",
        data: (qVol.data ?? []).map((d) => d.total),
        tension: 0.25,
        pointRadius: 2,
        borderColor: C.orange,
        backgroundColor: withAlpha(C.orange, 0.18),
      },
    ],
  };

  const arr = (k: "neg" | "neu" | "pos") =>
    (qPol.data ?? []).map((r) => Number(r[k]) || 0);
  // Polaridade agrupada por tópico
  const polLabels = (qPol.data ?? []).map((r) => r.topic);

  const polData = {
    labels: polLabels,
    datasets: [
      {
        label: "Neg",
        data: arr("neg"),
        stack: "pol",
        backgroundColor: withAlpha(C.red, 0.55),
        borderColor: C.red,
        borderWidth: 1,
        barThickness: 18,
        maxBarThickness: 22,
      },
      {
        label: "Neu",
        data: arr("neu"),
        stack: "pol",
        backgroundColor: withAlpha(C.gray, 0.55),
        borderColor: C.gray,
        borderWidth: 1,
        barThickness: 18,
        maxBarThickness: 22,
      },
      {
        label: "Pos",
        data: arr("pos"),
        stack: "pol",
        backgroundColor: withAlpha(C.emerald, 0.55),
        borderColor: C.emerald,
        borderWidth: 1,
        barThickness: 18,
        maxBarThickness: 22,
      },
    ],
  };

  // Heatmap semanal com os 6 tópicos mais citados
  type HeatRow = { week: string; keyword: string; total: number };

  const heatData = useMemo(() => {
    type HeatRow = { week: string; keyword: string; total: number };

    // Normaliza e filtra palavras curtas
    const raw = asArray<HeatRow>(qHeat.data).filter(
      (x) => x.keyword && x.keyword.trim().length >= 3
    );

    // Ordena as semanas para usar como eixo X
    const weeks = Array.from(new Set(raw.map((x) => x.week))).sort();

    // Seleciona os 6 tópicos mais citados
    const sumByTopic = new Map<string, number>();
    for (const r of raw)
      sumByTopic.set(r.keyword, (sumByTopic.get(r.keyword) ?? 0) + r.total);
    const topTopics = [...sumByTopic.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([k]) => k);

    // Monta os datasets empilhados
    const datasets = topTopics.map((t, i) => ({
      label: t,
      data: weeks.map(
        (w) => raw.find((x) => x.week === w && x.keyword === t)?.total ?? 0
      ),
      stack: "heat",
      borderColor: topicColor(i),
      backgroundColor: withAlpha(topicColor(i), 0.55),
      borderWidth: 1,
      barThickness: 18,
      maxBarThickness: 22,
    }));

    return { labels: weeks, datasets };
  }, [qHeat.data]);

  // Alertas por área empilhados
  const alertsLabels = (qAlerts.data ?? []).map((r) => r.area);
  const alertsData = useMemo(
    () => ({
      labels: (qAlerts.data ?? []).map((r) => r.area),
      datasets: [
        {
          label: "Críticos (≤3)",
          data: (qAlerts.data ?? []).map((r) => r.crit),
          stack: "a",
          borderColor: C.red,
          backgroundColor: withAlpha(C.red, 0.55),
        },
        {
          label: "OK (≥4)",
          data: (qAlerts.data ?? []).map((r) => r.ok),
          stack: "a",
          borderColor: C.emerald,
          backgroundColor: withAlpha(C.emerald, 0.55),
        },
      ],
    }),
    [qAlerts.data]
  );

  // Horários com participação
  const hoursData = {
    labels: (qHourly.data ?? []).map((r) => r.hour.toString().padStart(2, "0")),
    datasets: [
      {
        label: "Feedbacks por hora",
        data: (qHourly.data ?? []).map((r) => r.total),
      },
    ],
  };

  useEffect(() => {
    const fmt = (v?: string | null) =>
      v ? dayjs(v).format("DD/MM/YYYY") : "—";
    const exportCharts = async () => {
      if (!exportAreaRef.current) {
        notifyError("Área de gráficos não encontrada.");
        return;
      }
      try {
        setExportingCharts(true);
        const canvas = await html2canvas(exportAreaRef.current, {
          scale: 2,
          useCORS: true,
        });
        const img = canvas.toDataURL("image/png");
        const pdf = new jsPDF("p", "pt", "a4");
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 24;

        // Ajusta tamanho da imagem para caber na página
        const imgWidth = pageWidth - margin * 4; // margem maior nas laterais
        const imgHeight = Math.min(
          (canvas.height * imgWidth) / canvas.width,
          pageHeight - margin * 2 - 42
        );

        const startX = (pageWidth - imgWidth) / 2;

        pdf.addImage(img, "PNG", startX, margin, imgWidth, imgHeight);

        pdf.setFontSize(10);
        pdf.text(
          [
            `Período: ${fmt(F.from)} – ${fmt(F.to)}`,
            `Categoria: ${F.categoryId ? "Filtrada" : "Todas"}`,
            `Curso: ${F.curso?.trim() || "Todos"}`,
            `Identificação: ${F.identified ? "Somente identificados" : "Todos"}`,
          ].join(" | "),
          startX,
          margin + imgHeight + 18,
          { maxWidth: imgWidth }
        );
        const stamp = dayjs().format("YYYYMMDD-HHmm");
        pdf.save(`dashboard-${stamp}.pdf`);
        notifySuccess("PDF gerado com os gráficos atuais.");
      } catch (err) {
        notifyError(err);
      } finally {
        setExportingCharts(false);
      }
    };

    window.addEventListener("tc:dashboard-export", exportCharts);
    return () =>
      window.removeEventListener("tc:dashboard-export", exportCharts);
  }, [F.from, F.to, F.categoryId, F.curso, F.identified]);

  return (
    <div ref={exportAreaRef}>
      {/* KPIs */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
        {kpiCards.map(({ label, value, icon: Icon }) => (
          <Paper key={label} p="md" radius="md" className={classes.cardKpi}>
            <Group justify="space-between" align="flex-start">
              <Box style={{ minWidth: 0 }}>
                <Text c="dimmed" fz="sm">
                  {label}
                </Text>
                <Title order={2} mt={6}>
                  {loadingKpis ? <Loader size="sm" /> : errorKpis ? "—" : value}
                </Title>
                {errorKpis && (
                  <ErrorState
                    message={(kpisErr as any)?.message}
                    onRetry={refetchKpis}
                  />
                )}
              </Box>
              <div className={classes.kpiIcon}>
                <Icon size={22} />
              </div>
            </Group>
          </Paper>
        ))}
      </SimpleGrid>

      {/* GRÁFICOS */}
      <Grid mt="xl" gutter="lg" align="stretch">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Paper p="md" radius="md" className={classes.panel}>
            <Group justify="space-between" mb="xs">
              <Title order={4}>Satisfação por área</Title>
              <Text c="dimmed" fz="sm">
                média móvel (12 semanas)
              </Text>
            </Group>

            {loadingSeries && (
              <Group justify="center" h={260}>
                <Loader />
              </Group>
            )}
            {errorSeries && (
              <ErrorState
                message={(seriesErr as any)?.message}
                onRetry={refetchSeries}
              />
            )}

            {!loadingSeries && !errorSeries && noSeries && (
              <Group justify="center" h={200}>
                <Text c="dimmed">Sem dados para o período.</Text>
              </Group>
            )}

            {!loadingSeries && !errorSeries && !noSeries && (
              <div aria-label="Gráfico de linhas">
                <div className={classes.chart260}>
                  <LineChart
                    data={lineData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: { y: { min: 0, max: 5 } },
                    }}
                  />
                </div>
              </div>
            )}
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper p="md" radius="md" className={classes.panel}>
            <Group justify="space-between" mb="xs">
              <Title order={4}>Distribuição de notas</Title>
              <Text c="dimmed" fz="sm">
                últimos 30 dias
              </Text>
            </Group>

            {loadingDist && (
              <Group justify="center" h={260}>
                <Loader />
              </Group>
            )}
            {errorDist && (
              <ErrorState
                message={(distErr as any)?.message}
                onRetry={refetchDist}
              />
            )}

            {!loadingDist && !errorDist && noDist && (
              <Group justify="center" h={200}>
                <Text c="dimmed">Sem dados para o período.</Text>
              </Group>
            )}

            {!loadingDist && !errorDist && !noDist && (
              <div aria-label="Gráfico de barras">
                <div className={classes.chart260}>
                    <BarChart
                      data={barData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        indexAxis: "y", // barras na horizontal
                      scales: {
                        x: {
                          beginAtZero: true,
                          title: { display: true, text: "Qtd" },
                        },
                        y: { title: { display: true, text: "Nota (1-5)" } },
                      },
                      plugins: { legend: { display: false } },
                    }}
                  />
                </div>
              </div>
            )}
          </Paper>
        </Grid.Col>
      </Grid>

      {/* TABELA */}
      <Paper p="md" radius="md" mt="xl" className={classes.panel}>
        <Group justify="space-between" mb="xs" align="center">
          <Title order={4}>Áreas com maior impacto</Title>
      
        </Group>

        {loadingTop && (
          <Group justify="center" p="lg">
            <Loader />
          </Group>
        )}
        {errorTop && (
          <ErrorState message={(topErr as any)?.message} onRetry={refetchTop} />
        )}

        {!loadingTop && !errorTop && noTop && (
          <Group justify="center" p="lg">
            <Text c="dimmed">Sem dados.</Text>
          </Group>
        )}

        {!loadingTop && !errorTop && !noTop && (
          <div className={classes.tableWrap}>
            <Table
              verticalSpacing="sm"
              highlightOnHover
              stickyHeader
              className={`${classes.table} ${classes.tableMin}`}
            >
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Área</Table.Th>
                  <Table.Th>Média</Table.Th>
                  <Table.Th>Alertas</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(topAreas ?? []).map((r) => (
                  <Table.Tr key={`${r.categoryId ?? "none"}-${r.area}`}>
                    <Table.Td>{r.area}</Table.Td>
                    <Table.Td>{toFixedSafe(r.media, 1)}</Table.Td>
                    <Table.Td>
                      {r.alertas > 0 ? (
                        <Badge color="red" variant="filled">
                          {r.alertas}
                        </Badge>
                      ) : (
                        <Badge color="teal" variant="light">
                          OK
                        </Badge>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </div>
        )}
      </Paper>
      {/* ====== BLOCO 1: NPS (linha) + Volume (linha) ====== */}

      
          <Paper p="md" radius="md" mt="xl" className={classes.panel}>
            <Group justify="space-between" mb="xs">
              <Title order={4}>NPS (tendência)</Title>
              <Text c="dimmed" fz="sm">
                {new Date(F.from).toLocaleDateString()} –{" "}
                {new Date(F.to).toLocaleDateString()}
              </Text>
            </Group>
            {qNpsA.isLoading && (
              <Group justify="center" h={260}>
                <Loader />
              </Group>
            )}
            {qNpsA.isError && (
              <ErrorState
                message="Falha ao carregar NPS"
                onRetry={qNpsA.refetch}
              />
            )}
            {!qNpsA.isLoading &&
              !qNpsA.isError &&
              (qNpsA.data?.length ?? 0) === 0 && (
                <Group justify="center" h={200}>
                  <Text c="dimmed">Sem dados.</Text>
                </Group>
              )}
            {!qNpsA.isLoading &&
              !qNpsA.isError &&
              (qNpsA.data?.length ?? 0) > 0 && (
                <div className={classes.chart260}>
                  <LineChart
                    data={npsData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: { y: { min: -100, max: 100 } },
                    }}
                  />
                </div>
              )}
          </Paper>
       
      
          <Paper p="md" radius="md" mt="xl" className={classes.panel}>
            <Group justify="space-between" mb="xs">
              <Title order={4}>Volume de feedbacks</Title>
              <Text c="dimmed" fz="sm">
                por dia
              </Text>
            </Group>
            {qVol.isLoading && (
              <Group justify="center" h={260}>
                <Loader />
              </Group>
            )}
            {qVol.isError && (
              <ErrorState
                message="Falha ao carregar volume"
                onRetry={qVol.refetch}
              />
            )}
            {!qVol.isLoading &&
              !qVol.isError &&
              (qVol.data?.reduce((s, d) => s + (d.total ?? 0), 0) ?? 0) ===
                0 && (
                <Group justify="center" h={200}>
                  <Text c="dimmed">Sem dados.</Text>
                </Group>
              )}
            {!qVol.isLoading &&
              !qVol.isError &&
              (qVol.data?.reduce((s, d) => s + (d.total ?? 0), 0) ?? 0) > 0 && (
                <div className={classes.chart300}>
                  <LineChart
                    data={volData}
                    options={{ responsive: true, maintainAspectRatio: false }}
                  />
                </div>
              )}
          </Paper>

      

      {/* ====== BLOCO 2: Polaridade por Tópico (empilhado) + Heatmap semanal ====== */}
      <Grid mt="xl" gutter="lg" align="stretch">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper p="md" radius="md" className={classes.panel}>
            <Group justify="space-between" mb="xs">
              <Title order={4}>Polaridade por tópico</Title>
              <Text c="dimmed" fz="sm">
                ordenado por % negativo
              </Text>
            </Group>

            {qPol.isLoading && (
              <Group justify="center" h={300}>
                <Loader />
              </Group>
            )}
            {qPol.isError && (
              <ErrorState
                message="Falha ao carregar polaridade"
                onRetry={qPol.refetch}
              />
            )}

            {!qPol.isLoading &&
              !qPol.isError &&
              (qPol.data?.length ?? 0) === 0 && (
                <Group justify="center" h={200}>
                  <Text c="dimmed">Sem dados.</Text>
                </Group>
              )}

            {!qPol.isLoading &&
              !qPol.isError &&
              (qPol.data?.length ?? 0) > 0 && (
                <div className={classes.chartTall}>
                  <BarChart
                    data={(() => {
                      // Limita a quantidade para caber bem
                      const TOP_N = 8;

                      // Labels originais já vêm ordenadas
                      const labelsAll = polData.labels;
                      const labels = labelsAll.slice(0, TOP_N);

                      // Mapeia índices para alinhar datasets ao recorte
                      const idxMap = new Map(labelsAll.map((l, i) => [l, i]));
                      const mapData = (arr: number[]) =>
                        labels.map((l) => arr[idxMap.get(l) ?? -1] ?? 0);

                      return {
                        labels,
                        datasets: [
                          {
                            label: "Neg",
                            data: mapData(polData.datasets[0].data as number[]),
                            stack: "pol",
                            borderWidth: 0,
                            barThickness: 18,
                            maxBarThickness: 22,
                          },
                          {
                            label: "Neu",
                            data: mapData(polData.datasets[1].data as number[]),
                            stack: "pol",
                            borderWidth: 0,
                            barThickness: 18,
                            maxBarThickness: 22,
                          },
                          {
                            label: "Pos",
                            data: mapData(polData.datasets[2].data as number[]),
                            stack: "pol",
                            borderWidth: 0,
                            barThickness: 18,
                            maxBarThickness: 22,
                          },
                        ],
                      };
                    })()}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      indexAxis: "y", // barras na horizontal
                      layout: {
                        padding: { left: 4, right: 8, top: 6, bottom: 6 },
                      },
                      scales: {
                        x: {
                          stacked: true,
                          beginAtZero: true,
                          grid: { display: true },
                          ticks: { precision: 0 },
                        },
                        y: {
                          stacked: true,
                          grid: { display: false },
                          ticks: {
                            autoSkip: false,
                            // Corta rótulo longo para não invadir o gráfico
                            callback: (value) => {
                              const s = String(value);
                              return s.length > 40 ? s.slice(0, 40) + "…" : s;
                            },
                          },
                        },
                      },
                      plugins: {
                        legend: { position: "top" },
                        tooltip: {
                          callbacks: {
                            title: (items) => {
                              const s = items?.[0]?.label ?? "";
                              return s.length > 90 ? s.slice(0, 90) + "…" : s;
                            },
                          },
                        },
                      },
                    }}
                  />
                </div>
              )}
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper p="md" radius="md" className={classes.panel}>
            <Group justify="space-between" mb="xs">
              <Title order={4}>Tópicos × Semana</Title>
              <Text c="dimmed" fz="sm">
                picos visuais (top 6 tópicos)
              </Text>
            </Group>
            {qHeat.isLoading && (
              <Group justify="center" h={300}>
                <Loader />
              </Group>
            )}
            {qHeat.isError && (
              <ErrorState
                message="Falha ao carregar heatmap"
                onRetry={qHeat.refetch}
              />
            )}
            {!qHeat.isLoading &&
              !qHeat.isError &&
              asArray(qHeat.data).length === 0 && (
                <Group justify="center" h={200}>
                  <Text c="dimmed">Sem dados.</Text>
                </Group>
              )}

            {!qHeat.isLoading &&
              !qHeat.isError &&
              asArray(qHeat.data).length > 0 && (
                <div className={classes.chartTall}>
                  <BarChart
                    data={{
                      ...heatData,
                      datasets: heatData.datasets.map((ds) => ({
                        ...ds,
                        // Quanto maior o valor, mais opaca a barra (0.15..0.85)
                        backgroundColor: (ctx) => {
                          const val = ctx.raw as number;
                          const max = Math.max(
                            1,
                            ...heatData.datasets.flatMap(
                              (d) => d.data as number[]
                            )
                          );
                          const alpha = 0.15 + 0.7 * (val / max);
                          const base = (ds.borderColor as string) || "#3b82f6";
                          const [r, g, b] = base
                            .replace("#", "")
                            .match(/.{1,2}/g)!
                            .map((h) => parseInt(h, 16));
                          return `rgba(${r},${g},${b},${alpha})`;
                        },
                      })),
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        x: { stacked: true },
                        y: { stacked: true, beginAtZero: true },
                      },
                      plugins: { legend: { position: "top" } },
                    }}
                  />
                </div>
              )}
          </Paper>
        </Grid.Col>
      </Grid>

      {/* ====== BLOCO 3: Alertas por área + Horário ====== */}
      <Grid mt="xl" gutter="lg" align="stretch">
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Paper p="md" radius="md" className={classes.panel}>
            <Group justify="space-between" mb="xs">
              <Title order={4}>Alertas por área</Title>
              <Text c="dimmed" fz="sm">
                críticos (≤3) vs ok (≥4)
              </Text>
            </Group>
            {qAlerts.isLoading && (
              <Group justify="center" h={300}>
                <Loader />
              </Group>
            )}
            {qAlerts.isError && (
              <ErrorState
                message="Falha ao carregar alertas"
                onRetry={qAlerts.refetch}
              />
            )}
            {!qAlerts.isLoading &&
              !qAlerts.isError &&
              (qAlerts.data?.length ?? 0) === 0 && (
                <Group justify="center" h={200}>
                  <Text c="dimmed">Sem dados.</Text>
                </Group>
              )}

            {!qAlerts.isLoading &&
              !qAlerts.isError &&
              (qAlerts.data?.length ?? 0) > 0 && (
                <div className={classes.chart300}>
                  <BarChart
                    data={alertsData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        x: { stacked: true },
                        y: { stacked: true, beginAtZero: true },
                      },
                    }}
                  />
                </div>
              )}
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 5 }}>
          <Paper p="md" radius="md" className={classes.panel}>
            <Group justify="space-between" mb="xs">
              <Title order={4}>Participação por horário</Title>
              <Text c="dimmed" fz="sm">
                00–23h
              </Text>
            </Group>
            {qHourly.isLoading && (
              <Group justify="center" h={300}>
                <Loader />
              </Group>
            )}
            {qHourly.isError && (
              <ErrorState
                message="Falha ao carregar horários"
                onRetry={qHourly.refetch}
              />
            )}
            {!qHourly.isLoading &&
              !qHourly.isError &&
              (qHourly.data?.reduce((s, d) => s + (d.total ?? 0), 0) ?? 0) ===
                0 && (
                <Group justify="center" h={200}>
                  <Text c="dimmed">Sem dados.</Text>
                </Group>
              )}
            {!qHourly.isLoading &&
              !qHourly.isError &&
              (qHourly.data?.reduce((s, d) => s + (d.total ?? 0), 0) ?? 0) >
                0 && (
                <div className={classes.chart300}>
                  <BarChart
                    data={hoursData}
                    options={{ responsive: true, maintainAspectRatio: false }}
                  />
                </div>
              )}
          </Paper>
        </Grid.Col>
      </Grid>

      {/* ====== BLOCO 4: Piores perguntas (tabela) ====== */}
      <Paper p="md" radius="md" mt="xl" className={classes.panel}>
        <Group justify="space-between" mb="xs" align="center">
          <Title order={4}>Piores perguntas (Top 5)</Title>
        </Group>
        {qWorst.isLoading && (
          <Group justify="center" p="lg">
            <Loader />
          </Group>
        )}
        {qWorst.isError && (
          <ErrorState
            message="Falha ao carregar perguntas"
            onRetry={qWorst.refetch}
          />
        )}
        {!qWorst.isLoading &&
          !qWorst.isError &&
          (qWorst.data?.length ?? 0) === 0 && (
            <Group justify="center" p="lg">
              <Text c="dimmed">Sem dados.</Text>
            </Group>
          )}

        {!qWorst.isLoading &&
          !qWorst.isError &&
          (qWorst.data?.length ?? 0) > 0 && (
            <div className={classes.tableWrap}>
              <Table
                verticalSpacing="sm"
                highlightOnHover
                stickyHeader
                className={`${classes.table} ${classes.tableMin}`}
              >
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Pergunta</Table.Th>
                    <Table.Th>Média</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {(qWorst.data ?? []).map((r) => (
                    <Table.Tr key={r.questionId}>
                      <Table.Td>{r.pergunta}</Table.Td>
                      <Table.Td>{toFixedSafe(r.media, 2)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
          )}
      </Paper>

      {/* ====== BLOCO 5: Boxplot (fallback tabela) + Wordcloud (tags) ====== */}
      <Paper p="md" radius="md" mt="xl" className={classes.panel}>
        <Group justify="space-between" mb="xs">
          <Title order={4}>Boxplot — notas por curso</Title>
          <Text c="dimmed" fz="sm">
            quartis e outliers
          </Text>
        </Group>
        {qBox.isLoading && (
          <Group justify="center" h={300}>
            <Loader />
          </Group>
        )}
        {qBox.isError && (
          <ErrorState
            message="Falha ao carregar boxplot"
            onRetry={qBox.refetch}
          />
        )}
        {!qBox.isLoading && !qBox.isError && (qBox.data?.length ?? 0) === 0 && (
          <Group justify="center" h={200}>
            <Text c="dimmed">Sem dados.</Text>
          </Group>
        )}

        {!qBox.isLoading && !qBox.isError && (qBox.data?.length ?? 0) > 0 && (
          <div className={classes.tableWrap}>
            <Table
              verticalSpacing="sm"
              highlightOnHover
              stickyHeader
              className={`${classes.table} ${classes.tableMin}`}
            >
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Grupo</Table.Th>
                  <Table.Th>Min</Table.Th>
                  <Table.Th>Q1</Table.Th>
                  <Table.Th>Mediana</Table.Th>
                  <Table.Th>Q3</Table.Th>
                  <Table.Th>Max</Table.Th>
                  <Table.Th>Outliers</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(qBox.data ?? []).map((r) => (
                  <Table.Tr key={r.group}>
                    <Table.Td>{r.group}</Table.Td>
                    <Table.Td>{r.min}</Table.Td>
                    <Table.Td>{r.q1}</Table.Td>
                    <Table.Td>{r.median}</Table.Td>
                    <Table.Td>{r.q3}</Table.Td>
                    <Table.Td>{r.max}</Table.Td>
                    <Table.Td>{r.outliers.join(", ") || "—"}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </div>
        )}
      </Paper>

      {/* ====== BLOCO 6: Wordbars (tags) ====== */}
      <Grid mt="xl" gutter="lg" align="stretch">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper p="md" radius="md" className={classes.panel}>
            <Group justify="space-between" mb="xs">
              <Title order={4}>Worst words — Heatmap</Title>
              <Text c="dimmed" fz="sm">
                negativas (frequência → calor)
              </Text>
            </Group>
            {qWordsNeg.isLoading ? (
              <Group justify="center" h={300}>
                <Loader />
              </Group>
            ) : qWordsNeg.isError ? (
              <ErrorState
                message="Falha ao carregar as palavras"
                onRetry={qWordsNeg.refetch}
              />
            ) : !willRenderHeatmap(negItems, "neg", 0.05, 1) ? (
              <Group justify="center" h={200}>
                <Text c="dimmed">Sem dados.</Text>
              </Group>
            ) : (
              <div className={classes.chart300}>
                <EchartsWordCloud items={negItems.map((w) => ({ text: w.text, value: w.count }))} polarity="neg" height={300} />
              </div>
            )}
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper p="md" radius="md" className={classes.panel}>
            <Group justify="space-between" mb="xs">
              <Title order={4}>Positive words — Heatmap</Title>
              <Text c="dimmed" fz="sm">
                positivas (frequência → calor)
              </Text>
            </Group>
            {qWordsPos.isLoading ? (
              <Group justify="center" h={300}>
                <Loader />
              </Group>
            ) : qWordsPos.isError ? (
              <ErrorState
                message="Falha ao carregar as palavras"
                onRetry={qWordsPos.refetch}
              />
            ) : !willRenderHeatmap(posItems, "pos", 0.05, 1) ? (
              <Group justify="center" h={200}>
                <Text c="dimmed">Sem dados.</Text>
              </Group>
            ) : (
              <div className={classes.chart300}>
                <EchartsWordCloud items={posItems.map((w) => ({ text: w.text, value: w.count }))} polarity="pos" height={300} />
              </div>
            )}
          </Paper>
        </Grid.Col>
      </Grid>
    </div>
  );
}
export default function Overview() {
  return (
    <DashboardFiltersProvider>
      <DashboardFilters />
      <OverviewInner />
    </DashboardFiltersProvider>
  );
}
