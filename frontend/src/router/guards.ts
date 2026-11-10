/** 路由守卫：未登录 → /login；角色不足 → 只读提示。
 *  注：本文件保持 .ts 扩展名，因此使用 createElement 而不是 JSX。
 */
import { createElement, Fragment, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import type { Role } from '../types/user';

export function RequireAuth({ children }: { children: ReactNode }) {
  const token = useAuthStore((state) => state.accessToken);
  const location = useLocation();
  if (!token) {
    return createElement(Navigate, { to: '/login', replace: true, state: { from: location.pathname } });
  }
  return createElement(Fragment, null, children);
}

export function hasRole(role: Role | undefined, allowed: Role[]): boolean {
  return Boolean(role && allowed.includes(role));
}
