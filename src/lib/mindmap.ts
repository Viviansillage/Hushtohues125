export type MindmapNode = {
  id: string;
  position: { x: number; y: number };
  data: { label: string };
  type?: string;
};

export type MindmapEdge = {
  id: string;
  source: string;
  target: string;
};

export type MindmapJson = {
  nodes: MindmapNode[];
  edges: MindmapEdge[];
};

const stripRootLabel = (label: string) => {
  const rootMatch =
    label.match(/^root\s*\(\((.*)\)\)$/i) ||
    label.match(/^root\s*\[(.*)\]$/i) ||
    label.match(/^root\s*\((.*)\)$/i);
  if (rootMatch && rootMatch[1]) {
    return rootMatch[1].trim();
  }
  return label;
};

const normalizeLabel = (label: string) => {
  const cleaned = label.replace(/^[*-]\s+/, '').trim();
  if (!cleaned) return '';
  return stripRootLabel(cleaned).trim();
};

export const parseMermaidToMindmap = (mermaidCode?: string | null): MindmapJson | null => {
  if (!mermaidCode) return null;
  const lines = mermaidCode
    .split('\n')
    .map((line) => line.replace(/\t/g, '  '))
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) return null;

  if (lines[0].trim().toLowerCase() === 'mindmap') {
    lines.shift();
  }

  const nodes: MindmapNode[] = [];
  const edges: MindmapEdge[] = [];
  const stack: Array<{ depth: number; id: string }> = [];
  let nodeIndex = 0;

  for (const line of lines) {
    const match = line.match(/^(\s*)(.*)$/);
    if (!match) continue;
    const indent = match[1].length;
    const depth = Math.floor(indent / 2);
    const label = normalizeLabel(match[2]);
    if (!label) continue;

    const id = `mm-${nodeIndex++}`;
    nodes.push({
      id,
      position: { x: depth * 220, y: nodes.length * 120 },
      data: { label }
    });

    while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }

    const parent = stack[stack.length - 1];
    if (parent) {
      edges.push({
        id: `e-${parent.id}-${id}`,
        source: parent.id,
        target: id
      });
    }

    stack.push({ depth, id });
  }

  return { nodes, edges };
};

export const ensureMindmapJson = (artifact: any): MindmapJson | null => {
  const json = artifact?.data?.mindmapJson || artifact?.payload?.mindmapJson;
  if (json?.nodes?.length) return json as MindmapJson;

  const mermaidCode =
    artifact?.data?.mermaidCode ||
    artifact?.payload?.mermaidCode ||
    artifact?.payload?.structuredMindmap?.mermaidCode;

  return parseMermaidToMindmap(mermaidCode);
};
