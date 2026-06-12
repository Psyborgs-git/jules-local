export interface GitHubBranch {
  displayName: string;
}

export interface GitHubRepo {
  owner: string;
  repo: string;
  isPrivate: boolean;
  defaultBranch?: GitHubBranch;
  branches?: GitHubBranch[];
}

export interface Source {
  name: string; // "sources/..."
  id: string;
  githubRepo?: GitHubRepo;
}

export interface Session {
  name: string; // "sessions/..."
  id: string;
  prompt: string;
  title: string;
  state: 'QUEUED' | 'PLANNING' | 'AWAITING_PLAN_APPROVAL' | 'AWAITING_USER_FEEDBACK' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'FAILED';
  url?: string;
  createTime: string;
  updateTime: string;
  outputs?: Array<{
    pullRequest?: {
      url: string;
      title: string;
      description: string;
    };
  }>;
}

export interface PlanStep {
  id: string;
  index: number;
  title: string;
  description: string;
}

export interface Plan {
  id: string;
  steps: PlanStep[];
  createTime: string;
}

export interface GitPatch {
  baseCommitId: string;
  unidiffPatch: string;
  suggestedCommitMessage: string;
}

export interface ChangeSet {
  source: string;
  gitPatch: GitPatch;
}

export interface BashOutput {
  command: string;
  output: string;
  exitCode: number;
}

export interface Media {
  mimeType: string;
  data: string; // base64
}

export interface Artifact {
  changeSet?: ChangeSet;
  bashOutput?: BashOutput;
  media?: Media;
}

export interface Activity {
  name: string; // "sessions/.../activities/..."
  id: string;
  originator: 'system' | 'agent' | 'user';
  description: string;
  createTime: string;
  planGenerated?: {
    plan: Plan;
  };
  planApproved?: {
    planId: string;
  };
  userMessaged?: {
    userMessage: string;
  };
  agentMessaged?: {
    agentMessage: string;
  };
  progressUpdated?: {
    title: string;
    description: string;
  };
  sessionCompleted?: Record<string, never>;
  sessionFailed?: {
    reason: string;
  };
  artifacts?: Artifact[];
}

// Routes queries through local Express server which appends API credentials from SQLite
const BASE_API_URL = '/api';

async function request<T>(
  path: string,
  method: 'GET' | 'POST' | 'DELETE' = 'GET',
  body?: unknown
): Promise<T> {
  const headers: Record<string, string> = {};

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${BASE_API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let errorMsg = `Request failed with status ${response.status}`;
    try {
      const errJson = await response.json() as { error?: string | { message?: string } };
      if (typeof errJson.error === 'string') {
        errorMsg = errJson.error;
      } else if (errJson.error?.message) {
        errorMsg = errJson.error.message;
      }
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  if (method === 'DELETE' || response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

export interface ScheduledActivity {
  id: string;
  name: string;
  source: string;
  branch: string;
  cron: string;
  prompt: string;
  createTime: string;
}

export interface DbConfigStatus {
  hasKey: boolean;
  maskedKey?: string;
}

export const julesApi = {
  // DB configurations endpoints
  getApiKeyStatus: async (): Promise<DbConfigStatus> => {
    const res = await fetch('/api/config');
    if (!res.ok) throw new Error('Failed to retrieve key configuration from database.');
    return res.json() as Promise<DbConfigStatus>;
  },

  saveApiKey: async (apiKey: string): Promise<{ success: boolean }> => {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey })
    });
    if (!res.ok) {
      let message = 'Failed to save configuration.';
      try {
        const errJson = await res.json() as { error?: string };
        if (errJson.error) message = errJson.error;
      } catch {
        // ignore
      }
      throw new Error(message);
    }
    return res.json() as Promise<{ success: boolean }>;
  },

  deleteApiKey: async (): Promise<{ success: boolean }> => {
    const res = await fetch('/api/config', { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete key configuration from database.');
    return res.json() as Promise<{ success: boolean }>;
  },

  getSettings: async (): Promise<Record<string, string> & { hasKey?: boolean; maskedKey?: string }> => {
    const res = await fetch('/api/settings');
    if (!res.ok) throw new Error('Failed to retrieve settings from database.');
    return res.json();
  },

  saveSetting: async (key: string, value: string): Promise<{ success: boolean }> => {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value })
    });
    if (!res.ok) {
      let message = 'Failed to save setting.';
      try {
        const errJson = await res.json() as { error?: string };
        if (errJson.error) message = errJson.error;
      } catch {
        // ignore
      }
      throw new Error(message);
    }
    return res.json();
  },

  // Proxied Jules REST API operations
  listSources: async (
    query?: string,
    pageToken?: string,
    pageSize: number = 30
  ): Promise<{ sources: Source[]; nextPageToken?: string }> => {
    let path = `/sources?pageSize=${pageSize}`;
    if (pageToken) path += `&pageToken=${encodeURIComponent(pageToken)}`;
    if (query) {
      // AIP-160 filter: matches substring of owner or repo
      const filterExpr = `githubRepo.repo = "*${query}*" OR githubRepo.owner = "*${query}*"`;
      path += `&filter=${encodeURIComponent(filterExpr)}`;
    }
    const res = await request<{ sources?: Source[]; nextPageToken?: string }>(path);
    return {
      sources: res.sources || [],
      nextPageToken: res.nextPageToken
    };
  },

  getSource: async (sourceId: string): Promise<Source> => {
    return request<Source>(`/sources/${sourceId}`);
  },

  listSessions: async (
    query?: string,
    pageToken?: string,
    pageSize?: number
  ): Promise<{ sessions: Session[]; nextPageToken?: string }> => {
    let path = '/sessions';
    const params: string[] = [];
    if (pageSize !== undefined && pageSize !== null) params.push(`pageSize=${pageSize}`);
    if (pageToken) params.push(`pageToken=${encodeURIComponent(pageToken)}`);
    if (query) params.push(`query=${encodeURIComponent(query)}`);
    if (params.length > 0) path += `?${params.join('&')}`;

    const res = await request<{ sessions?: Session[]; nextPageToken?: string }>(path);
    return {
      sessions: res.sessions || [],
      nextPageToken: res.nextPageToken
    };
  },

  createSession: async (
    params: {
      prompt: string;
      title?: string;
      sourceContext?: {
        source: string;
        githubRepoContext: {
          startingBranch: string;
        };
      };
      requirePlanApproval?: boolean;
      automationMode?: 'AUTO_CREATE_PR' | 'MANUAL';
    }
  ): Promise<Session> => {
    return request<Session>('/sessions', 'POST', params);
  },

  getSession: async (sessionId: string): Promise<Session> => {
    return request<Session>(`/sessions/${sessionId}`);
  },

  deleteSession: async (sessionId: string): Promise<void> => {
    await request<void>(`/sessions/${sessionId}`, 'DELETE');
  },

  sendMessage: async (sessionId: string, prompt: string): Promise<void> => {
    await request<void>(`/sessions/${sessionId}/sendMessage`, 'POST', { prompt });
  },

  approvePlan: async (sessionId: string): Promise<void> => {
    await request<void>(`/sessions/${sessionId}/approvePlan`, 'POST', {});
  },

  listActivities: async (sessionId: string): Promise<Activity[]> => {
    const res = await request<{ activities?: Activity[] }>(`/sessions/${sessionId}/activities`);
    return res.activities || [];
  },
};
