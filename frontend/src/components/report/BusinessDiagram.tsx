import { useRef, useCallback } from 'react';
import { toPng } from 'html-to-image';
import type { DiagramJson, DiagramNode } from '../../types/report.types';

// ─── Zone helpers ─────────────────────────────────────────────────────────────

function nodesByType(nodes: DiagramNode[], type: string): DiagramNode[] {
  return nodes.filter((n) => n.type === type);
}

// ─── Zone 1: Moat chips ───────────────────────────────────────────────────────

function MoatZone({ nodes }: { nodes: DiagramNode[] }) {
  if (nodes.length === 0) return null;
  return (
    <div className="rounded-xl border border-gold/50 bg-amber-950/30 px-4 py-4">
      <p className="font-mono text-[10px] text-gold/60 uppercase tracking-[0.25em] mb-3">
        The Moat
      </p>
      <div className="flex flex-wrap gap-2">
        {nodes.map((n) => (
          <div
            key={n.id}
            className="rounded-lg border border-gold/40 bg-navy-950 px-3 py-2 max-w-xs"
          >
            <p className="font-body text-base font-semibold text-amber-400 leading-tight">
              {n.data.label}
            </p>
            {n.data.detail && (
              <p className="font-body text-sm text-amber-600/80 mt-1 leading-snug">
                {n.data.detail}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Arrow divider ────────────────────────────────────────────────────────────

function ArrowDivider({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 py-1 select-none">
      <div className="w-px h-4 bg-navy-600" />
      <span className="font-mono text-[10px] text-cream-subtle tracking-wide">{label}</span>
      <svg
        className="h-3 w-3 text-navy-600"
        fill="currentColor"
        viewBox="0 0 10 10"
        aria-hidden="true"
      >
        <polygon points="5,10 0,0 10,0" />
      </svg>
    </div>
  );
}

// ─── Zone 2: Business (3 columns) ────────────────────────────────────────────

function BusinessZone({
  units,
  revenues,
  products,
}: {
  units: DiagramNode[];
  revenues: DiagramNode[];
  products: DiagramNode[];
}) {
  return (
    <div className="rounded-xl border border-navy-600 bg-navy-950 px-4 py-4">
      <div className="grid grid-cols-3 gap-3">
        {/* Business Units */}
        <div>
          <p className="font-mono text-[10px] text-purple-400/70 uppercase tracking-[0.2em] mb-2">
            Business Units
          </p>
          <div className="space-y-2">
            {units.length > 0 ? units.map((n) => (
              <div
                key={n.id}
                className="rounded-lg border border-purple-500/30 bg-navy-800 overflow-hidden"
              >
                <div className="h-0.5 bg-purple-500" />
                <div className="px-2.5 py-2">
                  <p className="font-body text-base font-semibold text-purple-400 leading-tight">
                    {n.data.label}
                  </p>
                  {n.data.detail && (
                    <p className="font-body text-sm text-purple-600/80 mt-1 leading-snug">
                      {n.data.detail}
                    </p>
                  )}
                </div>
              </div>
            )) : (
              <p className="text-xs text-cream-subtle italic font-body">—</p>
            )}
          </div>
        </div>

        {/* Revenue Streams */}
        <div>
          <p className="font-mono text-[10px] text-emerald-400/70 uppercase tracking-[0.2em] mb-2">
            Revenue Streams
          </p>
          <div className="space-y-2">
            {revenues.length > 0 ? revenues.map((n) => (
              <div
                key={n.id}
                className="rounded-lg border border-emerald-500/40 bg-navy-800 px-2.5 py-2"
              >
                <p className="font-body text-base font-semibold text-emerald-400 leading-tight">
                  {n.data.label}
                </p>
                {n.data.detail && (
                  <p className="font-body text-sm text-emerald-600/80 mt-1 leading-snug">
                    {n.data.detail}
                  </p>
                )}
              </div>
            )) : (
              <p className="text-xs text-cream-subtle italic font-body">—</p>
            )}
          </div>
        </div>

        {/* Key Products / other nodes */}
        <div>
          <p className="font-mono text-[10px] text-blue-400/70 uppercase tracking-[0.2em] mb-2">
            Key Products
          </p>
          <div className="space-y-2">
            {products.length > 0 ? products.map((n) => (
              <div
                key={n.id}
                className="rounded-lg border border-blue-500/30 border-l-2 border-l-blue-500 bg-navy-800 px-2.5 py-2"
              >
                <p className="font-body text-base font-semibold text-blue-400 leading-tight">
                  {n.data.label}
                </p>
                {n.data.detail && (
                  <p className="font-body text-sm text-blue-600/80 mt-1 leading-snug">
                    {n.data.detail}
                  </p>
                )}
              </div>
            )) : (
              <p className="text-xs text-cream-subtle italic font-body">—</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Zone 3: Customers ────────────────────────────────────────────────────────

function CustomerZone({ nodes }: { nodes: DiagramNode[] }) {
  if (nodes.length === 0) return null;
  return (
    <div className="rounded-xl border border-navy-600 bg-navy-900 px-4 py-4">
      <p className="font-mono text-[10px] text-blue-400/60 uppercase tracking-[0.25em] mb-3">
        Customers &amp; End Markets
      </p>
      <div className="flex flex-wrap gap-2">
        {nodes.map((n) => (
          <div
            key={n.id}
            className="rounded-full border border-blue-500/40 bg-navy-800 px-3 py-1.5"
          >
            <p className="font-body text-base font-semibold text-blue-400 leading-tight">
              {n.data.label}
            </p>
            {n.data.detail && (
              <p className="font-body text-sm text-blue-600/70 leading-snug">
                {n.data.detail}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Zone 4: Risks ────────────────────────────────────────────────────────────

function RiskZone({ nodes }: { nodes: DiagramNode[] }) {
  if (nodes.length === 0) return null;
  return (
    <div className="rounded-xl border border-red-900/50 bg-red-950/20 px-4 py-4">
      <p className="font-mono text-[10px] text-red-400/60 uppercase tracking-[0.25em] mb-3">
        Key Risks
      </p>
      <div className="flex flex-wrap gap-2">
        {nodes.map((n) => (
          <div
            key={n.id}
            className="rounded-lg border border-red-500/30 border-l-2 border-l-red-500 bg-navy-900 px-3 py-2"
          >
            <div className="flex items-start gap-1.5">
              <svg
                className="h-3 w-3 text-red-400 flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                />
              </svg>
              <div>
                <p className="font-body text-base font-semibold text-red-400 leading-tight">
                  {n.data.label}
                </p>
                {n.data.detail && (
                  <p className="font-body text-sm text-red-600/80 mt-0.5 leading-snug">
                    {n.data.detail}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface BusinessDiagramProps {
  diagram: DiagramJson;
}

export default function BusinessDiagram({ diagram }: BusinessDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const moatNodes     = nodesByType(diagram.nodes, 'moat');
  const unitNodes     = nodesByType(diagram.nodes, 'business_unit');
  const revenueNodes  = nodesByType(diagram.nodes, 'revenue');
  const customerNodes = nodesByType(diagram.nodes, 'customer');
  const riskNodes     = nodesByType(diagram.nodes, 'risk');
  // Any type not in the four known zones goes into "Key Products"
  const known = new Set(['moat', 'business_unit', 'revenue', 'customer', 'risk']);
  const productNodes = diagram.nodes.filter((n) => !known.has(n.type));

  const handleExport = useCallback(() => {
    if (!containerRef.current) return;
    void toPng(containerRef.current, { quality: 1 }).then((dataUrl) => {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'business-model.png';
      a.click();
    });
  }, []);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="rounded-xl border border-navy-700 bg-navy-900 p-4 space-y-2 min-h-[400px]"
      >
        <MoatZone nodes={moatNodes} />

        {moatNodes.length > 0 && <ArrowDivider label="protects" />}

        <BusinessZone
          units={unitNodes}
          revenues={revenueNodes}
          products={productNodes}
        />

        <ArrowDivider label="serves" />

        <CustomerZone nodes={customerNodes} />

        {riskNodes.length > 0 && (
          <>
            <div className="pt-1" />
            <RiskZone nodes={riskNodes} />
          </>
        )}
      </div>

      <button
        onClick={handleExport}
        className="absolute bottom-6 right-6 rounded-full border border-gold/60 text-gold text-xs font-mono
                   px-4 py-1.5 hover:bg-gold hover:text-navy-950 transition-colors bg-navy-900/80"
        aria-label="Export diagram as PNG"
      >
        Export PNG
      </button>
    </div>
  );
}
