import React, { useMemo, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Code2, Terminal as TerminalIcon, FileCode, CheckSquare, ChevronRight, ChevronDown } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { julesApi, type Activity } from '../../julesApi';
import { CollapsibleMessage } from './CollapsibleMessage';
import { PlanAccordionCard } from '../PlanAccordionCard';
import { ActivityFiles } from '../ActivityFiles';
import { MessageComposer } from './MessageComposer';

const ProgressGroup = React.memo(({ activities }: { activities: Activity[] }) => {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  if (!activities || activities.length === 0) return null;

  return (
    <div className="flex flex-col my-4">
      <div 
        className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-bg-surface-hover rounded-lg transition-colors w-fit group"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex -space-x-1">
          {activities.slice(0, 3).map((act) => (
            <CheckSquare key={act.id} size={14} className="text-accent-success bg-bg-app rounded-sm" />
          ))}
        </div>
        <span className="text-[10px] font-bold text-text-main uppercase tracking-widest font-mono group-hover:text-accent-success transition-colors">
          {activities.length} internal steps {isCollapsed ? '[+]' : '[-]'}
        </span>
      </div>

      {!isCollapsed && (
        <div className="flex flex-col gap-1 border-l-2 border-accent-success/30 ml-3 pl-3 py-1 my-1 bg-accent-success/5 rounded-r-lg animate-slide-in">
          {activities.map(act => (
            <div key={act.id} className="flex items-start gap-2 py-1">
              <CheckSquare size={14} className="text-accent-success flex-shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-accent-success font-mono">{act.progressUpdated?.title}</span>
                {act.progressUpdated?.description && (
                  <span className="text-[11px] text-text-muted">{act.progressUpdated.description}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

const ChatMessage = React.memo(({ act, isLastAwaitingApproval, sessionId }: { act: Activity, isLastAwaitingApproval: boolean, sessionId: string }) => {
  const {
    setSessions,
    setActiveRightTab,
    setRightSidebarCollapsed,
    setStatusMsg
  } = useAppStore();

  const isSystem = act.originator === 'system';
  const isUser = act.originator === 'user';

  const handleApprovePlan = () => {
    if (!sessionId) return;
    julesApi.approvePlan(sessionId)
      .then(() => julesApi.getSession(sessionId))
      .then(updated => setSessions(prev => prev.map(s => s.id === updated.id ? updated : s)))
      .catch(err => setStatusMsg({ text: `Approval failed: ${err.message}`, error: true }));
  };

  const userText = act.userMessaged?.userMessage || (act.userMessaged as unknown as { message: string })?.message || act.description || '';

  return (
    <div className={`message-row flex w-full my-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`message-bubble max-w-[85%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`p-4 rounded-2xl border ${isUser
          ? 'bg-bg-surface text-text-bright rounded-tr-sm border-border-subtle shadow-lg backdrop-blur-md'
          : isSystem
            ? 'bg-transparent text-text-main rounded-tl-sm border-transparent'
            : 'bg-transparent text-text-main rounded-tl-sm border-transparent'
          }`}>

          {act.userMessaged && (
            <div className="whitespace-pre-wrap text-sm font-sans">{userText}</div>
          )}

          {act.agentMessaged && (
            <CollapsibleMessage text={act.agentMessaged.agentMessage} />
          )}

          {act.planGenerated && (
            <PlanAccordionCard
              planActivity={act}
              isActiveSessionAwaitingApproval={isLastAwaitingApproval}
              onApprove={handleApprovePlan}
            />
          )}

          {act.planApproved && (
            <div className="flex items-center gap-2 text-accent-success font-semibold text-sm">
              <CheckSquare size={16} /> Plan Approved
            </div>
          )}

          {act.sessionCompleted && (
            <div className="flex items-center gap-2 text-accent-success font-semibold text-sm">
              <CheckSquare size={16} /> Session Completed successfully!
            </div>
          )}

          {act.sessionFailed && (
            <div className="flex items-center gap-2 text-accent-danger font-semibold text-sm">
              <span>⚠️ Session Failed: {act.sessionFailed.reason}</span>
            </div>
          )}

          {act.description && act.description.includes('Created artifact') && (
            <ActivityFiles artifacts={act.artifacts || []} />
          )}

          {(act.artifacts || []).length > 0 && (
            <div className="mt-4 flex flex-col gap-2 border-t border-border-subtle pt-4 w-full">
              <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider font-mono mb-1">Execution Logs & Artifacts</div>
              <div className="flex flex-col gap-2">
                {(act.artifacts || []).filter(art => {
                  const isCreatingArtifact = act.description && act.description.includes('Created artifact');
                  if (isCreatingArtifact && art.changeSet) return false;
                  return true;
                }).map((art, aIdx) => {
                  const patch = art.changeSet?.gitPatch?.unidiffPatch;
                  const bashOutput = art.bashOutput;
                  if (!patch && !bashOutput) return null;

                  const diffTitle = art.changeSet?.gitPatch.suggestedCommitMessage || art.changeSet?.source;
                  const logTitle = bashOutput?.command;

                  if (patch && !diffTitle) return null;
                  if (bashOutput && !logTitle) return null;

                  let additions = 0;
                  let deletions = 0;
                  if (patch) {
                    const lines = patch.split('\n');
                    lines.forEach(l => {
                      if (l.startsWith('+') && !l.startsWith('+++')) additions++;
                      else if (l.startsWith('-') && !l.startsWith('---')) deletions++;
                    });
                  }

                  return (
                    <div key={aIdx} className="flex flex-col sm:flex-row gap-2 items-stretch w-full">
                      {patch && (
                        <div 
                          onClick={() => {
                            setActiveRightTab('diffs');
                            setRightSidebarCollapsed(false);
                          }}
                          className="flex-1 flex items-center justify-between p-3 bg-accent-primary/5 hover:bg-accent-primary/10 border border-accent-primary/20 hover:border-accent-primary/40 rounded-xl transition-all cursor-pointer group/diff shadow-sm hover:shadow-primary-glow min-w-0"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="p-1.5 bg-accent-primary/10 rounded-lg text-accent-primary flex-shrink-0">
                              <FileCode size={14} />
                            </div>
                            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                              <span className="text-xs font-semibold text-text-bright truncate font-mono block">{diffTitle}</span>
                              <span className="text-[10px] text-text-muted font-mono block">Patch modification</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            {additions > 0 && (
                              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-accent-success/10 text-accent-success">+{additions}</span>
                            )}
                            {deletions > 0 && (
                              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-accent-danger/10 text-accent-danger">-{deletions}</span>
                            )}
                            <span className="text-[10px] font-semibold uppercase text-accent-primary group-hover/diff:translate-x-0.5 transition-transform ml-1 font-mono whitespace-nowrap">View Diff ➔</span>
                          </div>
                        </div>
                      )}
                      
                      {bashOutput && (
                        <BashOutputCard
                           bashOutput={bashOutput}
                           logTitle={logTitle}
                           setActiveRightTab={setActiveRightTab}
                           setRightSidebarCollapsed={setRightSidebarCollapsed}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        <div className={`text-[10px] text-text-muted mt-1.5 mx-1 font-mono flex items-center gap-1 ${isUser ? 'flex-row-reverse' : ''}`}>
          <span className="capitalize opacity-70">{act.originator} node</span> • <span className="opacity-70">{new Date(act.createTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
      {isUser && (
        <div className="message-avatar flex-shrink-0 ml-3 w-8 h-8 rounded-lg bg-bg-surface flex items-center justify-center text-text-muted border border-border-subtle">
          <Code2 size={14} />
        </div>
      )}
    </div>
  );
});

const PRBanner = ({ prUrl, prTitle, prDesc }: { prUrl: string; prTitle: string; prDesc: string }) => {
  return (
    <div className="my-6 max-w-[85%] mx-auto bg-accent-primary/10 border border-accent-primary/30 rounded-xl p-4 shadow-lg backdrop-blur-md flex flex-col gap-2">
      <div className="flex items-center gap-2 text-accent-primary font-bold text-sm">
        <FileCode size={16} /> Pull Request Created
      </div>
      <a href={prUrl} target="_blank" rel="noopener noreferrer" className="text-text-bright font-semibold hover:underline">
        {prTitle}
      </a>
      {prDesc && <div className="text-sm text-text-muted mt-1">{prDesc}</div>}
    </div>
  );
};


const BashOutputCard = ({ bashOutput, logTitle, setActiveRightTab, setRightSidebarCollapsed }: { bashOutput: any, logTitle?: string, setActiveRightTab: (tab: 'diffs' | 'terminal') => void, setRightSidebarCollapsed: (collapsed: boolean) => void }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex-1 flex flex-col bg-bg-surface border border-border-subtle rounded-xl shadow-sm min-w-0 overflow-hidden">
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between p-3 hover:bg-bg-surface-hover transition-all cursor-pointer group/term"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="p-1 rounded-lg text-text-muted">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
          <div className={`p-1.5 rounded-lg flex-shrink-0 ${bashOutput.exitCode === 0 ? 'bg-accent-success/10 text-accent-success' : 'bg-accent-danger/10 text-accent-danger'}`}>
            <TerminalIcon size={14} />
          </div>
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <span className="text-xs font-semibold text-text-bright truncate font-mono block">{logTitle}</span>
            <span className="text-[10px] text-text-muted font-mono block">Terminal execution</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase font-mono ${bashOutput.exitCode === 0 ? 'bg-accent-success/10 text-accent-success animate-pulse' : 'bg-accent-danger/10 text-accent-danger'}`}>
            {bashOutput.exitCode === 0 ? 'Success' : `Exit ${bashOutput.exitCode}`}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveRightTab('terminal');
              setRightSidebarCollapsed(false);
            }}
            className="text-[10px] font-semibold uppercase text-text-muted hover:text-text-main transition-colors ml-1 font-mono whitespace-nowrap bg-transparent border-none cursor-pointer"
          >
            Open in sidecar ➔
          </button>
        </div>
      </div>

      {expanded && (
        <div className="bg-bg-input border-t border-border-subtle p-3 text-[11px] font-mono overflow-x-auto">
          <div className="text-text-main">
            <span className="text-accent-primary select-none">❯</span> {bashOutput.command}
          </div>
          <div className="text-text-muted mt-2 whitespace-pre-wrap opacity-80">
            {bashOutput.output || <span className="italic opacity-50">No output</span>}
          </div>
        </div>
      )}
    </div>
  );
};

export const ChatView = React.memo(() => {
  const { id: sessionId } = useParams<{ id: string }>();
  const { activities, setActivities, sessions, setSessions, dbConfig } = useAppStore();
  const activeSessionDetails = sessions.find(s => s.id === sessionId);

  useEffect(() => {
    if (!sessionId) {
      setActivities([]);
      return;
    }
    if (dbConfig?.hasKey) {
      julesApi.listActivities(sessionId).then(setActivities).catch(console.error);
    }
  }, [sessionId, dbConfig, setActivities]);

  useEffect(() => {
    if (!dbConfig?.hasKey || !sessionId) return;

    const url = `/api/events?sessionId=${sessionId}`;
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const { type, data } = JSON.parse(event.data);
        if (type === 'sessionUpdate') {
          const { session, activities: newActivities } = data;
          setSessions(prev => {
            const exists = prev.find(s => s.id === session.id);
            if (!exists) return [...prev, session];
            return prev.map(s => s.id === session.id ? session : s);
          });
          if (newActivities && newActivities.length > 0) {
            setActivities((prev: Activity[]) => {
              const existingIds = new Set(prev.map((a: Activity) => a.id));
              const filteredNew = newActivities.filter((a: Activity) => !existingIds.has(a.id));
              if (filteredNew.length === 0) return prev;
              return [...prev, ...filteredNew];
            });
          }
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
  }, [sessionId, dbConfig, setSessions, setActivities]);

  const groupedActivities = useMemo(() => {
    const groups: (Activity | { type: 'progressGroup', id: string, items: Activity[] })[] = [];
    let currentProgressGroup: Activity[] = [];

    activities.forEach(act => {
      if (act.progressUpdated) {
        currentProgressGroup.push(act);
      } else {
        if (currentProgressGroup.length > 0) {
          groups.push({ type: 'progressGroup', id: `pg-${currentProgressGroup[0].id}`, items: currentProgressGroup });
          currentProgressGroup = [];
        }
        groups.push(act);
      }
    });

    if (currentProgressGroup.length > 0) {
      groups.push({ type: 'progressGroup', id: `pg-${currentProgressGroup[0].id}`, items: currentProgressGroup });
    }

    return groups;
  }, [activities]);

  if (!sessionId) return null;

  return (
    <>
      <div className="chat-interface-wrapper" style={{ position: "relative" }}>
        {groupedActivities.map((item, i) => {
          if ('type' in item && item.type === 'progressGroup') {
            return <ProgressGroup key={item.id} activities={item.items} />;
          }
          const act = item as Activity;
          return (
            <ChatMessage
              key={act.id}
              act={act}
              sessionId={sessionId}
              isLastAwaitingApproval={i === activities.length - 1 && activeSessionDetails?.state === 'AWAITING_PLAN_APPROVAL'}
            />
          );
        })}

        {activeSessionDetails?.outputs?.map((output, idx) => {
          if (output.pullRequest) {
            return (
              <PRBanner
                key={`pr-${idx}`}
                prUrl={output.pullRequest.url}
                prTitle={output.pullRequest.title}
                prDesc={output.pullRequest.description}
              />
            );
          }
          return null;
        })}

        <div className="h-10" />
      </div>
      <MessageComposer sessionId={sessionId} />
    </>
  );
});
