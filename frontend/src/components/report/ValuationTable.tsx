import type { ValuationRow } from '../../types/report.types';

interface ValuationTableProps {
  rows: ValuationRow[];
  ticker: string;
}

function fmt(value: number | null, suffix = ''): string {
  if (value === null) return '—';
  return `${value.toFixed(1)}${suffix}`;
}

function fmtGrowth(value: number | null): { text: string; colour: string } {
  if (value === null) return { text: '—', colour: 'text-cream-subtle' };
  const pct = (value * 100).toFixed(1);
  return {
    text: `${value >= 0 ? '+' : ''}${pct}%`,
    colour: value >= 0 ? 'text-emerald-400' : 'text-red-400',
  };
}

interface MetricRowProps {
  label: string;
  value: string;
  valueClass?: string;
}

function MetricRow({ label, value, valueClass = 'text-cream-muted' }: MetricRowProps) {
  return (
    <div className="flex justify-between items-baseline gap-2 py-1 border-b border-navy-700/50 last:border-0">
      <span className="font-mono text-[10px] text-cream-subtle uppercase tracking-wide flex-shrink-0">
        {label}
      </span>
      <span className={`font-mono text-sm font-medium ${valueClass} text-right`}>
        {value}
      </span>
    </div>
  );
}

export default function ValuationTable({ rows, ticker }: ValuationTableProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-cream-subtle italic font-body">No valuation data available.</p>;
  }

  // Subject ticker always first
  const sorted = [...rows].sort((a, b) => {
    const aIs = a.ticker.toUpperCase() === ticker.toUpperCase();
    const bIs = b.ticker.toUpperCase() === ticker.toUpperCase();
    if (aIs) return -1;
    if (bIs) return 1;
    return 0;
  });

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-2 gap-2">
      {sorted.map((row) => {
        const isSubject = row.ticker.toUpperCase() === ticker.toUpperCase();
        const { text: growthText, colour: growthColour } = fmtGrowth(row.yoy_growth);
        const grossPct =
          row.gross_margin !== null
            ? `${(row.gross_margin * 100).toFixed(1)}%`
            : '—';

        return (
          <div
            key={row.ticker}
            className={[
              'rounded-lg p-3 border',
              isSubject
                ? 'border-2 border-gold bg-gold/10'
                : 'border-navy-600 bg-navy-900',
            ].join(' ')}
          >
            {/* Card header */}
            <div className="mb-2.5">
              <p className={`font-mono text-base font-bold leading-tight ${isSubject ? 'text-gold' : 'text-cream'}`}>
                {row.ticker}
              </p>
              <p className="font-body text-[11px] text-cream-subtle leading-tight truncate">
                {row.name}
              </p>
            </div>

            {/* Metrics */}
            <MetricRow label="P/S"     value={fmt(row.ps_ratio, 'x')} />
            <MetricRow label="EV/EBITDA" value={fmt(row.ev_ebitda, 'x')} />
            <MetricRow label="Gross Margin" value={grossPct} />
            <MetricRow label="YoY Growth" value={growthText} valueClass={growthColour} />
          </div>
        );
      })}
    </div>
  );
}
