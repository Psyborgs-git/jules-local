import { useState } from 'react';
import { Settings, Key, AlertCircle, Sparkles } from 'lucide-react';
import { julesApi } from '../julesApi';

export function SettingsDashboard({
  dbConfig,
  apiKeyInput,
  setApiKeyInput,
  verifyingKey,
  authError,
  handleSaveApiKeyToDb,
  handleDisconnectKey,
  dbSettings,
  reloadSettings,
  onClose
}: {
  dbConfig: { hasKey: boolean; maskedKey?: string } | null;
  apiKeyInput: string;
  setApiKeyInput: (val: string) => void;
  verifyingKey: boolean;
  authError: string | null;
  handleSaveApiKeyToDb: (e: React.FormEvent) => void;
  handleDisconnectKey: () => void;
  dbSettings: Record<string, string>;
  reloadSettings: () => void;
  onClose: () => void;
}) {
  const [gitName, setGitName] = useState(dbSettings.git_author_name || '');
  const [gitEmail, setGitEmail] = useState(dbSettings.git_author_email || '');
  const [verifyCmd, setVerifyCmd] = useState(dbSettings.verification_command || '');
  const [githubUrl, setGithubUrl] = useState(dbSettings.github_integration_url || 'https://github.com/apps/jules-ai-coder');
  const [autoMode, setAutoMode] = useState(dbSettings.default_automation_mode || 'MANUAL');


  const handleClearCache = () => {
    if (!confirm('Clear all settings and local cache? This will reset all preferences.')) return;
    localStorage.clear();
    alert('Settings cleared! Reloading...');
    window.location.reload();
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    Promise.all([
      julesApi.saveSetting('git_author_name', gitName),
      julesApi.saveSetting('git_author_email', gitEmail),
      julesApi.saveSetting('verification_command', verifyCmd),
      julesApi.saveSetting('github_integration_url', githubUrl),
      julesApi.saveSetting('default_automation_mode', autoMode),
    ])
      .then(() => {
        alert('Settings saved successfully!');
        reloadSettings();
        onClose();
      })
      .catch(err => {
        alert(`Failed to save preferences: ${err.message}`);
      });
  };

  return (
    <div className="settings-screen animate-slide-in">
      <div className="settings-container glassmorphism max-w-[620px] w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border-subtle pb-4 mb-6">
          <div className="flex items-center gap-2 text-text-main font-semibold text-sm">
            <Settings size={16} className="text-accent-primary" />
            <span>Settings & Configuration</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-text-muted hover:text-text-main bg-bg-surface border border-border-subtle rounded-lg px-2.5 py-1 cursor-pointer font-medium font-sans"
          >
            Close
          </button>
        </div>
        
        {/* API Credentials */}
        <section className="settings-section">
          <h3 className="section-title flex items-center gap-2 font-semibold font-mono uppercase tracking-wider text-text-main text-xs">
            <Key size={14} className="text-accent-primary" />
            Jules API Authentication
          </h3>
          <p className="section-desc mt-1">
            Your Jules API keys authorize vibe coding workflows and repository queries. Credentials are stored securely inside SQLite (`data.db`).
          </p>
          
          <div className="bg-bg-input/40 border border-border-subtle rounded-xl p-4 flex flex-col gap-4 mt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-muted">Connection Status</span>
              {dbConfig?.hasKey ? (
                <span className="text-[10px] font-bold text-accent-success bg-accent-success/10 border border-accent-success/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1 h-1 bg-accent-success rounded-full animate-pulse" /> Connected
                </span>
              ) : (
                <span className="text-[10px] font-bold text-accent-danger bg-accent-danger/10 border border-accent-danger/20 px-2.5 py-0.5 rounded-full">
                  Offline / Disconnected
                </span>
              )}
            </div>

            {dbConfig?.hasKey ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Authorized Masked Key</label>
                  <div className="text-xs font-mono text-text-main bg-bg-input px-3 py-2 rounded-lg border border-border-subtle truncate">
                    {dbConfig.maskedKey}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDisconnectKey}
                  className="btn-danger py-2 text-xs font-bold font-mono"
                >
                  Disconnect Credentials
                </button>
              </div>
            ) : (
              <form onSubmit={handleSaveApiKeyToDb} className="flex flex-col gap-3">
                <div className="form-group">
                  <label className="form-label text-[10px] uppercase tracking-wider text-text-muted mb-1 block">Jules API Key</label>
                  <input
                    type="password"
                    required
                    placeholder="Enter x-goog-api-key credential token"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    disabled={verifyingKey}
                    className="form-input text-text-bright font-mono text-sm w-full"
                  />
                </div>

                {authError && (
                  <div className="text-xs text-accent-danger bg-accent-danger/15 border border-accent-danger/25 p-3 rounded-lg flex items-start gap-1.5 leading-normal">
                    <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>{authError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={verifyingKey || !apiKeyInput.trim()}
                  className="btn-primary py-2.5 text-xs font-bold font-mono"
                >
                  {verifyingKey ? 'Validating credentials...' : 'Verify and Save to SQLite'}
                </button>
              </form>
            )}
          </div>
        </section>

        {/* Real Jules System Configurations */}
        <section className="settings-section mt-6">
          <h3 className="section-title flex items-center gap-2 font-semibold font-mono uppercase tracking-wider text-text-main text-xs">
            <Sparkles size={14} className="text-accent-primary" />
            Jules Agent Preferences
          </h3>
          <p className="section-desc mt-1">
            Specify Git author profile and workspace scripts that Jules uses to verify modifications.
          </p>

          <form onSubmit={handleSavePreferences} className="bg-bg-input/40 border border-border-subtle rounded-xl p-4 flex flex-col gap-4 mt-3 text-left">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label text-[10px] uppercase tracking-wider text-text-muted mb-1 block font-mono">Git Commit Name</label>
                <input
                  type="text"
                  placeholder="e.g. Jules AI"
                  value={gitName}
                  onChange={(e) => setGitName(e.target.value)}
                  className="form-input text-text-main text-xs w-full"
                />
              </div>
              <div className="form-group">
                <label className="form-label text-[10px] uppercase tracking-wider text-text-muted mb-1 block font-mono">Git Commit Email</label>
                <input
                  type="email"
                  placeholder="e.g. jules-bot@google.com"
                  value={gitEmail}
                  onChange={(e) => setGitEmail(e.target.value)}
                  className="form-input text-text-main text-xs w-full"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label text-[10px] uppercase tracking-wider text-text-muted mb-1 block font-mono">Pre-Verification Command</label>
              <input
                type="text"
                placeholder="e.g. npm run test, pnpm lint, mvn clean compile test"
                value={verifyCmd}
                onChange={(e) => setVerifyCmd(e.target.value)}
                className="form-input text-text-main text-xs w-full font-mono"
              />
              <span className="text-[9px] text-text-muted block mt-1 opacity-70">If defined, Jules will automatically execute this script to ensure builds pass before completing tasks.</span>
            </div>

            <div className="form-group">
              <label className="form-label text-[10px] uppercase tracking-wider text-text-muted mb-1 block font-mono">GitHub App Installation URL</label>
              <input
                type="text"
                placeholder="https://github.com/apps/jules-ai-coder"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                className="form-input text-text-main text-xs w-full font-mono"
              />
              <span className="text-[9px] text-text-muted block mt-1 opacity-70">
                Configure your connected repositories integration app page.
                <a href={githubUrl} target="_blank" rel="noopener noreferrer" className="text-accent-primary hover:underline ml-1.5">Configure App on GitHub</a>
              </span>
            </div>

            <div className="form-group">
              <label className="form-label text-[10px] uppercase tracking-wider text-text-muted mb-1 block font-mono">Default Automation Mode</label>
              <select
                value={autoMode}
                onChange={(e) => setAutoMode(e.target.value)}
                className="bg-bg-input text-text-main border border-border-subtle rounded-xl px-3 py-2 text-xs outline-none cursor-pointer w-full"
              >
                <option value="MANUAL">Manual Pull Request Creation</option>
                <option value="AUTO_CREATE_PR">Automatic Pull Request Bundle on Success</option>
              </select>
            </div>

            <button
              type="submit"
              className="btn-primary py-2 text-xs font-bold font-mono mt-2"
            >
              Save Preferences
            </button>
          </form>
        </section>

        {/* Cache & Danger Zone */}
        <section className="settings-section mt-6 border-t border-border-subtle pt-6">
          <h3 className="section-title text-accent-danger flex items-center gap-2 font-semibold font-mono uppercase tracking-wider text-xs">
            <AlertCircle size={14} className="text-accent-danger" />
            Danger Zone
          </h3>
          <p className="section-desc mt-1">
            Clear locally saved state and configuration parameters.
          </p>
          <div className="mt-3">
            <button
              type="button"
              onClick={handleClearCache}
              className="py-2.5 px-4 bg-accent-danger/10 hover:bg-accent-danger/20 text-accent-danger font-bold border border-accent-danger/20 rounded-xl transition cursor-pointer w-full font-mono"
            >
              Reset Application Cache & Settings
            </button>
          </div>
        </section>
        
      </div>
    </div>
  );
}
