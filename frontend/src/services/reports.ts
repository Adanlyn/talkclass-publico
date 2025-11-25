import { api } from './api';
import dayjs from 'dayjs';

export type ReportType = 'feedbacks';
export type ExportFormat = 'csv' | 'excel' | 'pdf';

export type ReportFilters = {
  dateStart?: Date | string | null;
  dateEnd?: Date | string | null;
  categoriaId?: string | null;
  courseName?: string;
  identified?: 'all' | 'identified' | 'anonymous';
  notaMin?: number | null;
  notaMax?: number | null;
  perguntaId?: string | null;
  page?: number;
  pageSize?: number;
};

function toYmd(d?: Date | null | string) {
  if (!d) return undefined;
  if (typeof d === 'string') return d;
  return dayjs(d).format('YYYY-MM-DD');
}

function normalizeFilters(filters: ReportFilters) {
  const identified =
    filters.identified === 'identified'
      ? true
      : filters.identified === 'anonymous'
        ? false
        : undefined;

  return {
    categoriaId: filters.categoriaId || undefined,
    courseName: filters.courseName || undefined,
    identified,
    dateStart: toYmd(filters.dateStart),
    dateEnd: toYmd(filters.dateEnd),
    notaMin: filters.notaMin ?? undefined,
    notaMax: filters.notaMax ?? undefined,
    perguntaId: filters.perguntaId || undefined,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export async function fetchReport(type: ReportType, filters: ReportFilters) {
  const params = normalizeFilters(filters);

  const { data } = await api.get('/reports/feedbacks', { params });
  return data as { total: number; items: any[]; page: number; pageSize: number };
}

export async function exportReport(type: ReportType, format: ExportFormat, filters: ReportFilters) {
  const params = normalizeFilters(filters);
  const url = '/reports/feedbacks/export';

  const { data } = await api.get(url, {
    params: { ...params, format },
    responseType: 'blob',
  });

  return data as Blob;
}

export async function fetchFeedbackSummary(filters: ReportFilters) {
  const params = normalizeFilters(filters);
  const { data } = await api.get('/reports/feedbacks/summary', { params });
  return data as {
    volume: { date: string; total: number }[];
    byCategory: { categoriaId?: string; categoria: string; total: number }[];
    identified: { identified: number; anonymous: number };
    notaMedia: number;
  };
}
