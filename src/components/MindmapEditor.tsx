import { useMemo } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import { MindmapJson } from '../lib/mindmap';
import { buildExcalidrawSceneFromMindmap, ExcalidrawScene, isExcalidrawScene } from '../lib/excalidrawMindmap';

type MindmapEditorProps = {
  value?: MindmapJson | ExcalidrawScene | null;
  readOnly?: boolean;
  height?: number;
  onChange?: (scene: ExcalidrawScene) => void;
};

export const MindmapEditor = ({ value, readOnly = false, height = 260, onChange }: MindmapEditorProps) => {
  const scene = useMemo(() => {
    if (!value) return null;
    if (isExcalidrawScene(value)) return value;
    return buildExcalidrawSceneFromMindmap(value);
  }, [value]);

  if (!scene) {
    return <div className="text-sm text-gray-500">No mindmap data</div>;
  }

  return (
    <div style={{ height }} className="w-full">
      <Excalidraw
        initialData={scene}
        viewModeEnabled={readOnly}
        zenModeEnabled={readOnly}
        gridModeEnabled={false}
        onChange={(elements, appState, files) => {
          if (readOnly || !onChange) return;
          onChange({ elements, appState, files });
        }}
      />
    </div>
  );
};
