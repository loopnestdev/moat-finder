import type { NapkinMath as NapkinMathType } from '../../types/report.types';

interface NapkinMathProps {
  data: NapkinMathType;
}

export default function NapkinMath({ data }: NapkinMathProps) {
  const upsidePositive = data.upside_percent >= 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
        Napkin Math
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">Revenue Guidance</p>
          <p className="font-semibold text-gray-900">{data.revenue_guidance}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Comp</p>
          <p className="font-semibold text-gray-900 font-mono">
            {data.comp_ticker}{' '}
            <span className="font-normal text-gray-600">
              {data.comp_multiple}x
            </span>
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Target Price</p>
          <p className="font-semibold text-gray-900">${data.target_price}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Upside</p>
          <p
            className={[
              'font-semibold text-lg',
              upsidePositive ? 'text-emerald-600' : 'text-red-600',
            ].join(' ')}
          >
            {upsidePositive ? '+' : ''}
            {data.upside_percent}%
          </p>
        </div>
      </div>
    </div>
  );
}
