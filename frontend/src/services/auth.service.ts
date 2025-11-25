import api, { publicApi } from './api';
import { TOKEN_KEY, EXP_KEY } from '../utils/auth';
import type { AdminRole, CurrentAdmin } from '../types/admin';

export async function login(cpf: string, senha: string) {
  const { data } = await publicApi.post('/auth/login', { cpf, senha });

  localStorage.setItem(TOKEN_KEY, data.token);
  const exp = Math.floor(Date.now() / 1000) + data.expiresIn - 30;
  localStorage.setItem(EXP_KEY, String(exp));

  return data;
}

export async function getMe(): Promise<CurrentAdmin> {
  const { data } = await api.get('/user/me');
  const rawRoles: string[] = Array.isArray(data.roles) ? data.roles : data.role ? [data.role] : [];
  const roles = rawRoles.filter((role): role is AdminRole => role === 'Master' || role === 'Admin');

  return {
    id: data.id,
    nome: data.nome,
    email: data.email ?? undefined,
    cpf: data.cpf,
    role: roles[0] ?? 'Admin',
    roles,
    mustChangePassword: Boolean(data.mustChangePassword),
  };
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXP_KEY);
}

export async function changePassword(senhaAtual: string, novaSenha: string) {
  await api.post('/auth/change-password', { senhaAtual, novaSenha });
}

export type PasswordResetInit = {
  emailMask: string | null;
  expiresInSeconds: number;
};

export type TokenValidationResult = {
  remainingSeconds: number;
};

export async function requestPasswordReset(cpf: string): Promise<PasswordResetInit> {
  const { data } = await publicApi.post<PasswordResetInit>('/auth/forgot-password', { cpf });
  return data;
}

export async function verifyResetToken(token: string): Promise<TokenValidationResult> {
  const { data } = await publicApi.post<TokenValidationResult>('/auth/verify-reset-token', { token });
  return data;
}

export async function confirmPasswordReset(token: string, novaSenha: string) {
  await publicApi.post('/auth/reset-password', { token, novaSenha });
}
