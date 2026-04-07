import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useVersions } from '../hooks/useResearch';
import BusinessDiagram from '../components/report/BusinessDiagram';
import ScoreBadge from '../components/report/ScoreBadge';
import SectorHeat from '../components/report/SectorHeat';
import ValuationTable from '../components/report/ValuationTable';
import NapkinMath from '../components/report/NapkinMath';
import BearCase from '../components/report/BearCase';
import Changelog from '../components/report/Changelog';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import type { ResearchVersion } from '../types/report.types';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function Versions() {
  const { ticker = '' } = useParams<{ ticker: string }>();
  const { data: versions, isLoading } = useVersions(ticker);
  const [selected, setSelected] = useState<ResearchVersion | null>(null);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (selected) {
    const rj = selected.report_json;
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Button variant="secondary" size="sm" onClick={() => setSelected(null)}>
            ← Back to versions
          </Button>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-gray-900 text-xl">
              {ticker}
            </span>
            <span className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-0.5 rounded">
              v{selected.version}
            </span>
            <ScoreBadge score={selected.score} />
          </div>
          <span className="text-sm text-gray-500 ml-auto">
            {formatDate(selected.created_at)}
          </span>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-2 text-sm text-amber-700">
          Read-only — viewing version {selected.version}
        </div>

        <div className="text-xl font-semibold text-gray-900 leading-snug border-l-4 border-blue-500 pl-4">
          {rj.thesis}
        </div>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Business Model</h2>
          <BusinessDiagram diagram={selected.diagram_json} />
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Sector Heat</h2>
          <SectorHeat heat={rj.sector_heat} sectors={rj.hot_sector_match} />
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Business Model</h2>
          <p className="text-gray-700 leading-relaxed">{rj.business_model}</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Catalysts</h2>
          <ul className="space-y-2">
            {rj.catalysts.map((c, i) => (
              <li key={i} className="flex gap-2 text-gray-700">
                <span className="text-blue-500 flex-shrink-0">→</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Valuation</h2>
          <ValuationTable rows={rj.valuation_table} ticker={ticker} />
        </section>

        <section>
          <NapkinMath data={rj.napkin_math} />
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Moat</h2>
          <p className="text-gray-700 leading-relaxed">{rj.moat}</p>
        </section>

        <section>
          <BearCase bearCase={rj.bear_case} riskFactors={rj.risk_factors ?? []} />
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Macro</h2>
          <p className="text-gray-700 leading-relaxed">{rj.macro_summary}</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Sentiment</h2>
          <p className="text-gray-700 leading-relaxed">{rj.sentiment_summary}</p>
        </section>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link
          to={`/research/${ticker}`}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to report
        </Link>
        <h1 className="text-xl font-bold font-mono text-gray-900">{ticker}</h1>
        <span className="text-gray-500 text-sm">Version history</span>
      </div>

      {!versions || versions.length === 0 ? (
        <p className="text-gray-500 text-sm">No versions found.</p>
      ) : (
        <div className="space-y-3">
          {[...versions]
            .sort((a, b) => b.version - a.version)
            .map((v) => (
              <button
                key={v.id}
                onClick={() => setSelected(v)}
                className="w-full text-left rounded-lg border border-gray-200 bg-white px-4 py-3 hover:shadow-sm hover:border-gray-300 transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                    v{v.version}
                  </span>
                  <span className="text-sm text-gray-700">
                    {formatDate(v.created_at)}
                  </span>
                  <ScoreBadge score={v.score} size="sm" />
                </div>
                {v.diff_json?.summary && (
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    {v.diff_json.summary}
                  </p>
                )}
              </button>
            ))}
        </div>
      )}

      {versions && versions.length > 1 && (
        <div className="mt-8">
          <h2 className="text-base font-semibold text-gray-800 mb-3">
            Changelog
          </h2>
          <Changelog versions={versions} />
        </div>
      )}
    </div>
  );
}
