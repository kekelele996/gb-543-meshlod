import { api } from './client';
import type { TokenPair, User } from '../types/user';

export function login(email: string, password: string): Promise<TokenPair> {
  return api.post<TokenPair>('/auth/login', { email, password });
}

export function me(): Promise<User> {
  return api.get<User>('/auth/me');
}

export function refresh(refreshToken: string): Promise<{ access_token: string; refresh_token: string }> {
  return api.post('/auth/refresh', { refresh_token: refreshToken });
}
