import { useState } from 'react';
import { CheckCircle, ChevronDown, ChevronRight, Play } from 'lucide-react';
import type { Activity, PlanStep } from '../julesApi';

const StepRow = ({ step }: { step: PlanStep }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-border-subtle rounded-lg overflow-hidden mb-2 bg-bg-surface">
      <div
        className="flex items-center gap-3 p-2.5 cursor-pointer hover:bg-bg-surface-hover transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center bg-bg-surface-hover rounded text-[10px] font-bold text-accent-primary border border-accent-primary/20">
          {(step.index ?? 0) + 1}
        </span>
        <span className="flex-1 text-xs font-semibold text-text-main truncate">{step.title}</span>
        {isOpen ? <ChevronDown size={14} className="text-text-muted" /> : <ChevronRight size={14} className="text-text-muted" />}
      </div>
      {isOpen && (
        <div className="p-2.5 pt-0 text-[11px] text-text-muted leading-relaxed border-t border-border-subtle bg-bg-input/20">
          {step.description}
        </div>
      )}
    </div>
  );
};

export function PlanAccordionCard({
  planActivity,
  isActiveSessionAwaitingApproval,
  onApprove
}: {
  planActivity: Activity;
  isActiveSessionAwaitingApproval: boolean;
  onApprove: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true); // default open

  if (!planActivity.planGenerated) return null;
  const plan = planActivity.planGenerated.plan;

  return (
    <div className="mt-3">
      <div
        className="flex items-center justify-between cursor-pointer select-none bg-bg-input/40 p-3 rounded-xl border border-border-subtle hover:bg-bg-surface-hover transition-all shadow-sm"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-accent-primary/10 rounded-lg text-accent-primary">
            <CheckCircle size={14} />
          </div>
          <span className="font-semibold text-sm text-text-main">Proposed Plan ({plan.steps.length} steps)</span>
        </div>
        <div>
          {isExpanded ? (
            <ChevronDown size={14} className="text-text-muted" />
          ) : (
            <ChevronRight size={14} className="text-text-muted" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 animate-slide-in">
          <div className="flex flex-col">
            {plan.steps.map((step) => (
              <StepRow key={step.id} step={step} />
            ))}
          </div>

          {isActiveSessionAwaitingApproval && (
            <div className="mt-2 pt-3 border-t border-border-subtle flex justify-end">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onApprove();
                }}
                className="py-2 px-4 bg-accent-warning hover:bg-accent-warning/80 text-bg-app font-bold text-xs rounded-xl transition shadow-warning-glow flex items-center justify-center gap-1.5 cursor-pointer border-none"
              >
                <Play size={12} fill="currentColor" /> Approve proposed plan
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


