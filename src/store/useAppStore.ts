import { create } from 'zustand';
import type { Source, Session, Activity, ScheduledActivity } from '../julesApi';

interface AppState {
  // Theme state
  cyberTheme: 'dark' | 'light';
  setCyberTheme: (theme: 'dark' | 'light') => void;

  // DB Config state
  dbConfig: { hasKey: boolean; maskedKey?: string } | null;
  setDbConfig: (config: { hasKey: boolean; maskedKey?: string } | null) => void;

  // Global app context
  currentSourceHub: string | null;
  setCurrentSourceHub: (sourceHub: string | null) => void;

  // Settings modals
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;

  // Layout states
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  rightSidebarCollapsed: boolean;
  setRightSidebarCollapsed: (collapsed: boolean) => void;
  rightSidebarWidth: number;
  setRightSidebarWidth: (width: number) => void;
  activeRightTab: 'diffs' | 'terminal';
  setActiveRightTab: (tab: 'diffs' | 'terminal') => void;

  // Data
  sessions: Session[];
  setSessions: (sessions: Session[] | ((prev: Session[]) => Session[])) => void;
  activities: Activity[];
  setActivities: (activities: Activity[] | ((prev: Activity[]) => Activity[])) => void;
  allSources: Source[];
  setAllSources: (sources: Source[]) => void;
  selectedSourceDetails: Source | null;
  setSelectedSourceDetails: (source: Source | null) => void;
  scheduledActivities: ScheduledActivity[];
  setScheduledActivities: (activities: ScheduledActivity[] | ((prev: ScheduledActivity[]) => ScheduledActivity[])) => void;

  // Preferences / Automation
  requireApproval: boolean;
  setRequireApproval: (require: boolean) => void;
  autoPR: boolean;
  setAutoPR: (autoPR: boolean) => void;

  // Status messages
  statusMsg: { text: string; error?: boolean } | null;
  setStatusMsg: (msg: { text: string; error?: boolean } | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  cyberTheme: (localStorage.getItem('jules_cyber_theme') as 'dark' | 'light') || 'dark',
  setCyberTheme: (theme) => {
    localStorage.setItem('jules_cyber_theme', theme);
    document.body.className = `cyber-${theme}`;
    set({ cyberTheme: theme });
  },

  dbConfig: null,
  setDbConfig: (config) => set({ dbConfig: config }),

  currentSourceHub: null,
  setCurrentSourceHub: (hub) => set({ currentSourceHub: hub }),

  showSettings: false,
  setShowSettings: (show) => set({ showSettings: show }),

  sidebarCollapsed: localStorage.getItem('jules_sidebar_collapsed') === 'true',
  setSidebarCollapsed: (collapsed) => {
    localStorage.setItem('jules_sidebar_collapsed', String(collapsed));
    set({ sidebarCollapsed: collapsed });
  },
  sidebarWidth: Number(localStorage.getItem('jules_sidebar_width')) || 280,
  setSidebarWidth: (width) => {
    localStorage.setItem('jules_sidebar_width', String(width));
    set({ sidebarWidth: width });
  },

  rightSidebarCollapsed: true,
  setRightSidebarCollapsed: (collapsed) => set({ rightSidebarCollapsed: collapsed }),
  rightSidebarWidth: Number(localStorage.getItem('jules_right_sidebar_width')) || 440,
  setRightSidebarWidth: (width) => {
    localStorage.setItem('jules_right_sidebar_width', String(width));
    set({ rightSidebarWidth: width });
  },
  activeRightTab: 'diffs',
  setActiveRightTab: (tab) => set({ activeRightTab: tab }),

  sessions: [],
  setSessions: (sessions) => set((state) => ({ sessions: typeof sessions === 'function' ? sessions(state.sessions) : sessions })),
  activities: [],
  setActivities: (activities) => set((state) => ({ activities: typeof activities === 'function' ? activities(state.activities) : activities })),
  
  allSources: [],
  setAllSources: (sources) => set({ allSources: sources }),
  selectedSourceDetails: null,
  setSelectedSourceDetails: (source) => set({ selectedSourceDetails: source }),

  scheduledActivities: (() => {
    const saved = localStorage.getItem('jules_schedules');
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return [
      { id: 'sched-1', name: 'Daily Security Audit', source: 'sources/github/Psyborgs-git/APEX', branch: 'main', cron: '0 4 * * *', prompt: 'Audit codebase for deprecated packages or insecure configurations and fix them.', createTime: new Date().toISOString() }
    ];
  })(),
  setScheduledActivities: (activities) => set((state) => {
    const newActivities = typeof activities === 'function' ? activities(state.scheduledActivities) : activities;
    localStorage.setItem('jules_schedules', JSON.stringify(newActivities));
    return { scheduledActivities: newActivities };
  }),

  requireApproval: localStorage.getItem('jules_default_require_approval') !== 'false',
  setRequireApproval: (requireApproval) => {
    localStorage.setItem('jules_default_require_approval', String(requireApproval));
    set({ requireApproval });
  },

  autoPR: localStorage.getItem('jules_default_auto_pr') === 'true',
  setAutoPR: (autoPR) => {
    localStorage.setItem('jules_default_auto_pr', String(autoPR));
    set({ autoPR });
  },

  statusMsg: null,
  setStatusMsg: (msg) => set({ statusMsg: msg }),
}));
