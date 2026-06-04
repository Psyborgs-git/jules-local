import React, { useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Code2, CheckSquare, FileCode, Terminal as TerminalIcon } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { julesApi, type Activity } from '../../julesApi';
import { CollapsibleMessage } from './CollapsibleMessage';
import { PlanAccordionCard } from '../PlanAccordionCard';
import { ActivityFiles } from '../ActivityFiles';
import { MessageComposer } from './MessageComposer';

const ProgressGroup = React.memo(({ activities }: { activities: Activity[] }) => {
  if (!activities || activities.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 border-l-2 border-accent-success pl-3 py-1 my-2 bg-accent-success/5 rounded-r-lg">
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
        <div className={`p-4 rounded-2xl shadow-lg backdrop-blur-md border ${isUser
          ? 'bg-bg-surface text-text-bright rounded-tr-sm border-border-subtle'
          : isSystem
            ? 'bg-bg-input/60 text-text-main rounded-tl-sm border-border-subtle'
            : 'bg-bg-input text-text-main rounded-tl-sm border-accent-primary/20'
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

          {act.description && act.description.includes('Created artifact') && (
            <ActivityFiles artifacts={act.artifacts || []} />
          )}

          {(act.artifacts || []).length > 0 && (
            <div className="mt-3 flex items-center gap-2 flex-wrap border-t border-border-subtle pt-3">
              {(act.artifacts || []).map((art, aIdx) => {
                const patch = art.changeSet?.gitPatch?.unidiffPatch;
                const bashOutput = art.bashOutput;
                if (!patch && !bashOutput) return null;

                const diffTitle = art.changeSet?.gitPatch.suggestedCommitMessage || art.changeSet?.source;
                const logTitle = bashOutput?.command;

                if (patch && !diffTitle) return null;
                if (bashOutput && !logTitle) return null;

                return (
                  <div key={aIdx} className="flex items-center gap-2">
                    {patch && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveRightTab('diffs');
                          setRightSidebarCollapsed(false);
                        }}
                        className="flex items-center gap-1.5 py-1.5 px-3 bg-accent-primary/10 hover:bg-accent-primary/20 text-accent-primary font-semibold text-xs border border-accent-primary/20 rounded-xl transition cursor-pointer font-mono shadow-primary-glow"
                      >
                        <FileCode size={12} />
                        <span className="truncate max-w-[120px]">{diffTitle}</span>
                      </button>
                    )}
                    {bashOutput && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveRightTab('terminal');
                          setRightSidebarCollapsed(false);
                        }}
                        className="flex items-center gap-1.5 py-1.5 px-3 bg-bg-surface hover:bg-bg-surface-hover text-text-main font-semibold text-xs border border-border-subtle rounded-xl transition cursor-pointer font-mono"
                      >
                        <TerminalIcon size={12} />
                        <span className="truncate max-w-[120px]">{logTitle}</span>
                      </button>
                    )}
                  </div>
                );
              })}
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
            setActivities(prev => {
              const existingIds = new Set(prev.map(a => a.id));
              const filteredNew = newActivities.filter(a => !existingIds.has(a.id));
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
        <div className="h-10" />
      </div>
      <MessageComposer sessionId={sessionId} />
    </>
  );
});
