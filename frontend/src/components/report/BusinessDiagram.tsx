import { useRef, useCallback } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  type NodeTypes,
  type Node,
  type Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { toPng } from 'html-to-image';
import type { DiagramJson } from '../../types/report.types';

// ─── Node colours ────────────────────────────────────────────────────────────

const NODE_COLOURS: Record<string, string> = {
  revenue:       '#10b981',
  customer:      '#3b82f6',
  moat:          '#f59e0b',
  business_unit: '#8b5cf6',
  risk:          '#ef4444',
};

// ─── Custom node components ───────────────────────────────────────────────────

function RevenueNode({ data }: { data: { label: string; detail?: string } }) {
  return (
    <div
      className="rounded-lg border border-emerald-500 bg-navy-900 px-3 py-2.5 min-w-[130px] text-center
                 shadow-lg hover:shadow-emerald-500/30 transition-shadow cursor-default"
    >
      <div className="font-mono text-sm font-semibold text-emerald-400 leading-tight">
        {data.label}
      </div>
      {data.detail && (
        <div className="font-mono text-xs text-emerald-600 mt-1 leading-tight">{data.detail}</div>
      )}
    </div>
  );
}

function CustomerNode({ data }: { data: { label: string; detail?: string } }) {
  return (
    <div
      className="rounded-full border-l-4 border-blue-500 bg-navy-900 border border-blue-500/40
                 px-4 py-2 min-w-[130px] text-center
                 shadow-lg hover:shadow-blue-500/30 transition-shadow cursor-default"
    >
      <div className="font-mono text-sm font-semibold text-blue-400 leading-tight">
        {data.label}
      </div>
      {data.detail && (
        <div className="font-mono text-xs text-blue-600 mt-1 leading-tight">{data.detail}</div>
      )}
    </div>
  );
}

function MoatNode({ data }: { data: { label: string; detail?: string } }) {
  return (
    <div className="text-center cursor-default">
      <p className="font-mono text-[9px] text-amber-500/70 uppercase tracking-[0.25em] mb-1">
        Moat
      </p>
      <div
        className="rounded-lg border-2 border-amber-500 bg-navy-950 px-3 py-2.5 min-w-[130px]
                   shadow-lg hover:shadow-amber-500/30 transition-shadow"
      >
        <div className="font-mono text-sm font-semibold text-amber-400 leading-tight">
          {data.label}
        </div>
        {data.detail && (
          <div className="font-mono text-xs text-amber-600 mt-1 leading-tight">{data.detail}</div>
        )}
      </div>
    </div>
  );
}

function BusinessUnitNode({ data }: { data: { label: string; detail?: string } }) {
  return (
    <div
      className="rounded-lg border border-purple-500/40 bg-navy-900 overflow-hidden min-w-[130px]
                 shadow-lg hover:shadow-purple-500/30 transition-shadow cursor-default"
    >
      <div className="h-1 bg-purple-500 w-full" />
      <div className="px-3 py-2.5 text-center">
        <div className="font-mono text-sm font-semibold text-purple-400 leading-tight">
          {data.label}
        </div>
        {data.detail && (
          <div className="font-mono text-xs text-purple-600 mt-1 leading-tight">{data.detail}</div>
        )}
      </div>
    </div>
  );
}

function RiskNode({ data }: { data: { label: string; detail?: string } }) {
  return (
    <div
      className="rounded-lg border border-red-500/40 border-l-4 border-l-red-500 bg-red-950/20
                 px-3 py-2.5 min-w-[130px]
                 shadow-lg hover:shadow-red-500/20 transition-shadow cursor-default"
    >
      <div className="flex items-start gap-1.5">
        <svg className="h-3.5 w-3.5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        <div>
          <div className="font-mono text-sm font-semibold text-red-400 leading-tight">
            {data.label}
          </div>
          {data.detail && (
            <div className="font-mono text-xs text-red-600 mt-1 leading-tight">{data.detail}</div>
          )}
        </div>
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  revenue:       RevenueNode,
  customer:      CustomerNode,
  moat:          MoatNode,
  business_unit: BusinessUnitNode,
  risk:          RiskNode,
};

// ─── Edge colour by source node type ────────────────────────────────────────

function edgeColour(nodeType: string | undefined): string {
  return NODE_COLOURS[nodeType ?? ''] ?? '#5a7aa8';
}

// ─── Main component ───────────────────────────────────────────────────────────

interface BusinessDiagramProps {
  diagram: DiagramJson;
}

function DiagramInner({ diagram }: BusinessDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Build a lookup of node id → type for edge colouring
  const nodeTypeMap: Record<string, string> = {};
  for (const n of diagram.nodes) {
    nodeTypeMap[n.id] = n.type;
  }

  const initialNodes: Node[] = diagram.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    data: n.data,
    position: n.position,
  }));

  const initialEdges: Edge[] = diagram.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    type: 'smoothstep',
    animated: true,
    style: { stroke: edgeColour(nodeTypeMap[e.source]), strokeWidth: 1.5, opacity: 0.7 },
    labelStyle: { fill: '#b8b0a0', fontSize: 10, fontFamily: '"JetBrains Mono", monospace' },
    labelBgStyle: { fill: '#0f1729', fillOpacity: 0.8 },
  }));

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const handleExport = useCallback(() => {
    if (!containerRef.current) return;
    void toPng(containerRef.current, { quality: 1 }).then((dataUrl) => {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'business-diagram.png';
      a.click();
    });
  }, []);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="w-full rounded-xl overflow-hidden border border-navy-700"
        style={{ height: 500, background: '#0f1729' }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          panOnScroll={false}
          zoomOnPinch
          panOnDrag
          style={{ background: '#0f1729' }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            color="#1e2d47"
            gap={20}
            size={1}
          />
          <Controls
            style={{ background: '#162035', borderColor: '#1e2d47', color: '#b8b0a0' }}
          />
        </ReactFlow>
      </div>

      {/* Export button */}
      <button
        onClick={handleExport}
        className="absolute bottom-4 right-4 rounded-full border border-gold/60 text-gold text-xs font-mono px-4 py-1.5
                   hover:bg-gold hover:text-navy-950 transition-colors z-10"
        aria-label="Export diagram as PNG"
      >
        Export PNG
      </button>
    </div>
  );
}

export default function BusinessDiagram({ diagram }: BusinessDiagramProps) {
  return (
    <ReactFlowProvider>
      <DiagramInner diagram={diagram} />
    </ReactFlowProvider>
  );
}
