// src/utils/auth.ts
export const TOKEN_KEY = 'talkclass.jwt';
export const EXP_KEY = 'talkclass.jwt_exp';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function getExp(): number {
  return Number(localStorage.getItem(EXP_KEY) || '0');
}

export function isLoggedIn(): boolean {
  const token = getToken();
  if (!token) return false;
  const exp = getExp();
  if (!exp) return false;
  // exp está em segundos (unix). Agora em segundos:
  const now = Math.floor(Date.now() / 1000);
  return now < exp;
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXP_KEY);
}

export function logoutAndReload(to = '/login') {
  localStorage.removeItem('talkclass.jwt');
  localStorage.removeItem('talkclass.jwt_exp');
  window.location.replace(to); // garante redirect “hard”
}
