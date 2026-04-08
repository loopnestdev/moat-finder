import type { ValuationRow } from '../../types/report.types';

interface ValuationTableProps {
  rows: ValuationRow[];
  ticker: string;
}

function fmt(value: number | null, suffix = ''): string {
  if (value === null) return '—';
  return `${value.toFixed(1)}${suffix}`;
}

export default function ValuationTable({ rows, ticker }: ValuationTableProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-cream-subtle italic font-body">No valuation data available.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-navy-700">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-navy-950">
            <th className="px-4 py-3 text-left font-mono font-medium text-gold/80 uppercase tracking-widest text-xs whitespace-nowrap">
              Ticker
            </th>
            <th className="px-4 py-3 text-right font-mono font-medium text-gold/80 uppercase tracking-widest text-xs whitespace-nowrap">
              P/S
            </th>
            <th className="px-4 py-3 text-right font-mono font-medium text-gold/80 uppercase tracking-widest text-xs whitespace-nowrap">
              EV/EBITDA
            </th>
            <th className="px-4 py-3 text-right font-mono font-medium text-gold/80 uppercase tracking-widest text-xs whitespace-nowrap">
              Gross Margin
            </th>
            <th className="px-4 py-3 text-right font-mono font-medium text-gold/80 uppercase tracking-widest text-xs whitespace-nowrap">
              YoY Growth
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const isCurrentTicker = row.ticker.toUpperCase() === ticker.toUpperCase();
            return (
              <tr
                key={row.ticker}
                className={[
                  'border-t border-navy-700',
                  isCurrentTicker
                    ? 'bg-gold/10 border-l-2 border-l-gold'
                    : idx % 2 === 0
                      ? 'bg-navy-800'
                      : 'bg-navy-900',
                ].join(' ')}
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={['font-mono font-medium', isCurrentTicker ? 'text-gold' : 'text-cream'].join(' ')}>
                    {row.ticker}
                  </span>
                  <span className="ml-2 text-cream-subtle hidden sm:inline font-body text-xs">
                    {row.name}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-cream-muted whitespace-nowrap">
                  {fmt(row.ps_ratio, 'x')}
                </td>
                <td className="px-4 py-3 text-right font-mono text-cream-muted whitespace-nowrap">
                  {fmt(row.ev_ebitda, 'x')}
                </td>
                <td className="px-4 py-3 text-right font-mono text-cream-muted whitespace-nowrap">
                  {row.gross_margin !== null
                    ? `${(row.gross_margin * 100).toFixed(1)}%`
                    : '—'}
                </td>
                <td className="px-4 py-3 text-right font-mono whitespace-nowrap">
                  {row.yoy_growth !== null ? (
                    <span className={row.yoy_growth >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {row.yoy_growth >= 0 ? '+' : ''}
                      {(row.yoy_growth * 100).toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-cream-subtle">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
