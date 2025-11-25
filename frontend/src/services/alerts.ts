import api from './api';

export type AlertRule = {
  id: string;
  nome: string;
  categoriaId: string | null;
  notaMinima: number;
  periodoDias: number;
  enviarEmail: boolean;
  ativa: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type AlertRuleInput = {
  nome: string;
  categoriaId: string | null;
  notaMinima: number;
  periodoDias: number;
  enviarEmail: boolean;
  ativa: boolean;
};

export type AlertEmailConfig = {
  adminRecipients: string[];
  extraEmails: string;
  sendMode: 'immediate' | 'daily';
  criticalKeywords?: string;
};

export async function listAlertRules(): Promise<AlertRule[]> {
  const { data } = await api.get<AlertRule[]>('/alert-rules');
  return data;
}

export async function upsertAlertRule(payload: AlertRuleInput & { id?: string }): Promise<AlertRule> {
  const body = {
    nome: payload.nome,
    categoriaId: payload.categoriaId,
    notaMinima: payload.notaMinima,
    periodoDias: payload.periodoDias,
    enviarEmail: payload.enviarEmail,
    ativa: payload.ativa,
  };

  if (payload.id) {
    const { data } = await api.put<AlertRule>(`/alert-rules/${payload.id}`, body);
    return data;
  }

  const { data } = await api.post<AlertRule>('/alert-rules', body);
  return data;
}

export async function setAlertRuleStatus(id: string, ativa: boolean): Promise<void> {
  await api.patch(`/alert-rules/${id}/status`, { ativa });
}

export async function getAlertEmailConfig(): Promise<AlertEmailConfig> {
  const { data } = await api.get<AlertEmailConfig>('/alert-email-config');
  return data;
}

export async function saveAlertEmailConfig(config: AlertEmailConfig): Promise<AlertEmailConfig> {
  const { data } = await api.put<AlertEmailConfig>('/alert-email-config', config);
  return data;
}
