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
    return <p className="text-sm text-gray-500 italic">No valuation data available.</p>;
  }

  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider text-xs whitespace-nowrap">
              Ticker
            </th>
            <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider text-xs whitespace-nowrap">
              P/S
            </th>
            <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider text-xs whitespace-nowrap">
              EV/EBITDA
            </th>
            <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider text-xs whitespace-nowrap">
              Gross Margin
            </th>
            <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider text-xs whitespace-nowrap">
              YoY Growth
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {rows.map((row) => {
            const isCurrentTicker =
              row.ticker.toUpperCase() === ticker.toUpperCase();
            return (
              <tr
                key={row.ticker}
                className={isCurrentTicker ? 'bg-blue-50' : 'hover:bg-gray-50'}
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="font-mono font-medium text-gray-900">
                    {row.ticker}
                  </span>
                  <span className="ml-2 text-gray-500 hidden sm:inline">
                    {row.name}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                  {fmt(row.ps_ratio, 'x')}
                </td>
                <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                  {fmt(row.ev_ebitda, 'x')}
                </td>
                <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                  {row.gross_margin !== null
                    ? `${(row.gross_margin * 100).toFixed(1)}%`
                    : '—'}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {row.yoy_growth !== null ? (
                    <span
                      className={
                        row.yoy_growth >= 0
                          ? 'text-emerald-600'
                          : 'text-red-600'
                      }
                    >
                      {row.yoy_growth >= 0 ? '+' : ''}
                      {(row.yoy_growth * 100).toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-gray-500">—</span>
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
