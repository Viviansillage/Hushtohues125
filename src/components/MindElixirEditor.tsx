import { useEffect, useRef } from 'react';
import MindElixir from 'mind-elixir';

export interface MindNode {
  topic: string;
  id: string;
  children?: MindNode[];
  expanded?: boolean;
}

export interface MindMapData {
  nodeData: {
    id: string;
    topic: string;
    root?: boolean;
    children?: MindNode[];
  };
  linkData?: Record<string, unknown>;
}

interface MindElixirEditorProps {
  data: MindMapData;
  onDataChange?: (data: MindMapData) => void;
  className?: string;
}

export function MindElixirEditor({ data, onDataChange, className = '' }: MindElixirEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mindRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // 初始化 MindElixir
    const mind = new MindElixir({
      el: containerRef.current,
      direction: MindElixir.RIGHT,
      draggable: true,
      contextMenu: true,
      toolBar: true,
      keypress: true,
      locale: 'zh_CN',
      overflowHidden: false,
    });

    mind.init(data);
    mindRef.current = mind;

    // 监听数据变化
    if (onDataChange) {
      mind.bus.addListener('operation', () => {
        const currentData = mind.getData() as MindMapData;
        onDataChange(currentData);
      });
    }

    return () => {
      if (mindRef.current) {
        mindRef.current = null;
      }
    };
  }, []);

  // 当外部数据变化时更新
  useEffect(() => {
    if (mindRef.current && data) {
      mindRef.current.refresh(data);
    }
  }, [data]);

  return (
    <div 
      ref={containerRef} 
      className={`mind-elixir-container ${className}`}
      style={{ width: '100%', height: '100%', minHeight: '500px' }}
    />
  );
}
