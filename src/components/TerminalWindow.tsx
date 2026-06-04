import { Terminal as TerminalIcon } from 'lucide-react';

export function TerminalWindow({ command, output }: { command: string; output: string }) {
  return (
    <div className="terminal-window bg-bg-input rounded-xl border border-border-subtle overflow-hidden">
      <div className="terminal-header bg-bg-surface px-3 py-2 border-b border-border-subtle flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TerminalIcon size={12} className="text-text-muted" />
          <span className="terminal-title text-[10px] font-mono text-text-muted">Guest@jules-terminal</span>
        </div>
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-text-muted/30"></div>
          <div className="w-2 h-2 rounded-full bg-text-muted/30"></div>
          <div className="w-2 h-2 rounded-full bg-text-muted/30"></div>
        </div>
      </div>
      <div className="terminal-body font-mono text-[11px] leading-relaxed p-3">
        <div className="text-text-main">
          <span className="text-accent-primary select-none">❯</span> {command}
        </div>
        <div className="text-text-muted mt-2 whitespace-pre-wrap opacity-80">{output}</div>
      </div>
    </div>
  );
}
