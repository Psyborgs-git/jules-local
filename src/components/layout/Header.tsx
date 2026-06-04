import { Menu, Sun, Moon, FileCode } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { julesApi } from '../../julesApi';
import { GithubIcon } from '../GithubIcon';

export const Header = () => {
  const { id: sessionIdFromUrl } = useParams<{ id: string }>();
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    cyberTheme,
    setCyberTheme,
    sessions,
    currentSourceHub,
    allSources,
    rightSidebarCollapsed,
    setRightSidebarCollapsed
  } = useAppStore();

  const activeSessionDetails = sessions.find(s => s.id === sessionIdFromUrl);

  const handleToggleTheme = () => {
    const newTheme = cyberTheme === 'dark' ? 'light' : 'dark';
    setCyberTheme(newTheme);
    julesApi.saveSetting('theme', newTheme).catch(console.error);
  };

  const getStatusColorClass = (state: string) => {
    switch (state) {
      case 'COMPLETED': return 'text-accent-success bg-accent-success/10 border-accent-success/20';
      case 'FAILED': return 'text-accent-danger bg-accent-danger/10 border-accent-danger/20';
      case 'AWAITING_PLAN_APPROVAL':
      case 'AWAITING_USER_FEEDBACK': return 'text-accent-warning bg-accent-warning/10 border-accent-warning/20';
      case 'IN_PROGRESS':
      case 'PLANNING': return 'text-accent-primary bg-accent-primary/10 border-accent-primary/20 glow-active';
      default: return 'text-text-muted bg-bg-surface border-border-subtle';
    }
  };

  return (
    <header className="main-header glassmorphism flex justify-between">
      <div className="flex items-center gap-3">
        {sidebarCollapsed && (
          <button onClick={() => setSidebarCollapsed(false)} className="p-1.5 rounded-lg hover:bg-bg-surface-hover text-text-muted hover:text-text-bright transition bg-transparent border-none cursor-pointer" title="Expand sidebar">
            <Menu size={16} />
          </button>
        )}
        <span className="text-sm font-semibold text-text-main font-mono">
          {sessionIdFromUrl ? (
            <span className="flex items-center gap-2">
              <span className="text-text-main">Workspace</span>
              {activeSessionDetails && (
                <span className={`text-[10px] font-bold border rounded-full px-2 py-0.5 ${getStatusColorClass(activeSessionDetails.state)}`}>
                  {activeSessionDetails.state.replace('_', ' ')}
                </span>
              )}
            </span>
          ) : currentSourceHub ? (
            <span className="flex items-center gap-2 text-text-main">
              <GithubIcon size={14} className="text-accent-primary" />
              <span>
                {(() => {
                  const src = allSources.find(s => s.name === currentSourceHub);
                  return src?.githubRepo ? `${src.githubRepo.owner}/${src.githubRepo.repo}` : currentSourceHub;
                })()}
              </span>
            </span>
          ) : <span className="text-text-main">New Coding Assignment</span>}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={handleToggleTheme} className="p-2 rounded-lg hover:bg-bg-surface-hover text-text-muted hover:text-text-bright transition-all bg-transparent border-none cursor-pointer flex items-center justify-center micro-interaction-btn hover:scale-110 active:scale-95" title="Toggle theme">
          {cyberTheme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        {activeSessionDetails && (
          <button type="button" onClick={() => setRightSidebarCollapsed(!rightSidebarCollapsed)} className={`p-2 rounded-lg text-text-muted hover:text-text-bright transition-all bg-transparent border-none cursor-pointer flex items-center justify-center micro-interaction-btn ${!rightSidebarCollapsed ? 'bg-accent-primary text-text-bright shadow-primary-glow' : 'hover:bg-bg-surface-hover'}`} title="Toggle properties sidebar">
            <FileCode size={15} />
          </button>
        )}
      </div>
    </header>
  );
};
