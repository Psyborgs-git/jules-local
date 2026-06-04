import { useState } from 'react';
import type { Artifact } from '../julesApi';

interface ParsedDiff {
  created: string[];
  updated: string[];
  deleted: string[];
}

function parseDiff(diffText: string): ParsedDiff {
  const created: string[] = [];
  const updated: string[] = [];
  const deleted: string[] = [];

  if (!diffText) return { created, updated, deleted };

  // Splits into sections on "diff --git" or "diff --new-file"
  const files = diffText.split(/^(?:diff --git|diff --new-file)\s+/m);

  for (const fileDiff of files) {
    if (!fileDiff.trim()) continue;

    const lines = fileDiff.split('\n');
    let oldPath = '';
    let newPath = '';
    let isCreated = false;
    let isDeleted = false;

    // Detect file mode / changes
    for (const line of lines) {
      if (line.startsWith('new file mode')) {
        isCreated = true;
      } else if (line.startsWith('deleted file mode')) {
        isDeleted = true;
      } else if (line.startsWith('--- ')) {
        const path = line.substring(4).trim();
        if (path === '/dev/null') {
          isCreated = true;
        } else {
          oldPath = path.startsWith('a/') ? path.substring(2) : path;
        }
      } else if (line.startsWith('+++ ')) {
        const path = line.substring(4).trim();
        if (path === '/dev/null') {
          isDeleted = true;
        } else {
          newPath = path.startsWith('b/') ? path.substring(2) : path;
        }
      }
    }

    if (isCreated && newPath) {
      created.push(newPath);
    } else if (isDeleted && oldPath) {
      deleted.push(oldPath);
    } else if (newPath) {
      updated.push(newPath);
    } else if (oldPath) {
      updated.push(oldPath);
    }
  }

  return {
    created: Array.from(new Set(created)),
    updated: Array.from(new Set(updated)),
    deleted: Array.from(new Set(deleted))
  };
}

export function ActivityFiles({ artifacts }: { artifacts?: Artifact[] }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!artifacts || artifacts.length === 0) return null;

  const changeSet = artifacts.find(art => art.changeSet)?.changeSet;
  if (!changeSet || !changeSet.gitPatch.unidiffPatch) return null;

  const { created, updated, deleted } = parseDiff(changeSet.gitPatch.unidiffPatch);

  if (created.length === 0 && updated.length === 0 && deleted.length === 0) return null;

  const createdText = created.length > 0 ? `Created: ${created.map(f => f.split('/').pop()).join(', ')}` : '';
  const updatedText = updated.length > 0 ? `Updated: ${updated.map(f => f.split('/').pop()).join(', ')}` : '';
  const deletedText = deleted.length > 0 ? `Deleted: ${deleted.map(f => f.split('/').pop()).join(', ')}` : '';
  const summaryParts = [createdText, updatedText, deletedText].filter(Boolean);

  return (
    <div className="activity-files-summary mt-2 bg-bg-input/40 border border-border-subtle rounded-xl p-3 flex flex-col gap-2 animate-slide-in">
      <div
        className="flex items-center justify-between cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex flex-col gap-0.5 flex-1 pr-4 min-w-0">
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-accent-primary rounded-full" />
            Workspace Modifications
          </div>
          <div className="text-xs text-text-muted font-mono truncate max-w-[450px]">
            {summaryParts.join(' | ')}
          </div>
        </div>
        <span className="text-[10px] text-accent-primary hover:text-accent-primary/80 font-semibold uppercase whitespace-nowrap">
          {isExpanded ? 'Collapse' : 'Expand'}
        </span>
      </div>

      {isExpanded && (
        <div className="flex flex-col gap-1.5 mt-2 border-t border-border-subtle pt-2">
          {created.map((file) => (
            <div key={file} className="flex items-center justify-between text-xs py-1 px-2.5 bg-accent-success/5 border border-accent-success/10 rounded-lg">
              <span className="flex items-center gap-2 text-accent-success font-mono truncate">
                <span className="w-1.5 h-1.5 bg-accent-success rounded-full" />
                {file}
              </span>
              <span className="text-[9px] font-bold bg-accent-success/10 text-accent-success px-1.5 py-0.5 rounded uppercase">Created</span>
            </div>
          ))}

          {updated.map((file) => (
            <div key={file} className="flex items-center justify-between text-xs py-1 px-2.5 bg-accent-info/5 border border-accent-info/10 rounded-lg">
              <span className="flex items-center gap-2 text-accent-info font-mono truncate">
                <span className="w-1.5 h-1.5 bg-accent-info rounded-full" />
                {file}
              </span>
              <span className="text-[9px] font-bold bg-accent-info/10 text-accent-info px-1.5 py-0.5 rounded uppercase">Modified</span>
            </div>
          ))}

          {deleted.map((file) => (
            <div key={file} className="flex items-center justify-between text-xs py-1 px-2.5 bg-accent-danger/5 border border-accent-danger/10 rounded-lg">
              <span className="flex items-center gap-2 text-accent-danger font-mono truncate">
                <span className="w-1.5 h-1.5 bg-accent-danger rounded-full" />
                {file}
              </span>
              <span className="text-[9px] font-bold bg-accent-danger/10 text-accent-danger px-1.5 py-0.5 rounded uppercase">Deleted</span>
            </div>
          ))}

          <div className="text-[10px] text-text-muted leading-normal border-t border-border-subtle pt-2 flex items-center justify-between">
            <span>
              {[
                created.length > 0 ? `created ${created.length} file${created.length > 1 ? 's' : ''}` : '',
                updated.length > 0 ? `updated ${updated.length} file${updated.length > 1 ? 's' : ''}` : '',
                deleted.length > 0 ? `deleted ${deleted.length} file${deleted.length > 1 ? 's' : ''}` : '',
              ].filter(Boolean).join(', ')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
