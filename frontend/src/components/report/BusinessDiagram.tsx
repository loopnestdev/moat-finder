import { useRef, useCallback } from 'react';
import ReactFlow, {
  Background,
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

// ─── Custom node components ───────────────────────────────────────────────────

const nodeBaseClass =
  'px-3 py-2 rounded-lg border-2 text-sm font-medium shadow-sm min-w-[120px] text-center';

function RevenueNode({ data }: { data: { label: string; detail?: string } }) {
  return (
    <div className={`${nodeBaseClass} bg-emerald-100 border-emerald-400 text-emerald-900`}>
      <div>{data.label}</div>
      {data.detail && <div className="text-xs font-normal mt-0.5 opacity-75">{data.detail}</div>}
    </div>
  );
}

function CustomerNode({ data }: { data: { label: string; detail?: string } }) {
  return (
    <div className={`${nodeBaseClass} bg-blue-100 border-blue-400 text-blue-900`}>
      <div>{data.label}</div>
      {data.detail && <div className="text-xs font-normal mt-0.5 opacity-75">{data.detail}</div>}
    </div>
  );
}

function MoatNode({ data }: { data: { label: string; detail?: string } }) {
  return (
    <div className={`${nodeBaseClass} bg-orange-100 border-orange-400 text-orange-900`}>
      <div>{data.label}</div>
      {data.detail && <div className="text-xs font-normal mt-0.5 opacity-75">{data.detail}</div>}
    </div>
  );
}

function BusinessUnitNode({ data }: { data: { label: string; detail?: string } }) {
  return (
    <div className={`${nodeBaseClass} bg-purple-100 border-purple-400 text-purple-900`}>
      <div>{data.label}</div>
      {data.detail && <div className="text-xs font-normal mt-0.5 opacity-75">{data.detail}</div>}
    </div>
  );
}

function RiskNode({ data }: { data: { label: string; detail?: string } }) {
  return (
    <div className={`${nodeBaseClass} bg-red-100 border-red-400 text-red-900`}>
      <div>{data.label}</div>
      {data.detail && <div className="text-xs font-normal mt-0.5 opacity-75">{data.detail}</div>}
    </div>
  );
}

const nodeTypes: NodeTypes = {
  revenue: RevenueNode,
  customer: CustomerNode,
  moat: MoatNode,
  business_unit: BusinessUnitNode,
  risk: RiskNode,
};

// ─── Main component ───────────────────────────────────────────────────────────

interface BusinessDiagramProps {
  diagram: DiagramJson;
}

function DiagramInner({ diagram }: BusinessDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);

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
    animated: false,
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
        className="w-full rounded-lg border border-gray-200 overflow-hidden"
        style={{ height: 400 }}
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
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
      <button
        onClick={handleExport}
        className="mt-2 text-xs text-gray-500 hover:text-gray-700 underline"
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
