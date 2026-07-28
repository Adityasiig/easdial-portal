interface Props {
  label: string;
  value: string;
  sub?: string;
  negative?: boolean;
}

export function StatCard({ label, value, sub, negative }: Props) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${negative ? 'stat-neg' : ''}`}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}
