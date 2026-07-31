import { useEffect, useState } from 'react';
import { api, type PerformanceRow } from '../api/client';
import { Shell } from '../components/Shell';
import { useAuth } from '../auth/AuthContext';

const fmt = (n: number) => Math.round(n).toLocaleString();
const money = (n: number) => `$${n.toFixed(2)}`;

type Direction = 'termination' | 'origination';

export function Reports() {
  const { user } = useAuth();
  const [direction, setDirection] = useState<Direction>('termination');
  const [rows, setRows] = useState<PerformanceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(null);
    setError(null);
    api.performance(direction).then(setRows).catch((e) => setError(e.message));
  }, [direction]);

  const total = (key: keyof PerformanceRow) =>
    (rows ?? []).reduce((a, r) => a + (r[key] as number), 0);

  return (
    <Shell title="Reports">
      {error && <div className="alert alert-error">{error}</div>}

      <section className="panel">
        <div className="panel-head">
          <h2>Relationship performance</h2>
          <span className="relationship-pill">
            {user?.relationshipName ?? `Relationship ${user?.relationshipId ?? ''}`}
          </span>
        </div>

        <div className="tabs">
          {(['termination', 'origination'] as Direction[]).map((d) => (
            <button
              key={d}
              className={`tab ${direction === d ? 'tab-active' : ''}`}
              onClick={() => setDirection(d)}
            >
              {d === 'termination' ? 'Termination' : 'Origination'}
            </button>
          ))}
        </div>

        {!rows ? (
          <div className="chart-skeleton" style={{ height: 220 }} />
        ) : rows.length === 0 ? (
          <p className="hint">No performance data for this relationship in the selected period.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="report-table">
              <thead>
                <tr>
                  <th>Route</th>
                  <th className="num">Attempts</th>
                  <th className="num">ASR %</th>
                  <th className="num">ACD</th>
                  <th className="num">Minutes</th>
                  <th className="num">PDD</th>
                  <th className="num">Cost</th>
                  <th className="num">Revenue</th>
                  <th className="num">Margin</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    <td className="num">{fmt(r.attempts)}</td>
                    <td className="num">{r.asr.toFixed(2)}</td>
                    <td className="num">{r.acd}</td>
                    <td className="num">{fmt(r.minutes)}</td>
                    <td className="num">{r.pdd} ms</td>
                    <td className="num">{money(r.cost)}</td>
                    <td className="num">{money(r.revenue)}</td>
                    <td className={`num ${r.margin < 0 ? 'stat-neg' : ''}`}>{money(r.margin)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="num">{fmt(total('attempts'))}</td>
                  <td className="num">—</td>
                  <td className="num">—</td>
                  <td className="num">{fmt(total('minutes'))}</td>
                  <td className="num">—</td>
                  <td className="num">{money(total('cost'))}</td>
                  <td className="num">{money(total('revenue'))}</td>
                  <td className="num">{money(total('margin'))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </Shell>
  );
}
