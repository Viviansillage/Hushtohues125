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
    
    // Clean up existing instance
    if (mindRef.current) {
      mindRef.current = null;
    }

    console.log('[MindElixir] Initializing with data:', data);

    // Initialize MindElixir
    const mind = new MindElixir({
      el: containerRef.current,
      direction: MindElixir.RIGHT,
      draggable: true,
      contextMenu: true,
      toolBar: true,
      keypress: true,
      locale: 'en',
      overflowHidden: false,
      editable: true,
      allowUndo: true,
    });

    mind.init(data);
    mindRef.current = mind;
    
    console.log('[MindElixir] Initialized successfully');

    // Replace Chinese menu text with English
    setTimeout(() => {
      const replaceText = (selector: string, translations: Record<string, string>) => {
        document.querySelectorAll(selector).forEach((el) => {
          const text = el.textContent?.trim();
          if (text && translations[text]) {
            el.textContent = translations[text];
          }
        });
      };

      const menuTranslations = {
        '插入子节点': 'Add Child Node',
        '插入父节点': 'Add Parent Node',
        '插入同级节点': 'Add Sibling Node',
        '删除节点': 'Delete Node',
        '专注': 'Focus',
        '取消专注': 'Unfocus',
        '上移': 'Move Up',
        '下移': 'Move Down',
        '摘要': 'Summary',
        '连接': 'Link',
        '双向连接': 'Bi-directional Link'
      };

      replaceText('.mind-elixir-toolbar button, .context-menu button', menuTranslations);
    }, 100);

    // Monitor data changes
    if (onDataChange) {
      mind.bus.addListener('operation', () => {
        const currentData = mind.getData() as MindMapData;
        console.log('[MindElixir] Data changed:', currentData);
        onDataChange(currentData);
      });
    }

    return () => {
      if (mindRef.current) {
        console.log('[MindElixir] Cleaning up');
        mindRef.current = null;
      }
    };
  }, [data, onDataChange]);

  return (
    <div 
      ref={containerRef} 
      className={`mind-elixir-container ${className}`}
      style={{ width: '100%', height: '100%', minHeight: '600px' }}
    />
  );
}
