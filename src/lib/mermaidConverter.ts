import { MindMapData, MindNode } from '../components/MindElixirEditor';

/**
 * 将 Mermaid mindmap 语法转换为 MindElixir 数据格式
 */
export function mermaidToMindElixir(mermaidCode: string): MindMapData {
  const lines = mermaidCode.split('\n').filter(line => line.trim());
  
  // 跳过 "mindmap" 声明行
  const contentLines = lines.slice(1).filter(line => line.trim());
  
  if (contentLines.length === 0) {
    return {
      nodeData: {
        id: 'root',
        topic: '思维导图',
        root: true,
        children: []
      }
    };
  }

  // 解析缩进层级
  const getIndentLevel = (line: string): number => {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  };

  // 提取节点文本（去除缩进和特殊字符）
  const getNodeText = (line: string): string => {
    return line.trim().replace(/^[)(\[\]]+|[)(\[\]]+$/g, '').trim();
  };

  // 构建节点树
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

    // 找到父节点
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

  // 转换为 MindElixir 格式
  const convertNode = (node: ParseNode): MindNode => ({
    id: node.id,
    topic: node.topic,
    children: node.children.map(convertNode),
    expanded: true
  });

  // 第一个节点作为根节点
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
 * 将 MindElixir 数据格式转换回 Mermaid mindmap 语法
 */
export function mindElixirToMermaid(data: MindMapData): string {
  const lines: string[] = ['mindmap'];
  
  const convertNode = (node: MindNode, indent: number = 0) => {
    const indentStr = '  '.repeat(indent);
    lines.push(`${indentStr}${node.topic}`);
    
    if (node.children && node.children.length > 0) {
      node.children.forEach(child => convertNode(child, indent + 1));
    }
  };

  // 根节点
  lines.push(`  ${data.nodeData.topic}`);
  
  // 子节点
  if (data.nodeData.children) {
    data.nodeData.children.forEach(child => convertNode(child, 2));
  }

  return lines.join('\n');
}
