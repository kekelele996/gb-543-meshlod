import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { login as loginApi, me } from '../api/auth';
import type { Role } from '../types/user';

export function useAuth() {
  const navigate = useNavigate();
  const { user, accessToken, setSession, setUser, logout } = useAuthStore();

  const login = useCallback(
    async (email: string, password: string) => {
      const session = await loginApi(email, password);
      setSession(session);
      navigate('/assets', { replace: true });
      return session.user;
    },
    [navigate, setSession],
  );

  const signOut = useCallback(() => {
    logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  const refreshUser = useCallback(async () => {
    const current = await me();
    setUser(current);
    return current;
  }, [setUser]);

  const hasRole = useCallback(
    (roles: Role[]) => (user ? roles.includes(user.role) : false),
    [user],
  );

  return { user, accessToken, login, signOut, refreshUser, hasRole, isAuthenticated: Boolean(accessToken) };
}
