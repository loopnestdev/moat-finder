import type { NapkinMath as NapkinMathType } from '../../types/report.types';

interface NapkinMathProps {
  data: NapkinMathType;
}

export default function NapkinMath({ data }: NapkinMathProps) {
  const upsidePositive = data.upside_percent >= 0;

  return (
    <div className="rounded-xl bg-navy-950 border border-navy-700 p-5 sm:p-6">
      <p className="font-mono text-xs text-gold/60 uppercase tracking-[0.2em] mb-5">
        Napkin Math
      </p>

      {/* Hero row: target price + upside */}
      <div className="flex items-end gap-6 mb-6">
        <div>
          <p className="font-mono text-xs text-cream-subtle mb-1">Target Price</p>
          <p className="font-mono text-3xl font-bold text-gold leading-none">
            ${data.target_price}
          </p>
        </div>
        <div>
          <p className="font-mono text-xs text-cream-subtle mb-1">Upside</p>
          <p className={[
            'font-mono text-4xl font-bold leading-none',
            upsidePositive ? 'text-emerald-400' : 'text-red-400',
          ].join(' ')}>
            {upsidePositive ? '+' : ''}{data.upside_percent}%
          </p>
        </div>
      </div>

      {/* Supporting data */}
      <div className="grid grid-cols-2 gap-4 border-t border-navy-700 pt-4">
        <div>
          <p className="font-mono text-xs text-cream-subtle mb-1">Revenue Guidance</p>
          <p className="font-body text-sm text-cream leading-snug">{data.revenue_guidance}</p>
        </div>
        <div>
          <p className="font-mono text-xs text-cream-subtle mb-1">Comp Multiple</p>
          <p className="font-mono text-sm text-cream">
            <span className="text-gold">{data.comp_ticker}</span>
            {' '}
            <span className="text-cream-muted">{data.comp_multiple}x</span>
          </p>
        </div>
      </div>
    </div>
  );
}
