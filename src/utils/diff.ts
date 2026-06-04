export interface FileDiff {
  oldPath: string;
  newPath: string;
  isCreated: boolean;
  isDeleted: boolean;
  additions: number;
  deletions: number;
  lines: string[];
}

export function parseUnifiedDiff(diffText: string): FileDiff[] {
  const files: FileDiff[] = [];
  if (!diffText) return files;

  const fileChunks = diffText.split(/^(?:diff --git|diff --new-file)\s+/m).filter(Boolean);

  for (const chunk of fileChunks) {
    const lines = chunk.split('\n');
    let oldPath = '';
    let newPath = '';
    let isCreated = false;
    let isDeleted = false;
    let additions = 0;
    let deletions = 0;
    const diffLines: string[] = [];

    let headerEnded = false;

    for (const line of lines) {
      if (!headerEnded) {
        if (line.startsWith('new file mode')) {
          isCreated = true;
        } else if (line.startsWith('deleted file mode')) {
          isDeleted = true;
        } else if (line.startsWith('--- ')) {
          const path = line.substring(4).trim();
          if (path !== '/dev/null') oldPath = path.startsWith('a/') ? path.substring(2) : path;
        } else if (line.startsWith('+++ ')) {
          const path = line.substring(4).trim();
          if (path !== '/dev/null') newPath = path.startsWith('b/') ? path.substring(2) : path;
        } else if (line.startsWith('@@ ')) {
          headerEnded = true;
          diffLines.push(line);
        }
      } else {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          additions++;
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          deletions++;
        }
        diffLines.push(line);
      }
    }

    if (!newPath && isCreated) newPath = oldPath;
    if (!oldPath && isDeleted) oldPath = newPath;
    
    files.push({
      oldPath: oldPath || newPath,
      newPath: newPath || oldPath,
      isCreated,
      isDeleted,
      additions,
      deletions,
      lines: diffLines
    });
  }

  return files;
}
