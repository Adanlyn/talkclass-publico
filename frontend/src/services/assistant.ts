import { adminApi } from './api';

export type AssistantPayload = {
  question: string;
  from: string;
  to: string;
  categoryId?: string | null;
  curso?: string | null;
  turno?: string | null;
  unidade?: string | null;
  identified?: boolean | null;
};

export type AssistantResponse = {
  answer: string;
  highlights?: string[];
  suggestions?: string[];
};

export async function askAssistant(payload: AssistantPayload) {
  const body = {
    question: payload.question,
    from: payload.from,
    to: payload.to,
    categoryId: payload.categoryId ?? undefined,
    curso: payload.curso ?? undefined,
    turno: payload.turno ?? undefined,
    unidade: payload.unidade ?? undefined,
    identified: payload.identified ?? undefined,
  };

  const { data } = await adminApi.post<AssistantResponse>('/dashboard/assistant', body);
  return data;
}
