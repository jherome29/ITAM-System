import client, { type ApiResponse, type PaginatedResponse } from './client';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  role: string;
  division: string;
  officeOrSection: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  role: string;
  division: string;
  officeOrSection: string;
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  division?: string;
  officeOrSection?: string;
}

export const usersApi = {
  list: (page = 1, limit = 20, search?: string) => {
    const params: Record<string, string | number> = { page, limit };
    if (search) params.search = search;
    return client.get<ApiResponse<PaginatedResponse<User>>>('/v1/users', { params }).then((r) => r.data);
  },

  getOne: (id: string) =>
    client.get<ApiResponse<User>>(`/v1/users/${id}`).then((r) => r.data),

  create: (dto: CreateUserDto) =>
    client.post<ApiResponse<User>>('/v1/users', dto).then((r) => r.data),

  update: (id: string, dto: UpdateUserDto) =>
    client.patch<ApiResponse<User>>(`/v1/users/${id}`, dto).then((r) => r.data),

  updateRole: (id: string, role: string) =>
    client.patch<ApiResponse<User>>(`/v1/users/${id}/role`, { role }).then((r) => r.data),

  deactivate: (id: string) =>
    client.patch<ApiResponse<User>>(`/v1/users/${id}/deactivate`).then((r) => r.data),

  resetPassword: (id: string, newPassword: string) =>
    client.patch<ApiResponse<null>>(`/v1/users/${id}/reset-password`, { newPassword }).then((r) => r.data),

  unlock: (id: string) =>
    client.patch<ApiResponse<User>>(`/v1/users/${id}/unlock`).then((r) => r.data),
};
