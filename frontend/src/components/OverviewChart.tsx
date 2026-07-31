import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { OverviewSeries } from '../api/client';
import { brand } from '../theme/brand';

/** Merge the named series into recharts rows keyed by time-of-day label. */
function toRows(data: OverviewSeries) {
  const buckets = data.series[0]?.points.length ?? 0;
  const rows: Record<string, number | string>[] = [];
  for (let i = 0; i < buckets; i++) {
    const ts = data.series[0].points[i]?.ts;
    const hhmm = ts ? new Date(ts).toISOString().slice(11, 16) : String(i);
    const row: Record<string, number | string> = { time: hhmm };
    for (const s of data.series) row[s.label] = s.points[i]?.value ?? 0;
    rows.push(row);
  }
  return rows;
}

const compact = (n: number) =>
  n >= 1000 ? `${Math.round(n / 1000)}k` : String(Math.round(n));

export function OverviewChart({ data }: { data: OverviewSeries }) {
  const rows = toRows(data);
  return (
    <div style={{ width: '100%', height: 340 }}>
      <ResponsiveContainer>
        <LineChart data={rows} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" vertical={false} />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 12, fill: '#8a93a6' }}
            interval={11}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={compact}
            tick={{ fontSize: 12, fill: '#8a93a6' }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip formatter={(v: number) => v.toLocaleString()} />
          {data.series.map((s, i) => (
            <Line
              key={s.label}
              type="monotone"
              dataKey={s.label}
              stroke={brand.seriesPalette[i % brand.seriesPalette.length]}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
