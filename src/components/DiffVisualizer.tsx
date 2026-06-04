import { useState, useMemo } from 'react';
import { FileCode, ChevronDown, ChevronUp, Plus, Minus } from 'lucide-react';
import { type FileDiff, parseUnifiedDiff } from '../utils/diff';

const FileDiffCard = ({ file }: { file: FileDiff }) => {
  const [collapsed, setCollapsed] = useState(true);

  const displayPath = file.isDeleted ? file.oldPath : file.newPath;

  return (
    <div className="mb-3 border border-border-subtle rounded-lg overflow-hidden bg-bg-surface">
      <div 
        className="flex items-center justify-between p-2 bg-bg-surface-hover cursor-pointer hover:opacity-80 transition-opacity"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2 overflow-hidden flex-1">
          <FileCode size={14} className={file.isDeleted ? "text-accent-danger" : file.isCreated ? "text-accent-success" : "text-accent-info"} />
          <span className="font-mono text-xs text-text-main truncate" title={displayPath}>{displayPath}</span>
        </div>
        <div className="flex items-center gap-3 ml-2 flex-shrink-0">
          <div className="flex items-center gap-2 font-mono text-[10px] font-bold">
            {file.additions > 0 && <span className="text-accent-success flex items-center"><Plus size={10} />{file.additions}</span>}
            {file.deletions > 0 && <span className="text-accent-danger flex items-center"><Minus size={10} />{file.deletions}</span>}
          </div>
          {collapsed ? <ChevronDown size={14} className="text-text-muted" /> : <ChevronUp size={14} className="text-text-muted" />}
        </div>
      </div>
      
      {!collapsed && file.lines.length > 0 && (
        <div className="overflow-x-auto p-2 bg-bg-input">
          <pre className="font-mono text-[11px] leading-relaxed w-fit min-w-full">
            {file.lines.map((line, idx) => {
              let lineClass = 'text-text-main';
              let bgClass = '';
              if (line.startsWith('+') && !line.startsWith('+++')) {
                lineClass = 'text-accent-success';
                bgClass = 'bg-accent-success/10';
              } else if (line.startsWith('-') && !line.startsWith('---')) {
                lineClass = 'text-accent-danger';
                bgClass = 'bg-accent-danger/10';
              } else if (line.startsWith('@@')) {
                lineClass = 'text-accent-info font-bold';
                bgClass = 'bg-accent-info/10';
              }
              return (
                <div key={idx} className={`px-2 py-0.5 ${bgClass}`}>
                  <span className={lineClass}>{line}</span>
                </div>
              );
            })}
          </pre>
        </div>
      )}
    </div>
  );
};

export function DiffVisualizer({ diffText, aggregatedFiles }: { diffText?: string, aggregatedFiles?: FileDiff[] }) {
  const files = useMemo(() => {
    if (aggregatedFiles) return aggregatedFiles;
    return diffText ? parseUnifiedDiff(diffText) : [];
  }, [diffText, aggregatedFiles]);

  const [collapseKey, setCollapseKey] = useState(0);

  if (files.length === 0) return <div className="text-text-muted text-xs text-center p-4">No diff content</div>;

  return (
    <div className="diff-viewer">
      <div className="flex justify-end mb-2">
        <button 
          onClick={() => setCollapseKey(prev => prev + 1)}
          className="text-[10px] font-bold uppercase tracking-wider bg-bg-surface hover:bg-bg-surface-hover text-text-muted hover:text-text-bright px-2 py-1 rounded border border-border-subtle transition-all cursor-pointer"
        >
          Collapse All
        </button>
      </div>
      <div className="diff-content" key={collapseKey}>
        {files.map((file, idx) => (
          <FileDiffCard key={idx} file={file} />
        ))}
      </div>
    </div>
  );
}
