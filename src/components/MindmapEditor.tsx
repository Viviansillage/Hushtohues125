import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  useEdgesState,
  useNodesState
} from 'reactflow';
import 'reactflow/dist/style.css';
import { MindmapJson, MindmapNode, MindmapEdge } from '../lib/mindmap';

type MindmapEditorProps = {
  value: MindmapJson;
  onChange?: (value: MindmapJson) => void;
  readOnly?: boolean;
  height?: number;
  className?: string;
};

const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));

export const MindmapEditor = ({ value, onChange, readOnly = false, height = 280, className }: MindmapEditorProps) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<MindmapNode>(value.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState<MindmapEdge>(value.edges || []);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    setNodes(value.nodes || []);
    setEdges(value.edges || []);
  }, [value.nodes, value.edges, setNodes, setEdges]);

  useEffect(() => {
    if (!onChange) return;
    onChange({ nodes, edges });
  }, [nodes, edges, onChange]);

  const onConnect = useCallback(
    (params: any) => {
      if (readOnly) return;
      setEdges((eds) =>
        addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed } }, eds)
      );
    },
    [readOnly, setEdges]
  );

  const handleNodeDoubleClick = useCallback(
    (_event: any, node: any) => {
      if (readOnly) return;
      const currentLabel = node.data?.label || '';
      const nextLabel = window.prompt('Edit node label', currentLabel);
      if (nextLabel === null) return;
      setNodes((nds) =>
        nds.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, label: nextLabel } } : n))
      );
    },
    [readOnly, setNodes]
  );

  const handleAddNode = useCallback(() => {
    if (readOnly) return;
    const id = `mm-${Date.now()}`;
    const baseY = nodes.length * 120;
    const position = {
      x: clamp((selectedNodeId ? nodes.find((n) => n.id === selectedNodeId)?.position.x || 0 : 0) + 200, 0, 800),
      y: clamp(baseY, 0, 1200)
    };
    const newNode: MindmapNode = {
      id,
      position,
      data: { label: 'New node' }
    };
    setNodes((nds) => [...nds, newNode]);

    if (selectedNodeId) {
      const newEdge: MindmapEdge = {
        id: `e-${selectedNodeId}-${id}`,
        source: selectedNodeId,
        target: id
      };
      setEdges((eds) => [...eds, newEdge]);
    }
  }, [readOnly, nodes, selectedNodeId, setNodes, setEdges]);

  const selectionChange = useCallback((event: any) => {
    const selected = event?.nodes?.[0];
    setSelectedNodeId(selected?.id || null);
  }, []);

  const fitViewOptions = useMemo(() => ({ padding: 0.2, minZoom: 0.2, maxZoom: 1.5 }), []);

  return (
    <div className={className} style={{ height }}>
      {!readOnly && (
        <button
          type="button"
          onClick={handleAddNode}
          className="mb-2 px-3 py-1.5 text-xs font-bold border-[2px] border-[#1a1a1a] hand-drawn-border bg-[#faf8f3] hover:bg-[#e8e4d9]"
        >
          + Add node
        </button>
      )}
      <div className="w-full" style={{ height: height - (readOnly ? 0 : 36) }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={readOnly ? undefined : onNodesChange}
          onEdgesChange={readOnly ? undefined : onEdgesChange}
          onConnect={readOnly ? undefined : onConnect}
          onNodeDoubleClick={handleNodeDoubleClick}
          onSelectionChange={selectionChange}
          fitView
          fitViewOptions={fitViewOptions}
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          elementsSelectable={!readOnly}
          className="hand-drawn-border border-[2px] border-[#1a1a1a] bg-white"
        >
          <Background gap={24} size={1} color="#e5e1d8" />
          <MiniMap />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
};
