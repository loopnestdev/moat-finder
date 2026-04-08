import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { useReport, useVersions } from '../hooks/useResearch';
import { usePipeline } from '../hooks/usePipeline';
import ScoreBadge from '../components/report/ScoreBadge';
import SectorHeat from '../components/report/SectorHeat';
import ValuationTable from '../components/report/ValuationTable';
import NapkinMath from '../components/report/NapkinMath';
import BearCase from '../components/report/BearCase';
import Changelog from '../components/report/Changelog';
import BusinessDiagram from '../components/report/BusinessDiagram';
import PipelineProgress from '../components/research/PipelineProgress';
import DiffModal from '../components/research/DiffModal';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import type { DiffJson } from '../types/report.types';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function Report() {
  const { ticker = '' } = useParams<{ ticker: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isApproved, isAdmin } = useAuth();
  const pipeline = usePipeline();

  const { data: report, isLoading, error } = useReport(ticker);
  const { data: versions = [] } = useVersions(ticker);

  const [showDiff, setShowDiff] = useState(false);
  const [pendingDiff, setPendingDiff] = useState<DiffJson | null>(null);
  const [isUpdateRunning, setIsUpdateRunning] = useState(false);

  const handleUpdate = async () => {
    setIsUpdateRunning(true);
    const completed = await pipeline.updateResearch(ticker);
    const lastStep = completed[completed.length - 1];
    const diff = lastStep?.data?.diff_summary as DiffJson | undefined;
    setPendingDiff(diff ?? null);
    setShowDiff(true);
  };

  const handleDiffConfirm = () => {
    setShowDiff(false);
    setIsUpdateRunning(false);
    void queryClient.invalidateQueries({ queryKey: ['research', ticker] });
    void queryClient.invalidateQueries({ queryKey: ['research', ticker, 'versions'] });
    void queryClient.invalidateQueries({ queryKey: ['research'] });
  };

  const handleDiffDiscard = () => {
    setShowDiff(false);
    setIsUpdateRunning(false);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error ?? !report) {
    void navigate('/');
    return null;
  }

  const rj = report.report_json;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold font-mono text-gray-900">
              {report.ticker_symbol}
            </h1>
            <ScoreBadge score={report.score} size="lg" />
          </div>
          {report.tickers?.company_name && (
            <p className="text-lg text-gray-600">{report.tickers.company_name}</p>
          )}
          <p className="text-sm text-gray-400 mt-1">
            Version {report.version} · Last updated {formatDate(report.updated_at)}
          </p>
          <Link
            to={`/research/${ticker}/versions`}
            className="text-xs text-blue-600 hover:underline"
          >
            View version history
          </Link>
        </div>
        {isApproved && !isUpdateRunning && (
          <Button variant="secondary" onClick={() => { void handleUpdate(); }}>
            Update Research
          </Button>
        )}
      </div>

      {/* Pipeline overlay when updating */}
      {isUpdateRunning && (
        <PipelineProgress
          steps={pipeline.steps}
          isRunning={pipeline.isRunning}
          error={pipeline.error}
          isAdmin={isAdmin}
        />
      )}

      {/* One-liner thesis */}
      <div className="text-xl font-semibold text-gray-900 leading-snug border-l-4 border-blue-500 pl-4">
        {rj.thesis}
      </div>

      {/* Business Model Diagram */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          Business Model
        </h2>
        <BusinessDiagram diagram={report.diagram_json} />
      </section>

      {/* Sector Heat */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          Sector Heat Check
        </h2>
        <SectorHeat heat={rj.sector_heat} sectors={rj.hot_sector_match} />
      </section>

      {/* Business Model Narrative */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-2">
          Business Model
        </h2>
        <p className="text-gray-700 leading-relaxed">{rj.business_model}</p>
      </section>

      {/* Catalysts */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-2">
          Why Now — Catalysts
        </h2>
        <ul className="space-y-2">
          {rj.catalysts.map((c, i) => (
            <li key={i} className="flex gap-2 text-gray-700">
              <span className="text-blue-500 flex-shrink-0 mt-0.5">→</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Valuation Table */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          Valuation vs Peers
        </h2>
        <ValuationTable rows={rj.valuation_table} ticker={ticker} />
      </section>

      {/* Napkin Math */}
      <section>
        <NapkinMath data={rj.napkin_math} />
      </section>

      {/* Moat & Competitors */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-2">
          Moat &amp; Competitors
        </h2>
        <p className="text-gray-700 leading-relaxed mb-3">{rj.moat}</p>
        {rj.competitors.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {rj.competitors.map((c) => (
              <span
                key={c.ticker}
                className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded-full font-mono"
              >
                {c.ticker}
                <span className="font-sans text-gray-500 ml-1">— {c.name}</span>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Bear Case */}
      <section>
        <BearCase
          bearCase={rj.bear_case}
          riskFactors={rj.risk_factors ?? []}
        />
      </section>

      {/* Macro */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-2">
          Macro &amp; Policy
        </h2>
        <p className="text-gray-700 leading-relaxed">{rj.macro_summary}</p>
      </section>

      {/* Sentiment */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-2">
          Sentiment &amp; Technicals
        </h2>
        <p className="text-gray-700 leading-relaxed">{rj.sentiment_summary}</p>
      </section>

      {/* Changelog */}
      {versions.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            Version History
          </h2>
          <Changelog versions={versions} />
        </section>
      )}

      {/* Diff modal */}
      <DiffModal
        isOpen={showDiff}
        onClose={handleDiffDiscard}
        onConfirm={handleDiffConfirm}
        diff={pendingDiff}
        isLoading={false}
      />
    </div>
  );
}
