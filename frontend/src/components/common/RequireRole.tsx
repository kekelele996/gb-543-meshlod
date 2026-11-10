/** 包裹危险操作按钮：角色不足时不渲染（可给替代提示）。 */
import type { ReactNode } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { MESSAGES } from '../../constants/messages';
import type { Role } from '../../types/user';

interface RequireRoleProps {
  roles: Role[];
  children: ReactNode;
  fallback?: ReactNode;
}

export default function RequireRole({ roles, children, fallback }: RequireRoleProps) {
  const user = useAuthStore((state) => state.user);
  if (!user) return null;
  if (!roles.includes(user.role)) {
    if (fallback) return <>{fallback}</>;
    return <p className="max-w-[240px] text-[11px] leading-4 text-ink/50">{MESSAGES.viewerReadonly}</p>;
  }
  return <>{children}</>;
}
