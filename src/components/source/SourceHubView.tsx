import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Play, 
  Search, 
  Plus, 
  Clock, 
  Trash2, 
  Calendar, 
  X,
  ChevronLeft,
  Settings2
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { julesApi, type ScheduledActivity } from '../../julesApi';
import { GithubIcon } from '../GithubIcon';

export const SourceHubView = () => {
  const { '*': sourceName } = useParams<{ '*': string }>();
  const navigate = useNavigate();
  
  const {
    allSources,
    sessions,
    setSessions,
    scheduledActivities,
    setScheduledActivities,
    requireApproval,
    autoPR,
    dbConfig,
    setStatusMsg
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCronModal, setShowCronModal] = useState(false);

  // New Session Form State
  const [titleInput, setTitleInput] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [promptInput, setPromptInput] = useState('');

  // Cron Form State
  const [cronName, setCronName] = useState('');
  const [cronBranch, setCronBranch] = useState('main');
  const [cronExpression, setCronExpression] = useState('0 0 * * *');
  const [cronPrompt, setCronPrompt] = useState('');

  const source = useMemo(() => 
    allSources.find(s => s.name === sourceName), 
    [allSources, sourceName]
  );

  const repoDisplayName = useMemo(() => {
    if (!source) return sourceName || 'Unknown Source';
    return source.githubRepo ? `${source.githubRepo.owner}/${source.githubRepo.repo}` : source.name;
  }, [source, sourceName]);

  const filteredSessions = useMemo(() => {
    // Note: Filtering by source is ideal, but for now we filter by search query
    // because Session objects in the current API don't explicitly expose source name.
    return sessions.filter(s => 
      (s.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
       s.prompt?.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [sessions, searchQuery]);

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim() || !sourceName) return;
    
    const payload = {
      prompt: promptInput,
      title: titleInput.trim() || undefined,
      sourceContext: { 
        source: sourceName, 
        githubRepoContext: { startingBranch: selectedBranch } 
      },
      requirePlanApproval: requireApproval,
      automationMode: autoPR ? ('AUTO_CREATE_PR' as const) : ('MANUAL' as const)
    };

    if (!dbConfig?.hasKey) {
      setStatusMsg({ text: 'SQLite configuration required to execute sessions.', error: true });
      return;
    }

    julesApi.createSession(payload)
      .then(session => {
        setSessions(prev => [session, ...prev]);
        setShowCreateModal(false);
        setTitleInput('');
        setPromptInput('');
        navigate(`/session/${session.id}`);
      })
      .catch(err => setStatusMsg({ text: `Failed to create session: ${err.message}`, error: true }));
  };

  const handleCreateCronSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cronName.trim() || !cronExpression.trim() || !cronPrompt.trim() || !sourceName) return;
    
    const newSchedule: ScheduledActivity = {
      id: `sched-${Date.now()}`,
      name: cronName.trim(),
      source: sourceName,
      branch: cronBranch,
      cron: cronExpression.trim(),
      prompt: cronPrompt.trim(),
      createTime: new Date().toISOString()
    };
    
    setScheduledActivities(prev => [...prev, newSchedule]);
    setCronName('');
    setCronBranch('main');
    setCronExpression('0 0 * * *');
    setCronPrompt('');
    setShowCronModal(false);
  };

  const handleDeleteCronSchedule = (id: string) => {
    if (!confirm('Are you sure you want to remove this scheduled activity?')) return;
    setScheduledActivities(prev => prev.filter(s => s.id !== id));
  };

  const getStatusDot = (state: string) => {
    switch (state) {
      case 'COMPLETED': return <span className="w-2 h-2 rounded-full bg-accent-success shadow-success-glow" />;
      case 'FAILED': return <span className="w-2 h-2 rounded-full bg-accent-danger shadow-danger-glow" />;
      case 'AWAITING_PLAN_APPROVAL':
      case 'AWAITING_USER_FEEDBACK': return <span className="w-2 h-2 rounded-full bg-accent-warning animate-pulse shadow-warning-glow" />;
      case 'IN_PROGRESS':
      case 'PLANNING':
      case 'QUEUED': return <span className="w-2 h-2 rounded-full bg-accent-primary animate-pulse shadow-primary-glow" />;
      default: return <span className="w-2 h-2 rounded-full bg-text-muted" />;
    }
  };

  if (!source && allSources.length > 0) {
    return (
      <div className="mt-12 text-center">
        <h2 className="text-xl font-mono text-text-muted">Source not found</h2>
        <button onClick={() => navigate('/')} className="mt-4 text-accent-primary hover:underline bg-transparent border-none cursor-pointer">Return Home</button>
      </div>
    );
  }

  return (
    <div className="mt-8 animate-fade-in">
      <div className="flex flex-col gap-1 mb-8">
        <button 
          onClick={() => navigate('/')} 
          className="flex items-center gap-1 text-[10px] uppercase font-bold text-text-muted hover:text-text-main transition bg-transparent border-none cursor-pointer mb-2 w-fit"
        >
          <ChevronLeft size={12} /> Back to repositories
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-mono text-text-main flex items-center gap-3 mb-1">
              <GithubIcon size={20} className="text-accent-primary" />
              {repoDisplayName}
            </h1>
            <p className="text-text-muted text-sm">Source Repository Hub</p>
          </div>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 py-2 px-4 bg-accent-primary hover:bg-accent-primary/80 text-text-bright font-bold text-sm rounded-xl transition shadow-primary-glow cursor-pointer border-none font-mono"
          >
            <Plus size={16} /> NEW SESSION
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-bold text-text-muted font-mono uppercase tracking-widest">Sessions</h2>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input 
                type="text" 
                placeholder="Search sessions..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-bg-input border border-border-subtle rounded-lg py-1.5 pl-9 pr-3 text-xs text-text-main focus:border-border-focus outline-none transition-all w-64"
              />
            </div>
          </div>

          <div className="bg-bg-input/40 border border-border-subtle rounded-xl overflow-hidden shadow-xl backdrop-blur-md">
            {filteredSessions.length > 0 ? (
              filteredSessions.map(s => (
                <div 
                  key={s.id} 
                  className="border-b border-border-subtle last:border-b-0 p-4 hover:bg-bg-surface-hover transition cursor-pointer group"
                  onClick={() => navigate(`/session/${s.id}`)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-sm font-semibold text-text-bright group-hover:text-accent-primary transition-colors">{s.title}</div>
                    {getStatusDot(s.state)}
                  </div>
                  <div className="text-xs text-text-muted line-clamp-2 mb-2 italic">"{s.prompt}"</div>
                  <div className="flex items-center gap-3 text-[10px] text-text-muted font-mono opacity-70">
                    <span>{new Date(s.createTime).toLocaleString()}</span>
                    <span className="opacity-30">•</span>
                    <span className="uppercase">{s.state.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 text-center">
                <div className="text-text-muted mb-2 italic opacity-60">No sessions found matching your search.</div>
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="text-xs text-accent-primary hover:underline bg-transparent border-none cursor-pointer">Clear Search</button>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex flex-col gap-6">
           <div>
             <div className="flex items-center justify-between mb-4">
               <h2 className="text-[11px] font-bold text-text-muted font-mono uppercase tracking-widest">Cron Jobs</h2>
               <button onClick={() => setShowCronModal(true)} className="flex items-center gap-1 text-[10px] uppercase font-bold text-accent-primary bg-accent-primary/10 px-2 py-1 rounded hover:bg-accent-primary/20 transition cursor-pointer border-none">
                 <Plus size={10} /> Add
               </button>
             </div>
             
             <div className="bg-bg-input/40 border border-border-subtle rounded-xl overflow-hidden shadow-xl backdrop-blur-md">
               {scheduledActivities.filter(a => a.source === sourceName).map(a => (
                 <div key={a.id} className="border-b border-border-subtle last:border-b-0 p-3 flex flex-col gap-1.5 relative group">
                   <div className="flex items-center justify-between">
                     <div className="text-sm font-semibold text-text-main">{a.name}</div>
                     <div className="flex items-center gap-1 text-accent-success bg-accent-success/10 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">
                       <Clock size={10} /> {a.cron}
                     </div>
                   </div>
                   <div className="text-xs text-text-muted line-clamp-2">{a.prompt}</div>
                   
                   <button onClick={() => handleDeleteCronSchedule(a.id)} className="absolute top-3 right-3 p-1 bg-accent-danger/10 text-accent-danger rounded opacity-0 group-hover:opacity-100 transition border-none cursor-pointer">
                     <Trash2 size={12} />
                   </button>
                 </div>
               ))}
               {scheduledActivities.filter(a => a.source === sourceName).length === 0 && (
                 <div className="p-8 text-center text-text-muted text-xs flex flex-col items-center justify-center gap-2 italic opacity-60">
                   <Calendar size={20} className="mb-1 opacity-40" />
                   <div>No scheduled jobs</div>
                 </div>
               )}
             </div>
           </div>

           <div className="bg-bg-surface border border-border-subtle rounded-xl p-4">
             <h3 className="text-[10px] font-bold text-text-muted uppercase mb-3 flex items-center gap-2">
               <Settings2 size={12} /> Repository Info
             </h3>
             <div className="flex flex-col gap-2.5">
               <div className="flex justify-between text-xs">
                 <span className="text-text-muted">ID</span>
                 <span className="text-text-main font-mono truncate max-w-[140px]">{source?.id}</span>
               </div>
               <div className="flex justify-between text-xs">
                 <span className="text-text-muted">Visibility</span>
                 <span className="text-text-main">{source?.githubRepo?.isPrivate ? 'Private' : 'Public'}</span>
               </div>
               <div className="flex justify-between text-xs">
                 <span className="text-text-muted">Default Branch</span>
                 <span className="text-text-main font-mono">{source?.githubRepo?.defaultBranch?.displayName || 'main'}</span>
               </div>
             </div>
           </div>
        </div>
      </div>

      {/* CREATE SESSION MODAL */}
      {showCreateModal && (
        <div className="modal-backdrop z-50 backdrop-blur-sm bg-bg-app/60">
          <div className="settings-container glassmorphism max-w-[520px] w-full animate-slide-in p-0 overflow-hidden border-border-subtle">
            <div className="p-4 border-b border-border-subtle flex items-center justify-between bg-bg-surface">
              <h3 className="text-sm font-bold text-text-bright font-mono flex items-center gap-2 uppercase tracking-wider">
                <Plus size={16} className="text-accent-primary" /> New Vibe Session
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 rounded text-text-muted hover:text-text-bright bg-bg-surface-hover transition border-none cursor-pointer">
                <X size={16} />
              </button>
            </div>
            
            <form onSubmit={handleCreateSession} className="p-6 flex flex-col gap-5">
              <div className="form-group">
                <label className="text-[10px] uppercase font-bold text-text-muted font-mono mb-2 block tracking-widest">Session Title</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. Implement authentication feature" 
                  value={titleInput} 
                  onChange={(e) => setTitleInput(e.target.value)} 
                  className="form-input text-text-bright w-full" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="text-[10px] uppercase font-bold text-text-muted font-mono mb-2 block tracking-widest">Source</label>
                  <div className="bg-bg-input border border-border-subtle rounded-lg py-2 px-3 text-xs text-text-muted font-mono truncate">
                    {repoDisplayName}
                  </div>
                </div>
                <div className="form-group">
                  <label className="text-[10px] uppercase font-bold text-text-muted font-mono mb-2 block tracking-widest">Target Branch</label>
                  <select 
                    value={selectedBranch} 
                    onChange={(e) => setSelectedBranch(e.target.value)} 
                    className="w-full bg-bg-input text-text-main border border-border-subtle rounded-lg py-2 px-3 text-xs outline-none cursor-pointer focus:border-border-focus appearance-none font-mono transition-colors"
                  >
                    {source?.githubRepo?.branches?.map(b => (
                      <option key={b.displayName} value={b.displayName}>{b.displayName}</option>
                    )) || <option value="main">main</option>}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="text-[10px] uppercase font-bold text-text-muted font-mono mb-2 block tracking-widest">Goal & Instructions</label>
                <textarea 
                  required 
                  placeholder="Describe the feature or fix you want Jules to build..." 
                  value={promptInput} 
                  onChange={(e) => setPromptInput(e.target.value)} 
                  className="form-input text-text-bright text-sm w-full min-h-[140px] resize-none" 
                />
              </div>

              <button 
                type="submit" 
                disabled={!titleInput.trim() || !promptInput.trim()}
                className="w-full py-3 bg-accent-primary hover:bg-accent-primary/80 disabled:bg-bg-surface-hover disabled:text-text-muted text-text-bright font-bold text-sm rounded-xl transition shadow-primary-glow flex items-center justify-center gap-2 cursor-pointer border-none font-mono tracking-widest mt-2"
              >
                <Play size={14} fill="currentColor" /> INITIATE WORKFLOW
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CRON MODAL (simplified) */}
      {showCronModal && (
        <div className="modal-backdrop z-50 backdrop-blur-sm bg-bg-app/60">
          <div className="settings-container glassmorphism max-w-[480px] w-full animate-slide-in">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3 mb-4">
              <span className="text-sm font-semibold text-text-bright flex items-center gap-2 font-mono uppercase tracking-wider">
                <Clock size={15} className="text-accent-primary" /> Schedule Activity Cron
              </span>
              <button onClick={() => setShowCronModal(false)} className="p-1 rounded text-text-muted hover:text-text-bright bg-bg-surface-hover transition border-none cursor-pointer">
                <X size={14} />
              </button>
            </div>
            
            <form onSubmit={handleCreateCronSchedule} className="flex flex-col gap-4">
              <div className="form-group">
                <label className="text-[10px] uppercase font-bold text-text-muted font-mono block mb-1">Activity Name</label>
                <input type="text" required placeholder="e.g. Daily Security Scan" value={cronName} onChange={(e) => setCronName(e.target.value)} className="form-input text-text-bright text-sm w-full" />
              </div>
              
              <div className="form-group">
                <label className="text-[10px] uppercase font-bold text-text-muted font-mono block mb-1">Cron Expression</label>
                <input type="text" required placeholder="0 0 * * *" value={cronExpression} onChange={(e) => setCronExpression(e.target.value)} className="form-input text-text-bright text-sm w-full font-mono bg-bg-input" />
              </div>

              <div className="form-group">
                <label className="text-[10px] uppercase font-bold text-text-muted font-mono block mb-1">Target Branch</label>
                <select value={cronBranch} onChange={(e) => setCronBranch(e.target.value)} className="w-full bg-bg-input text-text-main border border-border-subtle rounded-lg py-2 px-3 text-sm outline-none cursor-pointer focus:border-border-focus appearance-none font-mono">
                  {source?.githubRepo?.branches?.map(b => (
                    <option key={b.displayName} value={b.displayName}>{b.displayName}</option>
                  )) || <option value="main">main</option>}
                </select>
              </div>

              <div className="form-group">
                <label className="text-[10px] uppercase font-bold text-text-muted font-mono block mb-1">Instructions</label>
                <textarea required placeholder="Describe the recurring task..." value={cronPrompt} onChange={(e) => setCronPrompt(e.target.value)} className="form-input text-text-bright text-sm w-full min-h-[100px] resize-none" />
              </div>

              <button type="submit" className="btn-primary py-2.5 font-bold uppercase tracking-wider mt-2 font-mono text-xs cursor-pointer border-none rounded-lg text-text-bright bg-accent-primary hover:bg-accent-primary/80 transition-all shadow-primary-glow">
                Create Schedule
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
