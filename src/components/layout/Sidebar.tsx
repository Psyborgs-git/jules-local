import { Link, useParams, useNavigate } from 'react-router-dom';
import { Sparkles, ChevronLeft, Plus, Trash2, Settings, Search, Globe } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { julesApi } from '../../julesApi';
import { useState, useCallback } from 'react';
import { GithubIcon as Github } from '../GithubIcon';
import { ResizeHandle } from './ResizeHandle';

export const Sidebar = () => {
  const { id: sessionIdFromUrl } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    sidebarWidth,
    setSidebarWidth,
    sessions,
    setSessions,
    allSources,
    showSettings,
    setShowSettings,
    setCurrentSourceHub,
    setStatusMsg
  } = useAppStore();

  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [visibleChatsCount, setVisibleChatsCount] = useState(10);
  const [sourceSearchQuery, setSourceSearchQuery] = useState('');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setChatSearchQuery(e.target.value);
    setVisibleChatsCount(10);
  };

  const handleChatsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop - target.clientHeight < 20) {
      const filteredCount = sessions.filter(s =>
        s.title ? s.title.toLowerCase().includes(chatSearchQuery.toLowerCase()) : false
      ).length;
      if (visibleChatsCount < filteredCount) {
        setVisibleChatsCount(prev => prev + 10);
      }
    }
  };

  const handleResize = useCallback((delta: number) => {
    const newWidth = Math.max(200, Math.min(600, sidebarWidth + delta));
    setSidebarWidth(newWidth);
  }, [sidebarWidth, setSidebarWidth]);

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this vibe coding session?')) return;
    julesApi.deleteSession(sessionId)
      .then(() => {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        if (sessionIdFromUrl === sessionId) navigate('/');
      })
      .catch(err => setStatusMsg({ text: `Failed to delete session: ${err.message}`, error: true }));
  };

  const getStatusDot = (state: string) => {
    switch (state) {
      case 'COMPLETED': return <span className="w-2 h-2 rounded-full bg-accent-success flex-shrink-0 shadow-success-glow" title="Completed" />;
      case 'FAILED': return <span className="w-2 h-2 rounded-full bg-accent-danger flex-shrink-0 shadow-danger-glow" title="Failed" />;
      case 'AWAITING_PLAN_APPROVAL':
      case 'AWAITING_USER_FEEDBACK': return <span className="w-2 h-2 rounded-full bg-accent-warning flex-shrink-0 animate-pulse shadow-warning-glow" title="Awaiting action" />;
      case 'IN_PROGRESS':
      case 'PLANNING':
      case 'QUEUED': return <span className="w-2 h-2 rounded-full bg-accent-primary flex-shrink-0 animate-pulse shadow-primary-glow" title="In Progress" />;
      default: return <span className="w-2 h-2 rounded-full bg-text-muted flex-shrink-0" title="Unknown" />;
    }
  };

  const filteredSessions = sessions.filter(s =>
    s.title ? s.title.toLowerCase().includes(chatSearchQuery.toLowerCase()) : false
  );

  const displayedSessions = filteredSessions.slice(0, visibleChatsCount);

  const filteredSources = allSources.filter(s => {
    const name = s.githubRepo ? `${s.githubRepo.owner}/${s.githubRepo.repo}` : s.name;
    return name.toLowerCase().includes(sourceSearchQuery.toLowerCase());
  });

  return (
    <aside 
      className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}
      style={{ width: sidebarCollapsed ? 0 : sidebarWidth, minWidth: sidebarCollapsed ? 0 : sidebarWidth }}
    >
      <div className="sidebar-header">
        <div className="flex items-center gap-2.5">
          <Sparkles className="text-accent-primary" size={18} />
          <span className="font-semibold text-text-main text-base font-mono">Jules Vibe</span>
        </div>
        <button onClick={() => setSidebarCollapsed(true)} className="p-1.5 rounded-lg hover:bg-bg-surface-hover text-text-muted hover:text-text-bright transition bg-transparent border-none cursor-pointer" title="Collapse sidebar">
          <ChevronLeft size={16} />
        </button>
      </div>

      <div className="sidebar-content">
        <div className="px-2">
          <Link to="/" onClick={() => { setShowSettings(false); setCurrentSourceHub(null); }} className="flex items-center justify-center gap-2 py-2 px-4 bg-bg-surface hover:bg-bg-surface-hover text-text-bright font-semibold text-xs border border-border-subtle rounded-xl transition-all" style={{ textDecoration: 'none' }}>
            <Plus size={14} className="text-accent-primary" /> New Chat
          </Link>
        </div>

        <div className="flex flex-col gap-1 px-2 mt-4 overflow-hidden" style={{ maxHeight: '45%' }}>
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="text-[10px] font-bold text-text-main uppercase tracking-wider font-mono">Previous Chats</div>
            <div className="relative flex items-center group">
              <Search size={10} className="absolute left-2 text-text-muted" />
              <input
                type="text"
                placeholder="Search..."
                value={chatSearchQuery}
                onChange={handleSearchChange}
                className="bg-bg-input border border-border-subtle rounded-lg py-1 pl-6 pr-2 text-[10px] text-text-main focus:border-border-focus outline-none transition-all w-24 group-hover:w-32"
              />
            </div>
          </div>

          <div 
            className="flex-1 overflow-y-auto flex flex-col gap-0.5 custom-scrollbar"
            onScroll={handleChatsScroll}
          >
            {sessions.length === 0 ? (
              <div className="text-center text-text-muted text-[11px] italic py-4 opacity-60">No previous chats</div>
            ) : displayedSessions.length === 0 ? (
              <div className="text-center text-text-muted text-[11px] italic py-4 opacity-60">No matching chats</div>
            ) : (
              <>
                {displayedSessions.map((s) => (
                  <Link key={s.id} to={`/session/${s.id}`} onClick={() => setShowSettings(false)} className={`sidebar-session-row ${sessionIdFromUrl === s.id ? 'active' : ''}`}>
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {getStatusDot(s.state)}
                      <span className="capped-text flex-1 text-xs">{s.title}</span>
                    </div>
                    <button onClick={(e) => handleDeleteSession(s.id, e)} className="p-1 rounded text-text-muted hover:text-accent-danger bg-transparent border-none cursor-pointer transition opacity-0 group-hover:opacity-100 hover:opacity-100 focus:opacity-100">
                      <Trash2 size={10} />
                    </button>
                  </Link>
                ))}
                {visibleChatsCount < filteredSessions.length && (
                  <div className="text-center text-[10px] text-text-muted font-mono py-1.5 animate-pulse">
                    Scroll for more...
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1 px-2 mt-6 flex-1 overflow-hidden">
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="text-[10px] font-bold text-text-main uppercase tracking-wider font-mono">Repositories</div>
            <div className="relative flex items-center group">
              <Search size={10} className="absolute left-2 text-text-muted" />
              <input
                type="text"
                placeholder="Search..."
                value={sourceSearchQuery}
                onChange={(e) => setSourceSearchQuery(e.target.value)}
                className="bg-bg-input border border-border-subtle rounded-lg py-1 pl-6 pr-2 text-[10px] text-text-main focus:border-border-focus outline-none transition-all w-24 group-hover:w-32"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto flex flex-col gap-0.5 custom-scrollbar">
            {filteredSources.length === 0 ? (
              <div className="text-center text-text-muted text-[11px] italic py-4 opacity-60">No sources found</div>
            ) : (
              filteredSources.map((source) => {
                const repoName = source.githubRepo ? `${source.githubRepo.owner}/${source.githubRepo.repo}` : source.name;
                const isGithub = !!source.githubRepo;
                const isActive = false; // We can check if URL matches /source/${source.name}

                return (
                  <Link
                    key={source.id}
                    to={`/source/${source.name}`}
                    onClick={() => { setShowSettings(false); setCurrentSourceHub(source.name); }}
                    className={`sidebar-session-row ${isActive ? 'active' : ''}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isGithub ? <Github size={12} className="text-text-muted" /> : <Globe size={12} className="text-text-muted" />}
                      <span className="capped-text flex-1 text-xs">{repoName}</span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="sidebar-footer">
        <button type="button" onClick={() => setShowSettings(!showSettings)} className={`flex items-center gap-2.5 py-2 px-3.5 rounded-xl text-xs font-semibold transition-all border border-none cursor-pointer w-full text-left mb-1.5 ${showSettings ? 'bg-accent-primary text-text-bright shadow-primary-glow' : 'bg-bg-surface hover:bg-bg-surface-hover text-text-main'}`}>
          <Settings size={14} className={showSettings ? 'animate-spin' : ''} style={{ animationDuration: '6s' }} />
          <span>Settings</span>
        </button>
        <div className="text-[9px] font-mono text-text-muted text-center opacity-60">SQLite DB • Gemini Vibe</div>
      </div>

      {!sidebarCollapsed && <ResizeHandle onResize={handleResize} direction="right" className="hidden md:block" />}
    </aside>
  );
};
