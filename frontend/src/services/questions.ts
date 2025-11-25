// ======================= TIPOS =======================
export type TipoAvaliacao = 'Nota' | 'Multipla' | 'Texto';

export type PerguntaOpcao = { texto: string; valor: number };

export type Pergunta = {
  id: string;
  categoriaId: string;
  categoriaNome?: string;
  enunciado: string;
  tipo: TipoAvaliacao;
  obrigatoria: boolean;
  ordem: number;
  ativa: boolean;
  opcoes: PerguntaOpcao[];
};

export type PerguntaListParams = {
  search?: string;
  page?: number;
  pageSize?: number;
  categoriaId?: string;
  tipo?: TipoAvaliacao;
  onlyActive?: boolean;
};
// =====================================================

import { api } from './api';

// LISTAR
export async function listQuestions(p: PerguntaListParams) {
  const { data } = await api.get('/questions', { params: p });
  return data as { items: Pergunta[]; total: number };
}

// CRIAR
export async function createQuestion(payload: {
  categoriaId: string;
  enunciado: string;
  tipo: TipoAvaliacao;
  obrigatoria: boolean;
  ordem?: number;
  opcoes?: PerguntaOpcao[];
}) {
  const { data } = await api.post('/questions', payload);
  return data;
}

// ATUALIZAR
export async function updateQuestion(
  id: string,
  payload: {
    categoriaId: string;
    enunciado: string;
    tipo: TipoAvaliacao;
    obrigatoria: boolean;
    ordem?: number;
    opcoes?: PerguntaOpcao[];
  }
) {
  await api.put(`/questions/${id}`, payload);
}

// ATIVAR/INATIVAR
export async function toggleQuestion(id: string, ativa: boolean) {
  await api.patch(`/questions/${id}/toggle`, ativa, {
    headers: { 'Content-Type': 'application/json' },
  });
}

// EXCLUIR
export async function deleteQuestion(id: string) {
  await api.delete(`/questions/${id}`);
}
