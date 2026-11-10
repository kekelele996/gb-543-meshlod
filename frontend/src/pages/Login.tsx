/** 登录：左侧表单 + 右侧制图室图纸（LOD 阶梯与 SSE 公式示意）。 */
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import GridBackdrop from '../components/common/GridBackdrop';
import ErrorPanel from '../components/common/ErrorPanel';
import { RequestError } from '../api/client';
import { SSE_FORMULA } from '../utils/sseFormula';

const DEMO_ACCOUNTS = [
  { role: 'TA', email: 'admin@meshlod.dev', note: '全部读写 · 改模板管线' },
  { role: '模型师', email: 'artist@meshlod.dev', note: '上传 / 发起运行' },
  { role: '引擎组', email: 'viewer@meshlod.dev', note: '只读 · 下载产物' },
];

const SAMPLE_LADDER = [
  { level: 'L0', ratio: '100%', faces: '124,000', sse: '0.000' },
  { level: 'L1', ratio: '50%', faces: '62,000', sse: '0.842' },
  { level: 'L2', ratio: '25%', faces: '31,000', sse: '2.117' },
  { level: 'L3', ratio: '10%', faces: '12,400', sse: '5.402' },
];

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@meshlod.dev');
  const [password, setPassword] = useState('Demo@2026');
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (caught) {
      const requestError = caught as RequestError;
      setError(requestError.message ?? '登录失败');
      setCode(requestError.code);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid h-full grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="relative flex flex-col justify-between overflow-hidden bg-paper px-8 py-7 md:px-12">
        <GridBackdrop />
        <div className="relative">
          <p className="num text-[10px] uppercase tracking-[0.24em] text-ink/45">MESHLOD / 云图数孪 · 资产组</p>
          <h1 className="mt-6 font-display text-[clamp(1.5rem,2.2vw,2.25rem)] font-extrabold leading-[1.05] tracking-tight">
            原始网格进，
            <br />
            多级 LOD 出。
          </h1>
          <p className="mt-4 max-w-md text-[13px] leading-6 text-ink/70">
            上传网格后由后端真实执行焊接顶点、去退化面、法线重算与 QEM 减面，一次运行产出 LOD0–LOD3
            与屏幕空间误差估算，导出可下载的 GLB 并记录每级统计。
          </p>
        </div>

        <form onSubmit={submit} className="relative mt-8 max-w-sm">
          <div className="flex items-baseline justify-between border-b rule-line pb-1">
            <label className="label" htmlFor="email">
              账号 / EMAIL
            </label>
            <span className="num text-[9px] text-ink/35">JWT · 12h</span>
          </div>
          <input
            id="email"
            type="email"
            autoComplete="username"
            className="field mt-2 border-0 border-b border-rule/50 bg-transparent px-0 focus:border-blueprint"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <div className="mt-5 flex items-baseline justify-between border-b rule-line pb-1">
            <label className="label" htmlFor="password">
              密码 / PASSWORD
            </label>
            <span className="num text-[9px] text-ink/35">演示密码 Demo@2026</span>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="field mt-2 border-0 border-b border-rule/50 bg-transparent px-0 focus:border-blueprint"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {error ? (
            <div className="mt-5">
              <ErrorPanel title="登录未通过" message={error} code={code} />
            </div>
          ) : null}

          <button type="submit" className="btn-primary mt-6 w-full justify-center" disabled={busy}>
            {busy ? '登录中…' : '进入制图室'}
          </button>

          <div className="mt-6 border-t hairline pt-3">
            <p className="label">演示账号（点击填入）</p>
            <ul className="mt-1.5 space-y-1">
              {DEMO_ACCOUNTS.map((account) => (
                <li key={account.email}>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(account.email);
                      setPassword('Demo@2026');
                    }}
                    className="flex w-full items-baseline justify-between gap-3 border-b hairline py-1 text-left hover:bg-paper-2"
                  >
                    <span className="text-[11px]">
                      <span className="num text-[10px] uppercase tracking-[0.1em] text-ink/45">{account.role}</span>{' '}
                      {account.email}
                    </span>
                    <span className="text-[10px] text-ink/45">{account.note}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </form>

        <p className="relative num text-[9px] uppercase tracking-[0.16em] text-ink/35">
          meshlod · fastapi · celery · postgresql · three.js
        </p>
      </div>

      <div className="relative hidden overflow-hidden border-l rule-line bg-paper-2 lg:block">
        <GridBackdrop />
        <div className="relative flex h-full flex-col justify-center px-10">
          <div className="border rule-line bg-paper/80 px-6 py-5">
            <div className="flex items-baseline justify-between border-b rule-line pb-2">
              <p className="label">LOD 规格表 / 园区标准 LOD</p>
              <p className="num text-[9px] text-ink/40">campus_A_tower.glb</p>
            </div>
            <table className="mt-2 w-full text-[11px]">
              <thead>
                <tr className="border-b hairline">
                  {['级', '比例', '三角面', 'SSE px'].map((head) => (
                    <th key={head} className="label pb-1 text-left font-normal first:w-10">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SAMPLE_LADDER.map((row) => (
                  <tr key={row.level} className="border-b hairline">
                    <td className="num py-1.5 text-ink/70">{row.level}</td>
                    <td className="num py-1.5">{row.ratio}</td>
                    <td className="num py-1.5 text-right">{row.faces}</td>
                    <td className="num py-1.5 text-right">{row.sse}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="num mt-3 border-t hairline pt-2 text-[9px] leading-4 text-ink/45">{SSE_FORMULA}</p>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-[10px] text-ink/55">
            <div className="border-t rule-line pt-2">
              <p className="num text-[15px] text-ink">100 / 50 / 25 / 10</p>
              <p>比例链</p>
            </div>
            <div className="border-t rule-line pt-2">
              <p className="num text-[15px] text-ink">QEM</p>
              <p>二次误差度量减面</p>
            </div>
            <div className="border-t rule-line pt-2">
              <p className="num text-[15px] text-ink">GLB</p>
              <p>逐级可下载</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
