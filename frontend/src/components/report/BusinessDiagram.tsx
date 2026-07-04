import { useRef, useCallback } from "react";
import { toPng } from "html-to-image";
import type { DiagramJson, DiagramNode } from "../../types/report.types";

// ─── Zone helpers ─────────────────────────────────────────────────────────────

function nodesByType(nodes: DiagramNode[], type: string): DiagramNode[] {
  return nodes.filter((n) => n.type === type);
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ShieldIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"
      />
    </svg>
  );
}

function BuildingIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M4 21V7l8-4 8 4v14M4 21h16M9 21v-6h6v6M9 11h.01M15 11h.01M9 7h.01M15 7h.01"
      />
    </svg>
  );
}

function DollarIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 3v18M16 7.5c0-1.66-1.79-3-4-3s-4 1.34-4 3 1.79 3 4 3 4 1.34 4 3-1.79 3-4 3-4-1.34-4-3"
      />
    </svg>
  );
}

function PeopleIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M17 20v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M15 8a3 3 0 11-6 0 3 3 0 016 0zM21 20v-1a4 4 0 00-3-3.87M16 4.13a4 4 0 010 7.75"
      />
    </svg>
  );
}

function WarningIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
      />
    </svg>
  );
}

// ─── Zone 1: Moat chips ───────────────────────────────────────────────────────

function MoatZone({ nodes }: { nodes: DiagramNode[] }) {
  if (nodes.length === 0) return null;
  return (
    <div className="rounded-xl border border-gold/50 bg-amber-950/30 px-4 py-4">
      <p className="flex items-center gap-1.5 font-mono text-[10px] text-gold/60 uppercase tracking-[0.25em] mb-3">
        <ShieldIcon className="h-3.5 w-3.5" />
        The Moat
      </p>
      <div className="flex flex-wrap gap-2">
        {nodes.map((n) => (
          <div
            key={n.id}
            className="rounded-lg border border-gold/40 bg-navy-950 px-3 py-2 max-w-xs flex gap-2"
          >
            <ShieldIcon className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-body text-base font-semibold text-amber-400 leading-tight">
                {n.data.label}
              </p>
              {n.data.detail && (
                <p className="font-body text-sm text-amber-600/80 mt-1 leading-snug">
                  {n.data.detail}
                </p>
              )}
            </div>
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
      <div className="w-px h-4 bg-gradient-to-b from-navy-600 to-purple/40" />
      <span className="font-mono text-[10px] text-purple-light/80 tracking-wide">
        {label}
      </span>
      <svg
        className="h-3 w-3 text-purple/60"
        fill="currentColor"
        viewBox="0 0 10 10"
        aria-hidden="true"
      >
        <polygon points="5,10 0,0 10,0" />
      </svg>
    </div>
  );
}

// ─── Zone 2: Business (2 columns — units + revenue) ──────────────────────────

function BusinessZone({
  units,
  revenues,
}: {
  units: DiagramNode[];
  revenues: DiagramNode[];
}) {
  return (
    <div className="rounded-xl border border-navy-600 bg-navy-950 px-4 py-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Business Units */}
        <div>
          <p className="flex items-center gap-1.5 font-mono text-[10px] text-purple-400/70 uppercase tracking-[0.2em] mb-2">
            <BuildingIcon className="h-3.5 w-3.5" />
            Business Units
          </p>
          <div className="space-y-2">
            {units.length > 0 ? (
              units.map((n) => (
                <div
                  key={n.id}
                  className="rounded-lg border border-purple-500/30 bg-navy-800 overflow-hidden"
                >
                  <div className="h-0.5 bg-purple-500" />
                  <div className="px-2.5 py-2 flex gap-2">
                    <BuildingIcon className="h-4 w-4 text-purple-400 flex-shrink-0 mt-0.5" />
                    <div>
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
                </div>
              ))
            ) : (
              <p className="text-xs text-cream-subtle italic font-body">—</p>
            )}
          </div>
        </div>

        {/* Revenue Streams */}
        <div>
          <p className="flex items-center gap-1.5 font-mono text-[10px] text-emerald-400/70 uppercase tracking-[0.2em] mb-2">
            <DollarIcon className="h-3.5 w-3.5" />
            Revenue Streams
          </p>
          <div className="space-y-2">
            {revenues.length > 0 ? (
              revenues.map((n) => (
                <div
                  key={n.id}
                  className="rounded-lg border border-emerald-500/40 bg-navy-800 px-2.5 py-2 flex gap-2"
                >
                  <DollarIcon className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-body text-base font-semibold text-emerald-400 leading-tight">
                      {n.data.label}
                    </p>
                    {n.data.detail && (
                      <p className="font-body text-sm text-emerald-600/80 mt-1 leading-snug">
                        {n.data.detail}
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
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
      <p className="flex items-center gap-1.5 font-mono text-[10px] text-blue-400/60 uppercase tracking-[0.25em] mb-3">
        <PeopleIcon className="h-3.5 w-3.5" />
        Customers &amp; End Markets
      </p>
      <div className="flex flex-wrap gap-2">
        {nodes.map((n) => (
          <div
            key={n.id}
            className="rounded-lg border border-blue-500/40 bg-navy-800 px-2.5 py-2 flex gap-2"
          >
            <PeopleIcon className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-body text-base font-semibold text-blue-400 leading-tight">
                {n.data.label}
              </p>
              {n.data.detail && (
                <p className="font-body text-sm text-blue-600/80 mt-1 leading-snug">
                  {n.data.detail}
                </p>
              )}
            </div>
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
    <div className="rounded-xl border-l-4 border-red-500 bg-navy-900 px-4 py-4">
      <p className="flex items-center gap-1.5 font-mono text-[10px] text-red-400 uppercase tracking-widest mb-3">
        <WarningIcon className="h-3.5 w-3.5" />
        Key Risks
      </p>
      <div className="flex flex-wrap gap-2">
        {nodes.map((n) => (
          <div
            key={n.id}
            className="rounded-r border-l-2 border-red-500 bg-navy-800 px-3 py-2"
          >
            <div className="flex items-start gap-1.5">
              <WarningIcon className="h-3 w-3 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-body text-sm font-semibold text-white leading-tight">
                  {n.data.label}
                </p>
                {n.data.detail && (
                  <p className="font-body text-sm text-slate-300 font-light mt-0.5 leading-snug">
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
  diagram: DiagramJson | null | undefined;
}

export default function BusinessDiagram({ diagram }: BusinessDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const safeNodes = diagram?.nodes ?? [];
  const moatNodes = nodesByType(safeNodes, "moat");
  const revenueNodes = nodesByType(safeNodes, "revenue");
  const customerNodes = nodesByType(safeNodes, "customer");
  const riskNodes = nodesByType(safeNodes, "risk");
  // Business Units column also absorbs any node with an unrecognised type —
  // the diagram schema has no distinct "product" type, so this only ever
  // catches malformed/hallucinated node types rather than dropping data.
  const known = new Set(["moat", "revenue", "customer", "risk"]);
  const unitNodes = safeNodes.filter(
    (n) => n.type === "business_unit" || !known.has(n.type),
  );

  const handleExport = useCallback(() => {
    if (!containerRef.current) return;
    void toPng(containerRef.current, { quality: 1 }).then((dataUrl) => {
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "business-model.png";
      a.click();
    });
  }, []);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="rounded-xl border border-navy-700 bg-navy-900 p-4 space-y-2 min-h-[400px] max-w-full"
      >
        <MoatZone nodes={moatNodes} />

        {moatNodes.length > 0 && <ArrowDivider label="protects" />}

        <BusinessZone units={unitNodes} revenues={revenueNodes} />

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
