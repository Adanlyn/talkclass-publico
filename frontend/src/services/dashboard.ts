import { adminApi } from '../services/api';
import dayjs from 'dayjs';


const qp = (o: Record<string, any>) =>
  Object.fromEntries(Object.entries(o).filter(([,v]) => v !== undefined && v !== null
));

function qs(params: Record<string, any>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    let val: string | number | boolean = v as any;
    if (typeof v === 'string') {
      const isDate = /^\d{4}-\d{2}-\d{2}$/.test(v);
      if (isDate) {
        // normaliza datas para início/fim do dia local
        if (k === 'to' || k === 'end' || k === 'fim') {
          val = `${v}T23:59:59.999Z`;
        } else {
          val = `${v}T00:00:00.000Z`;
        }
      }
    }
    sp.append(k, String(val));
  });
  return `?${sp.toString()}`;
}


export type KpisDTO = {
  nps: number;
  totalFeedbacks: number;
  areasComAlerta: number;
  totalAreas: number;
};

export type SeriesPoint = { bucket: string; avg: number; count: number };
export type DistBin = { rating: number; total: number };
export type TopArea = { categoryId: string; area: string; media: number; alertas: number };



// ====== TIPOS NOVOS (adicione somente se ainda não existir) ======
export type NpsSeriesPoint = { bucket: string; nps: number };
export type VolumePoint = { bucket: string; total: number };
export type HeatmapItem = { topic: string; week: string; total: number };
export type TopicsPolarityRow = { topic: string; neg: number; neu: number; pos: number; pneg: number };
export type WorstQuestionRow = { questionId: string; pergunta: string; media: number };
export type AreasAlertsRow = { area: string; total: number; crit: number; ok: number };
export type HourlyRow = { hour: number; total: number };

// Boxplot
export type BoxplotRow = {
  group: string;
  min: number; q1: number; median: number; q3: number; max: number;
  outliers: number[];
};

// ====== SERVICES  ======

// KPIs (header)
export function getKpis(p: {
  from: string; to: string;
  categoryId?: string; questionId?: string;
  curso?: string; turno?: string; unidade?: string;
  identified?: boolean;
}) {
  return adminApi.get(`/dashboard/kpis${qs(p)}`).then(r => r.data);
}

// Série temporal (linha)
export function getSeries(p: {
  interval: 'day' | 'week' | 'month';
  from: string; to: string;
  categoryId?: string; questionId?: string;
  curso?: string; turno?: string; unidade?: string;
  identified?: boolean;
}) {
  return adminApi.get(`/dashboard/series${qs(p)}`).then(r => r.data);
}

// Distribuição de notas (barras)
export function getDistribution(p: {
  from: string; to: string;
  categoryId?: string; questionId?: string;
  curso?: string; turno?: string; unidade?: string;
  identified?: boolean;
}) {
  return adminApi.get(`/dashboard/distribution${qs(p)}`).then(r => r.data);
}

// Top áreas (cards/painéis auxiliares)
export function getTopAreas(p: {
  limit: number;
  from: string; to: string;
  categoryId?: string; questionId?: string;
  curso?: string; turno?: string; unidade?: string;
  identified?: boolean;
}) {
  return adminApi.get(`/dashboard/top-areas${qs(p)}`).then(r => r.data);
}

// NPS (linha)
export function getNpsSeries(p: {
  interval: 'day' | 'week' | 'month';
  from: string; to: string;
  categoryId?: string; questionId?: string;
  curso?: string; turno?: string; unidade?: string;
  identified?: boolean;
}) {
  return adminApi.get(`/dashboard/nps-series${qs(p)}`).then(r => r.data);
}

// Volume de feedbacks (linha)
export function getVolumeSeries(p: {
  interval: 'day' | 'week' | 'month';
  from: string; to: string;
  categoryId?: string; questionId?: string;
  curso?: string; turno?: string; unidade?: string;
  identified?: boolean;
}) {
  return adminApi.get(`/dashboard/volume-series${qs(p)}`).then(r => r.data);
}

// Polaridade por tópico (barras empilhadas)
export function getTopicsPolarity(p: {
  from: string; to: string;
  categoryId?: string; questionId?: string;
  curso?: string; turno?: string; unidade?: string;
  identified?: boolean;
}) {
  return adminApi.get(`/dashboard/topics-polarity${qs(p)}`).then(r => r.data);
}

// Heatmap Tópicos × Semana (empilhado)
export async function getTopicsHeatmap(params: {
  from?: string;
  to?: string;
  categoryId?: string;
  top?: number;
  curso?: string;
  turno?: string;
  unidade?: string;
  identified?: boolean;
}) {
  const { data } = await adminApi.get('/dashboard/topics-heatmap', { params });
  // data esperado: Array<{ week: string; topic: string; total: number }>
  return data.map((r: any) => ({ week: r.week, keyword: r.keyword ?? r.topic, total: r.total }));
}

// Piores perguntas (Top 5)
export function getWorstQuestions(p: {
  limit: number;
  from: string; to: string;
  categoryId?: string; questionId?: string;
  curso?: string; turno?: string; unidade?: string;
  identified?: boolean;
}) {
  return adminApi.get(`/dashboard/questions-worst${qs(p)}`).then(r => r.data);
}

// Alertas por área (barras empilhadas)
export function getAreasAlerts(p: {
  limit: number;
  from: string; to: string;
  categoryId?: string; questionId?: string;
  curso?: string; turno?: string; unidade?: string;
  identified?: boolean;
}) {
  return adminApi.get(`/dashboard/areas-alerts${qs(p)}`).then(r => r.data);
}

// Participação por horário
export function getHourly(p: {
  from: string; to: string;
  categoryId?: string; questionId?: string;
  curso?: string; turno?: string; unidade?: string;
  identified?: boolean;
}) {
  return adminApi.get(`/dashboard/hourly${qs(p)}`).then(r => r.data);
}

// Boxplot — notas por Curso/Turno
export function getBoxplotNotas(p: {
  groupBy: 'curso' | 'turno';
  from: string; to: string;
  categoryId?: string; questionId?: string;
  curso?: string; turno?: string; unidade?: string;
  identified?: boolean;
}) {
  return adminApi.get(`/dashboard/boxplot-notas${qs(p)}`).then(r => r.data);
}
export type WordsHeatRow = {
  week: string;
  categoryId: string | null;
  text: string;
  count: number;
  rk: number;
};


export async function getWordsHeatmapByPolarity(p: {
  polarity: 'pos'|'neg';
  top?: number;
  from?: string; to?: string;
  categoryId?: string;
  curso?: string; turno?: string; unidade?: string;
  identified?: boolean;
}) {
  const { data } = await adminApi.get('/dashboard/words/heatmap', { params: p });
  return data;
}
