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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Parse a paragraph into numbered segments.
 * Tries "(1) …" / "1. …" patterns first; falls back to single-item array.
 */
function parseNumberedList(text: string): string[] {
  // Pattern: (1) or (2) … anywhere in the string
  const byParen = text.split(/\s*\(\d+\)\s*/).filter(Boolean);
  if (byParen.length >= 2) return byParen;

  // Pattern: standalone "1. " / "2. " at start of segment
  const byDot = text.split(/(?:^|\s)\d+\.\s+/).filter(Boolean);
  if (byDot.length >= 2) return byDot;

  return [text];
}

/**
 * Parse a paragraph into labelled bullets.
 * Sentences containing a colon get the pre-colon text treated as a bold label.
 * Otherwise the text is split by ". " into plain bullets.
 */
function parseBullets(text: string): Array<{ label: string | null; body: string }> {
  // Split into sentences on ". " followed by a capital letter
  const sentences = text.split(/\.\s+(?=[A-Z])/).filter(Boolean);

  const bullets = sentences.map((s) => {
    const colonIdx = s.indexOf(':');
    if (colonIdx > 0 && colonIdx < 60) {
      return { label: s.slice(0, colonIdx).trim(), body: s.slice(colonIdx + 1).trim() };
    }
    return { label: null, body: s.replace(/\.$/, '').trim() };
  });

  return bullets.filter((b) => b.body.length > 0);
}

// ─── Shared UI pieces ─────────────────────────────────────────────────────────

/** Decorative gold-border section heading */
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-xl font-semibold text-cream border-l-2 border-gold pl-3 mb-4 leading-snug">
      {children}
    </h2>
  );
}

/** Renders a parsed numbered list as gold-accented rows */
function NumberedSegments({ items }: { items: string[] }) {
  // Single item → just a paragraph
  if (items.length === 1) {
    return <p className="font-body text-cream-muted leading-relaxed">{items[0]}</p>;
  }
  return (
    <ol className="space-y-4">
      {items.map((item, i) => {
        // Split on the first " — " or " - " to separate a segment name from its description
        const dashMatch = item.match(/^([^—\-]{3,50})\s*[—\-]\s*(.+)$/s);
        return (
          <li key={i} className="flex gap-4 border-l-2 border-gold/30 pl-4 py-1">
            <span className="font-mono text-lg font-bold text-gold/40 flex-shrink-0 w-7 leading-tight">
              {String(i + 1).padStart(2, '0')}
            </span>
            <p className="font-body text-cream-muted leading-relaxed">
              {dashMatch ? (
                <>
                  <span className="text-cream font-semibold">{dashMatch[1].trim()}</span>
                  {' — '}
                  {dashMatch[2].trim()}
                </>
              ) : (
                item
              )}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

/** Renders parsed bullets with gold dot and optional bold label */
function BulletList({ bullets }: { bullets: Array<{ label: string | null; body: string }> }) {
  if (bullets.length <= 1) {
    // Fall back to paragraph if parsing didn't produce meaningful bullets
    const text = bullets[0] ? (bullets[0].label ? `${bullets[0].label}: ${bullets[0].body}` : bullets[0].body) : '';
    return <p className="font-body text-cream-muted leading-relaxed">{text}</p>;
  }
  return (
    <ul className="space-y-3">
      {bullets.map((b, i) => (
        <li key={i} className="flex gap-3">
          <span className="text-gold font-bold flex-shrink-0 mt-0.5 leading-tight">•</span>
          <p className="font-body text-cream-muted leading-relaxed">
            {b.label ? (
              <>
                <span className="text-cream font-semibold">{b.label}:</span>
                {' '}
                {b.body}
              </>
            ) : (
              b.body
            )}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** Renders moat pillars as dark cards */
function MoatPillars({ items, fallback }: { items: string[]; fallback: string }) {
  if (items.length <= 1) {
    return <p className="font-body text-cream-muted leading-relaxed">{fallback}</p>;
  }
  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const dashMatch = item.match(/^([^—\-]{3,60})\s*[—\-]\s*(.+)$/s);
        return (
          <div key={i} className="rounded-lg bg-navy-800 border border-navy-600 p-4">
            <div className="flex gap-3">
              <span className="font-mono text-sm font-bold text-gold/50 flex-shrink-0 w-6 leading-tight">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div>
                {dashMatch ? (
                  <>
                    <p className="font-body font-semibold text-cream mb-1">
                      {dashMatch[1].trim()}
                    </p>
                    <p className="font-body text-cream-muted text-sm leading-relaxed">
                      {dashMatch[2].trim()}
                    </p>
                  </>
                ) : (
                  <p className="font-body text-cream-muted leading-relaxed">{item}</p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

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

  // Pre-parse text fields
  const businessModelSegments = parseNumberedList(rj.business_model);
  const moatPillars = parseNumberedList(rj.moat);
  const macroBullets = parseBullets(rj.macro_summary);
  const sentimentBullets = parseBullets(rj.sentiment_summary);

  return (
    <div className="space-y-0">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-navy-950 border border-navy-700 px-6 py-8 sm:px-10 sm:py-10 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-start gap-6">
          {/* Left: ticker + company + thesis */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="font-mono text-4xl font-bold text-gold tracking-tight leading-none">
                {report.ticker_symbol}
              </h1>
              {report.tickers?.company_name && (
                <span className="font-display text-lg text-cream-muted leading-tight">
                  {report.tickers.company_name}
                </span>
              )}
            </div>
            <p className="font-mono text-xs text-cream-subtle mt-2 mb-4">
              v{report.version} · {formatDate(report.updated_at)}
              {' · '}
              <Link
                to={`/research/${ticker}/versions`}
                className="text-gold/70 hover:text-gold transition-colors underline underline-offset-2"
              >
                version history
              </Link>
            </p>
            {/* Thesis callout */}
            <p className="font-body italic text-cream/90 text-lg leading-relaxed border-l-2 border-gold/40 pl-4">
              {rj.thesis}
            </p>
          </div>

          {/* Right: score + heat + update button */}
          <div className="flex flex-col items-end gap-4 flex-shrink-0">
            <ScoreBadge score={report.score} size="lg" />
            <SectorHeat heat={rj.sector_heat} sectors={rj.hot_sector_match} />
            {isApproved && !isUpdateRunning && (
              <Button
                variant="secondary"
                onClick={() => { void handleUpdate(); }}
                className="!bg-transparent !text-amber-400 border border-amber-400 hover:!bg-amber-400 hover:!text-navy-950 font-body font-medium tracking-wide px-6 py-2.5 rounded-md transition-all duration-200"
              >
                Update Research
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Pipeline overlay when updating */}
      {isUpdateRunning && (
        <div className="mb-8">
          <PipelineProgress
            steps={pipeline.steps}
            isRunning={pipeline.isRunning}
            error={pipeline.error}
            isAdmin={isAdmin}
          />
        </div>
      )}

      {/* ── Two-column body ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8 items-start">

        {/* ── Left column — narrative ─────────────────────────────────────── */}
        <div className="space-y-10 min-w-0">

          {/* Fix 1: Business Model Canvas (pure React) */}
          <section>
            <SectionHeading>Business Model</SectionHeading>
            <BusinessDiagram diagram={report.diagram_json} />
          </section>

          {/* Fix 2: How It Makes Money — numbered segments */}
          <section>
            <SectionHeading>How It Makes Money</SectionHeading>
            <NumberedSegments items={businessModelSegments} />
          </section>

          {/* Catalysts */}
          <section>
            <SectionHeading>Why Now — Catalysts</SectionHeading>
            <ol className="space-y-5">
              {rj.catalysts.map((c, i) => (
                <li key={i} className="flex gap-4">
                  <span className="font-mono text-2xl font-bold text-gold/40 flex-shrink-0 leading-tight w-8">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="font-body text-cream-muted leading-relaxed">{c}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* Fix 3: Moat — parsed pillars */}
          <section>
            <SectionHeading>Moat &amp; Competitors</SectionHeading>
            <div className="mb-5">
              <MoatPillars items={moatPillars} fallback={rj.moat} />
            </div>
            {rj.competitors.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {rj.competitors.map((c) => (
                  <span
                    key={c.ticker}
                    className="text-sm border border-navy-600 bg-navy-800 rounded-full px-3 py-1"
                  >
                    <span className="font-mono text-gold">{c.ticker}</span>
                    <span className="font-body text-cream-subtle ml-1.5">— {c.name}</span>
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Bear Case */}
          <section>
            <SectionHeading>Bear Case</SectionHeading>
            <BearCase bearCase={rj.bear_case} riskFactors={rj.risk_factors ?? []} />
          </section>

          {/* Fix 4a: Macro — bullet list */}
          <section>
            <SectionHeading>Macro &amp; Policy</SectionHeading>
            <BulletList bullets={macroBullets} />
          </section>

          {/* Fix 4b: Sentiment — bullet list */}
          <section>
            <SectionHeading>Sentiment &amp; Technicals</SectionHeading>
            <BulletList bullets={sentimentBullets} />
          </section>

          {/* Changelog */}
          {versions.length > 0 && (
            <section>
              <SectionHeading>Version History</SectionHeading>
              <Changelog versions={versions} />
            </section>
          )}
        </div>

        {/* ── Right column — data cards ────────────────────────────────────── */}
        <div className="space-y-6 lg:sticky lg:top-6">

          {/* Fix 5: NapkinMath with hierarchical revenue guidance */}
          <NapkinMath data={rj.napkin_math} />

          {/* Fix 6: ValuationTable card grid */}
          <div className="rounded-xl bg-navy-800 border border-navy-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-navy-700">
              <p className="font-mono text-xs text-gold/70 uppercase tracking-[0.2em]">
                Valuation vs Peers
              </p>
            </div>
            <div className="p-3">
              <ValuationTable rows={rj.valuation_table} ticker={ticker} />
            </div>
          </div>

          {/* Sector Heat card */}
          <div className="rounded-xl bg-navy-800 border border-navy-700 px-4 py-4">
            <p className="font-mono text-xs text-gold/70 uppercase tracking-[0.2em] mb-3">
              Sector Heat
            </p>
            <SectorHeat heat={rj.sector_heat} sectors={rj.hot_sector_match} />
          </div>
        </div>
      </div>

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
