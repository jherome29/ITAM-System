'use client';

import axios, { type AxiosRequestConfig } from 'axios';
import { singleFlight } from './single-flight';

export interface ApiResponse<T> {
  statusCode: number;
  message: string;
  data: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages?: number;
}

let accessToken: string | null = null;
let onTokenExpired: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setOnTokenExpired(cb: () => void) {
  onTokenExpired = cb;
}

const client = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? '/api',
  withCredentials: true,
});

client.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// One refresh at a time, app-wide. The refresh cookie is single-use (the server
// rotates it on every call and treats a second use as replay, wiping the
// session), so the page-load session restore and any number of overlapping 401s
// must share a single request instead of each spending the cookie.
export const refreshAccessToken = singleFlight(async (): Promise<string> => {
  const { data } = await axios.post<ApiResponse<{ accessToken: string }>>(
    `${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/v1/auth/refresh`,
    {},
    { withCredentials: true }
  );
  return data.data.accessToken;
});

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original: AxiosRequestConfig & { _retry?: boolean } = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      let newToken: string;
      try {
        newToken = await refreshAccessToken();
      } catch {
        setAccessToken(null);
        onTokenExpired?.();
        return Promise.reject(error);
      }

      setAccessToken(newToken);
      original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` };
      return client(original);
    }

    return Promise.reject(error);
  }
);

export default client;
