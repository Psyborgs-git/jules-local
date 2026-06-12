import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, Outlet } from 'react-router-dom';
import { X } from 'lucide-react';
import { julesApi, type BashOutput } from './julesApi';
import { useAppStore } from './store/useAppStore';

import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { ResizeHandle } from './components/layout/ResizeHandle';
import { SettingsDashboard } from './components/SettingsDashboard';
import { DiffVisualizer } from './components/DiffVisualizer';
import { TerminalWindow } from './components/TerminalWindow';
import { parseUnifiedDiff, type FileDiff } from './utils/diff';
import './App.css';

export default function App() {
  const { id: sessionIdFromUrl } = useParams<{ id: string }>();

  const {
    dbConfig,
    setDbConfig,
    cyberTheme,
    setCyberTheme,
    setSessions,
    activities,
    setAllSources,
    selectedSourceDetails,
    setSelectedSourceDetails,
    setCurrentSourceHub,
    showSettings,
    setShowSettings,
    sidebarCollapsed,
    setSidebarCollapsed,
    rightSidebarCollapsed,
    setRightSidebarCollapsed,
    rightSidebarWidth,
    setRightSidebarWidth,
    activeRightTab,
    setActiveRightTab,
    setStatusMsg,
    setAutoPR
  } = useAppStore();

  // Local state for Settings form
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [verifyingKey, setVerifyingKey] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [dbSettings, setDbSettings] = useState<Record<string, string>>({});

  const fetchDbStatus = useCallback(() => {
    julesApi.getApiKeyStatus()
      .then(res => setDbConfig(res))
      .catch(() => setDbConfig({ hasKey: false }));
  }, [setDbConfig]);

  const loadDbSettings = useCallback(() => {
    julesApi.getSettings()
      .then(res => {
        setDbSettings(res);
        if (res.default_automation_mode) {
          setAutoPR(res.default_automation_mode === 'AUTO_CREATE_PR');
        }
        if (res.theme && (res.theme === 'dark' || res.theme === 'light')) {
          setCyberTheme(res.theme as 'dark' | 'light');
        }
      })
      .catch(err => console.error('Failed to load settings:', err));
  }, [setAutoPR, setCyberTheme]);

  useEffect(() => {
    if (sessionIdFromUrl) {
      setCurrentSourceHub(null);
    }
  }, [sessionIdFromUrl, setCurrentSourceHub]);

  useEffect(() => {
    fetchDbStatus();
    loadDbSettings();
  }, [fetchDbStatus, loadDbSettings]);

  useEffect(() => {
    if (dbConfig?.hasKey) {
      julesApi.listSessions()
        .then(res => setSessions(res.sessions))
        .catch(console.error);

      julesApi.listSources('', '', 100)
        .then(res => {
          setAllSources(res.sources);
          if (res.sources.length > 0 && !selectedSourceDetails) {
            setSelectedSourceDetails(res.sources[0]);
          }
        })
        .catch(console.error);
    } else {
      setSessions([]);
      setAllSources([]);
    }
  }, [dbConfig, setSessions, setAllSources, setSelectedSourceDetails, selectedSourceDetails]);

  // Global SSE for sessions list updates
  useEffect(() => {
    if (!dbConfig?.hasKey) return;

    const eventSource = new EventSource('/api/events');

    eventSource.onmessage = (event) => {
      try {
        const { type, data } = JSON.parse(event.data);
        if (type === 'sessions') {
          setSessions(data);
        }
      } catch (err) {
        console.error('Failed to parse SSE data:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE Error:', err);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [dbConfig, setSessions]);

  const handleSaveApiKeyToDb = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) return;
    setVerifyingKey(true);
    setAuthError(null);
    julesApi.saveApiKey(apiKeyInput)
      .then(() => {
        setApiKeyInput('');
        fetchDbStatus();
        setStatusMsg({ text: 'API Key successfully verified and saved in SQLite database.' });
        setTimeout(() => setStatusMsg(null), 3000);
      })
      .catch(err => setAuthError(err.message || 'Verification failed. Please verify credentials.'))
      .finally(() => setVerifyingKey(false));
  };

  const handleDisconnectKey = () => {
    if (!confirm('Disconnect API configuration? This clears settings from the local SQLite database.')) return;
    julesApi.deleteApiKey()
      .then(() => {
        fetchDbStatus();
        window.location.href = '/';
        setStatusMsg({ text: 'Configuration cleared from SQLite database.' });
        setTimeout(() => setStatusMsg(null), 3000);
      })
      .catch(err => setStatusMsg({ text: `Failed to clear key: ${err.message}`, error: true }));
  };

  const aggregatedDiffs = useMemo(() => {
    const diffMap: Record<string, FileDiff> = {};
    activities.forEach(act => {
      (act.artifacts || []).forEach(art => {
        if (art.changeSet?.gitPatch.unidiffPatch) {
          const files = parseUnifiedDiff(art.changeSet.gitPatch.unidiffPatch);
          files.forEach(file => {
            const path = file.newPath || file.oldPath;
            if (!diffMap[path]) {
              diffMap[path] = { ...file, lines: [...file.lines] };
            } else {
              diffMap[path].additions += file.additions;
              diffMap[path].deletions += file.deletions;
              diffMap[path].lines.push(...file.lines);
            }
          });
        }
      });
    });
    return Object.values(diffMap);
  }, [activities]);

  const aggregatedLogs = useMemo(() => {
    return activities
      .flatMap(act => (act.artifacts || []).map(art => art.bashOutput))
      .filter(Boolean) as BashOutput[];
  }, [activities]);

  const handleRightResize = useCallback((delta: number) => {
    const newWidth = Math.max(300, Math.min(800, rightSidebarWidth - delta));
    setRightSidebarWidth(newWidth);
  }, [rightSidebarWidth, setRightSidebarWidth]);

  return (
    <div className={`app-layout font-sans text-text-main theme-${cyberTheme}`}>
      {/* Mobile Backdrop for Left Sidebar */}
      {!sidebarCollapsed && (
        <div 
          className="fixed inset-0 bg-bg-app/60 backdrop-blur-sm z-[90] md:hidden"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}

      <Sidebar />

      <main className="main-window">
        <Header />

        <div className="flex-1 overflow-hidden flex relative">
          <div className="flex-1 overflow-y-auto w-full">
            <div className="mx-auto max-w-4xl w-full px-4 md:px-6 pt-6 pb-32">
              <Outlet />
            </div>
          </div>

          {!rightSidebarCollapsed && (
            <>
              {/* Backdrop for Right Sidebar Drawer */}
              <div 
                className="fixed inset-0 bg-bg-app/50 backdrop-blur-md z-[80]"
                onClick={() => setRightSidebarCollapsed(true)}
              />
              <aside 
                className="right-sidebar bg-bg-sidebar border-l border-border-subtle flex flex-col z-[85] shadow-2xl animate-slide-in"
                style={{ width: rightSidebarWidth, minWidth: rightSidebarWidth }}
              >
              <ResizeHandle onResize={handleRightResize} direction="left" className="hidden md:block" />
              <div className="p-3 border-b border-border-subtle flex items-center justify-between">
                <span className="font-semibold text-text-main text-sm font-mono">Session Artifacts</span>
                <button type="button" onClick={() => setRightSidebarCollapsed(true)} className="p-1 rounded text-text-muted hover:text-text-bright hover:bg-bg-surface-hover transition bg-transparent border-none cursor-pointer">
                  <X size={14} />
                </button>
              </div>

              <div className="flex border-b border-border-subtle">
                <button type="button" onClick={() => setActiveRightTab('diffs')} className={`flex-1 py-2 text-xs font-semibold cursor-pointer border-none transition-colors font-mono ${activeRightTab === 'diffs' ? 'bg-bg-surface-hover text-accent-primary border-b-2 border-accent-primary' : 'bg-transparent text-text-muted hover:text-text-main hover:bg-bg-surface-hover/50'}`}>
                  Code Changes
                </button>
                <button type="button" onClick={() => setActiveRightTab('terminal')} className={`flex-1 py-2 text-xs font-semibold cursor-pointer border-none transition-colors font-mono ${activeRightTab === 'terminal' ? 'bg-bg-surface-hover text-accent-primary border-b-2 border-accent-primary' : 'bg-transparent text-text-muted hover:text-text-main hover:bg-bg-surface-hover/50'}`}>
                  Terminal Logs
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 bg-transparent">
                {activeRightTab === 'diffs' ? (
                  <div className="flex flex-col gap-2">
                    {aggregatedDiffs.length === 0 ? (
                      <div className="text-center text-text-muted text-[11px] py-8 font-mono">No code changes in this session</div>
                    ) : (
                      <DiffVisualizer aggregatedFiles={aggregatedDiffs} />
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {aggregatedLogs.length === 0 ? (
                      <div className="text-center text-text-muted text-[11px] py-8 font-mono">No terminal logs in this session</div>
                    ) : (
                      aggregatedLogs.map((log, idx) => (
                        <TerminalWindow key={idx} command={log.command} output={log.output} />
                      ))
                    )}
                  </div>
                )}
              </div>
            </aside>
          </>
          )}
        </div>
      </main>

      {showSettings && (
        <div className="modal-backdrop z-[100] backdrop-blur-xl bg-bg-app/80">
          <SettingsDashboard
            dbConfig={dbConfig}
            apiKeyInput={apiKeyInput}
            setApiKeyInput={setApiKeyInput}
            verifyingKey={verifyingKey}
            authError={authError}
            handleSaveApiKeyToDb={handleSaveApiKeyToDb}
            handleDisconnectKey={handleDisconnectKey}
            dbSettings={dbSettings}
            reloadSettings={loadDbSettings}
            onClose={() => setShowSettings(false)}
          />
        </div>
      )}
    </div>
  );
}
