import { convertToExcalidrawElements } from '@excalidraw/excalidraw';
import { MindmapJson, parseMermaidToMindmap } from './mindmap';

export type ExcalidrawScene = {
  elements: any[];
  appState?: any;
  files?: any;
};

export const isExcalidrawScene = (value: any): value is ExcalidrawScene =>
  Boolean(value && Array.isArray(value.elements));

const estimateNodeSize = (label: string) => {
  const baseWidth = 140;
  const charWidth = 8;
  const paddingX = 24;
  const width = Math.max(baseWidth, label.length * charWidth + paddingX * 2);
  const height = 56;
  return { width, height, paddingX, paddingY: 16 };
};

export const buildExcalidrawSceneFromMindmap = (mindmap?: MindmapJson | null): ExcalidrawScene | null => {
  if (!mindmap || !mindmap.nodes?.length) return null;

  const elements: any[] = [];
  const nodeBounds = new Map<string, { x: number; y: number; w: number; h: number }>();

  mindmap.nodes.forEach((node) => {
    const label = node.data?.label || 'Node';
    const { width, height, paddingX, paddingY } = estimateNodeSize(label);
    const x = node.position?.x ?? 0;
    const y = node.position?.y ?? 0;
    const groupId = `group-${node.id}`;

    nodeBounds.set(node.id, { x, y, w: width, h: height });

    elements.push({
      type: 'rectangle',
      x,
      y,
      width,
      height,
      strokeColor: '#1a1a1a',
      backgroundColor: '#fffdf7',
      fillStyle: 'solid',
      strokeWidth: 2,
      roughness: 1,
      groupIds: [groupId]
    });

    elements.push({
      type: 'text',
      x: x + paddingX,
      y: y + paddingY,
      text: label,
      fontSize: 16,
      fontFamily: 1,
      strokeColor: '#1a1a1a',
      backgroundColor: 'transparent',
      width: width - paddingX * 2,
      height: height - paddingY * 2,
      groupIds: [groupId]
    });
  });

  mindmap.edges.forEach((edge) => {
    const source = nodeBounds.get(edge.source);
    const target = nodeBounds.get(edge.target);
    if (!source || !target) return;
    const startX = source.x + source.w / 2;
    const startY = source.y + source.h / 2;
    const endX = target.x + target.w / 2;
    const endY = target.y + target.h / 2;
    const dx = endX - startX;
    const dy = endY - startY;

    elements.push({
      type: 'arrow',
      x: startX,
      y: startY,
      width: dx,
      height: dy,
      points: [
        [0, 0],
        [dx, dy]
      ],
      strokeColor: '#1a1a1a',
      backgroundColor: 'transparent',
      strokeWidth: 2,
      roughness: 1,
      startArrowhead: 'none',
      endArrowhead: 'arrow'
    });
  });

  return {
    elements: convertToExcalidrawElements(elements),
    appState: {
      viewBackgroundColor: '#fffdf7',
      theme: 'light'
    }
  };
};

export const ensureExcalidrawScene = (artifact: any): ExcalidrawScene | null => {
  const existing =
    artifact?.data?.excalidraw ||
    artifact?.payload?.excalidraw ||
    artifact?.excalidraw;
  if (isExcalidrawScene(existing)) return existing;

  const mindmapJson =
    artifact?.data?.mindmapJson ||
    artifact?.payload?.mindmapJson ||
    artifact?.payload?.structuredMindmap?.mindmapJson ||
    parseMermaidToMindmap(
      artifact?.data?.mermaidCode ||
        artifact?.payload?.mermaidCode ||
        artifact?.payload?.structuredMindmap?.mermaidCode
    );

  return buildExcalidrawSceneFromMindmap(mindmapJson || null);
};
