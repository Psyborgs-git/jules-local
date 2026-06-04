import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Globe, ExternalLink, ChevronRight, Sparkles } from 'lucide-react';
import { GithubIcon as Github } from '../GithubIcon';
import { useAppStore } from '../../store/useAppStore';

export const HomeView = () => {
  const navigate = useNavigate();
  const { allSources } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSources = useMemo(() => {
    return allSources.filter(s => {
      const name = s.githubRepo ? `${s.githubRepo.owner}/${s.githubRepo.repo}` : s.name;
      return name.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [allSources, searchQuery]);

  return (
    <div className="mt-12 animate-fade-in max-w-5xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold font-mono text-text-bright mb-4 flex items-center justify-center gap-4">
          <Sparkles className="text-accent-primary" size={32} />
          Jules AI Coder
        </h1>
        <p className="text-text-muted text-lg max-w-2xl mx-auto">
          Welcome to your vibe coding environment. Select a repository below to manage sessions,
          view activity history, or initiate new AI-driven workflows.
        </p>
      </div>

      <div className="mb-10 relative max-w-xl mx-auto">
        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          placeholder="Search your repositories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-bg-input/40 border border-border-subtle rounded-2xl py-4 pl-12 pr-4 text-text-main focus:border-border-focus focus:ring-4 focus:ring-accent-primary/10 outline-none transition-all shadow-2xl backdrop-blur-md"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredSources.length > 0 ? (
          filteredSources.map((source) => {
            const isGithub = !!source.githubRepo;
            const repoOwner = source.githubRepo ? source.githubRepo.owner : '';
            const repoSimpleName = source.githubRepo ? source.githubRepo.repo : source.name;

            return (
              <div
                key={source.id}
                className="group relative bg-bg-input/40 border border-border-subtle rounded-2xl p-5 hover:border-border-focus hover:bg-bg-surface-hover transition-all cursor-pointer shadow-lg backdrop-blur-sm"
                onClick={() => navigate(`/source/${source.name}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-bg-surface flex items-center justify-center text-text-muted group-hover:text-accent-primary group-hover:bg-accent-primary/10 transition-colors">
                      {isGithub ? <Github size={24} /> : <Globe size={24} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-text-bright group-hover:text-text-bright transition-colors">{repoSimpleName}</h3>
                        {source.githubRepo?.isPrivate && (
                          <span className="text-[9px] font-bold bg-bg-surface text-text-muted px-1.5 py-0.5 rounded uppercase tracking-wider">Private</span>
                        )}
                      </div>
                      <p className="text-xs text-text-muted font-mono mt-0.5">{repoOwner || 'local source'}</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-text-muted opacity-40 group-hover:text-accent-primary group-hover:translate-x-1 group-hover:opacity-100 transition-all" />
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-border-subtle pt-4">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-text-muted tracking-widest opacity-60">Branch</span>
                      <span className="text-xs text-text-muted font-mono">{source.githubRepo?.defaultBranch?.displayName || 'main'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-accent-primary opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-wider">
                    View Hub <ExternalLink size={10} />
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-20 text-center bg-bg-input/20 border border-dashed border-border-subtle rounded-3xl">
            <div className="text-text-muted font-mono italic">
              {allSources.length === 0
                ? "No repositories found. Connect your GitHub account in Settings."
                : "No matching repositories found."}
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-4 text-accent-primary text-sm hover:underline bg-transparent border-none cursor-pointer"
              >
                Clear search filter
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-16 p-8 bg-accent-primary/5 border border-accent-primary/10 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 backdrop-blur-sm">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-accent-primary/10 flex items-center justify-center text-accent-primary flex-shrink-0 shadow-primary-glow">
            <Sparkles size={32} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-text-bright mb-1">Getting Started</h2>
            <p className="text-text-muted text-sm leading-relaxed">
              Jules can help you build features, fix bugs, and refactor code.
              Select a repository above to start a session and provide your first set of instructions.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 font-mono text-[10px] text-text-muted uppercase tracking-widest whitespace-nowrap opacity-60">
          <span>Powered by Gemini</span>
          <span className="w-1 h-1 bg-text-muted/40 rounded-full"></span>
          <span>SQLite Native</span>
        </div>
      </div>
    </div>
  );
};
