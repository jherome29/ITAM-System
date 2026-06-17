import client, { type ApiResponse } from './client';

export interface LoginDto {
  emailOrEmployeeId: string;
  password: string;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  division: string;
  officeOrSection: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export const authApi = {
  login: (dto: LoginDto) =>
    client.post<ApiResponse<LoginResponse>>('/v1/auth/login', dto).then((r) => r.data),

  refresh: () =>
    client.post<ApiResponse<{ accessToken: string }>>('/v1/auth/refresh').then((r) => r.data),

  logout: () =>
    client.post<ApiResponse<null>>('/v1/auth/logout').then((r) => r.data),

  profile: () =>
    client.get<ApiResponse<AuthUser>>('/v1/auth/profile').then((r) => r.data),
};
