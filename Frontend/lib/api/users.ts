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
  alternateApproverId: string | null;
  unavailable: boolean;
  unavailableUntil: string | null;
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
  alternateApproverId?: string | null;
  unavailable?: boolean;
  unavailableUntil?: string | null;
}

export const usersApi = {
  list: (page = 1, limit = 20, search?: string, role?: string) => {
    const params: Record<string, string | number> = { page, limit };
    if (search) params.search = search;
    if (role) params.role = role;
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
    client.patch<ApiResponse<null>>(`/v1/users/${id}/deactivate`).then((r) => r.data),

  activate: (id: string) =>
    client.patch<ApiResponse<null>>(`/v1/users/${id}/activate`).then((r) => r.data),

  resetPassword: (id: string, newPassword: string) =>
    client.patch<ApiResponse<null>>(`/v1/users/${id}/reset-password`, { newPassword }).then((r) => r.data),

  unlock: (id: string) =>
    client.patch<ApiResponse<User>>(`/v1/users/${id}/unlock`).then((r) => r.data),

  setMyAvailability: (payload: { unavailable: boolean; unavailableUntil: string | null }) =>
    client.patch<ApiResponse<User>>('/v1/users/me/availability', payload).then((r) => r.data),
};
