/** 应用外壳：顶部 48px 工具条 + 左侧窄导航 + 内容区。 */
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { ROLE_LABELS } from '../../types/user';
import GridBackdrop from '../common/GridBackdrop';

const NAV = [
  { to: '/assets', label: '资产库', code: 'ASSETS' },
  { to: '/runs', label: '运行历史', code: 'RUNS' },
  { to: '/pipelines/new', label: '管线构建', code: 'PIPELINE' },
];

export default function AppShell() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const toast = useUiStore((state) => state.toast);
  const clearToast = useUiStore((state) => state.clearToast);
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col bg-paper">
      <header
        className="relative flex shrink-0 items-center justify-between border-b rule-line px-5"
        style={{ height: 'var(--toolbar-h)' }}
      >
        <GridBackdrop />
        <div className="relative flex items-baseline gap-6">
          <button
            type="button"
            onClick={() => navigate('/assets')}
            className="font-display text-[15px] font-extrabold tracking-tight"
          >
            Mesh<span className="text-blueprint">LOD</span>
          </button>
          <span className="hidden text-[10px] leading-4 text-ink/45 md:block">
            云图数孪 · 三维网格减面与 LOD 管线
          </span>
          <nav className="flex items-baseline gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `px-2.5 py-1 text-[12px] transition-colors duration-150 ease-draw ${
                    isActive ? 'text-blueprint' : 'text-ink/60 hover:text-ink'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="relative flex items-center gap-3">
          {user ? (
            <div className="text-right leading-tight">
              <p className="text-[11px]">{user.display_name}</p>
              <p className="num text-[9px] uppercase tracking-[0.12em] text-ink/45">
                {user.role} · {ROLE_LABELS[user.role]}
              </p>
            </div>
          ) : null}
          <button
            type="button"
            className="btn"
            onClick={() => {
              logout();
              navigate('/login', { replace: true });
            }}
          >
            退出
          </button>
        </div>
      </header>
      <main className="relative min-h-0 flex-1">
        <Outlet />
        {toast ? (
          <button
            type="button"
            onClick={clearToast}
            className={`absolute bottom-5 left-5 z-30 max-w-md border px-3 py-2 text-left text-[12px] ${
              toast.tone === 'error'
                ? 'border-engineering/60 bg-[var(--red-wash)] text-engineering'
                : toast.tone === 'warn'
                  ? 'border-[var(--amber)]/60 bg-[var(--amber-wash)]'
                  : 'border-rule bg-paper-2'
            }`}
          >
            {toast.text}
          </button>
        ) : null}
      </main>
    </div>
  );
}
