import { MindMapData, MindNode } from '../components/MindElixirEditor';

/**
 * Convert Mermaid mindmap syntax to MindElixir data format
 */
export function mermaidToMindElixir(mermaidCode: string): MindMapData {
  const lines = mermaidCode.split('\n').filter(line => line.trim());
  
  // Skip "mindmap" declaration line
  const contentLines = lines.slice(1).filter(line => line.trim());
  
  if (contentLines.length === 0) {
    return {
      nodeData: {
        id: 'root',
        topic: 'Mindmap',
        root: true,
        children: []
      }
    };
  }

  // Parse indent level
  const getIndentLevel = (line: string): number => {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  };

  // Extract node text (remove indent and special characters)
  const getNodeText = (line: string): string => {
    return line.trim().replace(/^[)(\[\]]+|[)(\[\]]+$/g, '').trim();
  };

  // Build node tree
  interface ParseNode {
    id: string;
    topic: string;
    level: number;
    children: ParseNode[];
  }

  const nodes: ParseNode[] = [];
  const stack: ParseNode[] = [];

  contentLines.forEach((line, index) => {
    const level = getIndentLevel(line);
    const topic = getNodeText(line);
    
    const node: ParseNode = {
      id: `node-${index}`,
      topic,
      level,
      children: []
    };

    // Find parent node
    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    if (stack.length === 0) {
      nodes.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }

    stack.push(node);
  });

  // Convert to MindElixir format
  const convertNode = (node: ParseNode): MindNode => ({
    id: node.id,
    topic: node.topic,
    children: node.children.map(convertNode),
    expanded: true
  });

  // First node as root node
  const rootNode = nodes[0];
  
  return {
    nodeData: {
      id: rootNode.id,
      topic: rootNode.topic,
      root: true,
      children: rootNode.children.map(convertNode)
    }
  };
}

/**
 * Convert MindElixir data format to Mermaid mindmap syntax
 */
export function mindElixirToMermaid(data: MindMapData): string {
  const lines: string[] = ['mindmap'];
  
  const convertNode = (node: MindNode | any, indent: number = 0) => {
    const indentStr = '  '.repeat(indent);
    const topic = node.topic || 'Node';
    lines.push(`${indentStr}${topic}`);
    
    if (node.children && node.children.length > 0) {
      node.children.forEach((child: MindNode | any) => convertNode(child, indent + 1));
    }
  };

  // Root node
  const rootTopic = data.nodeData?.topic || 'Mindmap';
  lines.push(`  ${rootTopic}`);
  
  // Child nodes
  if (data.nodeData?.children && data.nodeData.children.length > 0) {
    data.nodeData.children.forEach(child => convertNode(child, 2));
  }

  return lines.join('\n');
}
