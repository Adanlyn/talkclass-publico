export type AdminRole = 'Master' | 'Admin';

export type AdminUser = {
  id: string;
  nome: string;
  email?: string;
  cpf: string;
  role: AdminRole;
  isActive: boolean;
  createdAt: string;
  mustChangePassword?: boolean;
};

export type AdminUserListResponse = {
  total: number;
  page: number;
  pageSize: number;
  items: AdminUser[];
};

export type CurrentAdmin = {
  id: string;
  nome: string;
  email?: string;
  cpf: string;
  role: AdminRole;
  roles?: AdminRole[];
  mustChangePassword: boolean;
};
