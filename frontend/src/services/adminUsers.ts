import api from './api';
import { stripCpf } from '../utils/cpf';
import type { AdminRole, AdminUserListResponse } from '../types/admin';

type ListParams = {
  search?: string;
  role?: AdminRole | null;
  active?: boolean | null;
  page?: number;
  pageSize?: number;
};

export async function listAdminUsers(params: ListParams = {}): Promise<AdminUserListResponse> {
  const query: Record<string, unknown> = {
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 10,
  };

  if (params.search) query.search = params.search;
  if (params.role) query.role = params.role;
  if (typeof params.active === 'boolean') query.active = params.active;

  const { data } = await api.get('/admin-users', { params: query });
  return data as AdminUserListResponse;
}

type CreatePayload = {
  nome: string;
  cpf: string;
  email?: string;
  role: AdminRole;
  senha: string;
  isActive?: boolean;
};

type UpdatePayload = {
  nome: string;
  cpf: string;
  email?: string;
  role: AdminRole;
  isActive: boolean;
  novaSenha?: string;
};

function normalizeBody<T extends { cpf: string; email?: string | null | undefined }>(payload: T) {
  return {
    ...payload,
    cpf: stripCpf(payload.cpf),
    email: payload.email?.trim() || undefined,
  };
}

export async function createAdminUser(payload: CreatePayload) {
  await api.post('/admin-users', normalizeBody(payload));
}

export async function updateAdminUser(id: string, payload: UpdatePayload) {
  await api.put(`/admin-users/${id}`, normalizeBody(payload));
}

export async function updateAdminUserStatus(id: string, isActive: boolean) {
  await api.patch(`/admin-users/${id}/status`, { isActive });
}

export async function deleteAdminUser(id: string) {
  await api.delete(`/admin-users/${id}`);
}
