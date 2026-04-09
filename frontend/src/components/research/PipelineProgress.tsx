import { useState, useEffect, useRef } from 'react';
import type { SSEEvent } from '../../types/report.types';

interface PipelineProgressProps {
  steps: SSEEvent[];
  isRunning: boolean;
  error: string | null;
  isAdmin?: boolean;
}

const STEP_LABELS: Record<number, string> = {
  1: 'Discovery',
  2: 'Deep Dive',
  3: 'Valuation & Financials',
  4: 'Risk Red Team',
  5: 'Macro & Sector',
  6: 'Sentiment & Technicals',
  7: 'Synthesising Report',
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function PipelineProgress({
  steps,
  isRunning,
  error,
  isAdmin = false,
}: PipelineProgressProps) {
  const completedSteps = new Set(
    steps.filter((s) => s.status === 'complete' || s.status === 'cached').map((s) => s.step),
  );

  // Build a map of step number → SSEEvent for completed/cached pipeline steps (1–7)
  const completedStepEvents: Record<number, SSEEvent> = {};
  for (const s of steps) {
    if ((s.status === 'complete' || s.status === 'cached') && s.step >= 1 && s.step <= 7) {
      completedStepEvents[s.step] = s;
    }
  }

  const errorStep = steps.find((s) => s.status === 'error')?.step ?? null;

  // Steps that have sent 'started' but not yet 'complete'/'cached'/'error' — may be many at once.
  const startedStepNums = new Set(
    steps
      .filter((s) => s.status === 'started' && s.step >= 1 && s.step <= 7)
      .map((s) => s.step),
  );
  const runningSteps = new Set(
    [...startedStepNums].filter((n) => !completedSteps.has(n) && errorStep !== n),
  );

  // Admin-only: which step's detail panel is open
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  // Admin-only: which steps have "show full output" expanded
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  // Timing: start times tracked in a ref (no re-render needed on write),
  // end times tracked in state so the UI updates when a step completes.
  const startTimesRef = useRef<Record<number, number>>({});
  const [endTimes, setEndTimes] = useState<Record<number, number>>({});
  const runningRef = useRef(false);
  const prevLengthRef = useRef(0);

  useEffect(() => {
    if (isRunning && !runningRef.current) {
      runningRef.current = true;
    }
    if (!isRunning) {
      runningRef.current = false;
    }
  }, [isRunning]);

  // Record step completion times and derive next step start times
  useEffect(() => {
    // Detect pipeline reset (steps array cleared for a new run)
    if (steps.length < prevLengthRef.current) {
      prevLengthRef.current = 0;
      startTimesRef.current = {};
      setEndTimes({});
      setSelectedStep(null);
      setExpandedSteps(new Set());
    }

    if (steps.length <= prevLengthRef.current) return;

    const newSteps = steps.slice(prevLengthRef.current);
    prevLengthRef.current = steps.length;

    const now = Date.now();
    const updates: Record<number, number> = {};

    for (const event of newSteps) {
      if (event.status === 'started' && event.step >= 1 && event.step <= 7) {
        // Record start time when each step signals it has begun
        if (startTimesRef.current[event.step] === undefined) {
          startTimesRef.current[event.step] = now;
        }
      }
      if ((event.status === 'complete' || event.status === 'cached') && event.step >= 1 && event.step <= 7) {
        updates[event.step] = now;
      }
    }

    if (Object.keys(updates).length > 0) {
      setEndTimes((prev) => ({ ...prev, ...updates }));
    }
  }, [steps]);

  const handleStepClick = (stepNum: number) => {
    if (!isAdmin || !completedSteps.has(stepNum)) return;
    setSelectedStep((prev) => (prev === stepNum ? null : stepNum));
  };

  const toggleExpand = (stepNum: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepNum)) {
        next.delete(stepNum);
      } else {
        next.add(stepNum);
      }
      return next;
    });
  };

  // ─── Steps list ──────────────────────────────────────────────────────────────

  const stepsList = (
    <ol className="space-y-2">
      {Array.from({ length: 7 }, (_, i) => {
        const stepNum = i + 1;
        const label = STEP_LABELS[stepNum] ?? `Step ${stepNum}`;
        const isComplete = completedSteps.has(stepNum);
        const isCached = isComplete && completedStepEvents[stepNum]?.status === 'cached';
        const isInProgress = runningSteps.has(stepNum);
        const isError = errorStep === stepNum;
        const isPending = !isComplete && !isInProgress && !isError;
        const isSelected = selectedStep === stepNum;
        const isClickable = isAdmin && isComplete;

        // Prefer server-emitted duration (accurate for parallel steps).
        // Fall back to client-side timing only for step 1 and step 7 where it's reliable.
        const serverDuration = completedStepEvents[stepNum]?.duration;
        const clientDuration =
          endTimes[stepNum] !== undefined && startTimesRef.current[stepNum] !== undefined
            ? endTimes[stepNum] - startTimesRef.current[stepNum]
            : null;
        const duration = isAdmin && isComplete ? (serverDuration ?? clientDuration) : null;

        return (
          <li
            key={stepNum}
            className={[
              'flex items-center gap-3 rounded-md px-2 py-1.5 -mx-2 transition-colors',
              isClickable ? 'cursor-pointer hover:bg-navy-800' : '',
              isSelected ? 'bg-navy-800' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => handleStepClick(stepNum)}
            role={isClickable ? 'button' : undefined}
            tabIndex={isClickable ? 0 : undefined}
            aria-expanded={isClickable ? isSelected : undefined}
            aria-label={
              isClickable
                ? `${isSelected ? 'Collapse' : 'Expand'} details for step ${stepNum}: ${label}`
                : undefined
            }
            onKeyDown={(e) => {
              if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                handleStepClick(stepNum);
              }
            }}
          >
            {/* Status icon */}
            <span className="flex-shrink-0 h-6 w-6 flex items-center justify-center">
              {isComplete && !isCached && (
                <svg
                  className="h-5 w-5 text-emerald-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
              {isCached && (
                <svg
                  className="h-4 w-4 text-gold/60"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-label="Cached"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              )}
              {isInProgress && (
                <svg
                  className="h-4 w-4 text-amber-400 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-label="In progress"
                  role="status"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
              )}
              {isError && (
                <svg
                  className="h-5 w-5 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
              {isPending && (
                <span className="h-4 w-4 rounded-full border-2 border-cream/25" />
              )}
            </span>

            {/* Label */}
            <span
              className={[
                'font-body text-sm flex-1',
                isComplete ? 'text-cream' : '',
                isInProgress ? 'text-amber-400 font-medium' : '',
                isError ? 'text-red-400 font-medium' : '',
                isPending ? 'text-cream/40' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {label}
            </span>

            {/* Duration pill (admin only) */}
            {duration !== null && (
              <span className="font-mono text-sm text-gold/60 tabular-nums">
                {formatDuration(duration)}
              </span>
            )}

            {/* Expand chevron (admin + complete only) */}
            {isAdmin && isComplete && (
              <svg
                className={[
                  'h-4 w-4 flex-shrink-0 transition-transform duration-200',
                  isSelected ? 'text-gold rotate-90' : 'text-gold/40',
                ].join(' ')}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            )}
          </li>
        );
      })}
    </ol>
  );

  // ─── Detail panel (admin only) ───────────────────────────────────────────────

  const selectedEvent =
    selectedStep !== null ? completedStepEvents[selectedStep] : null;

  const detailPanel =
    isAdmin && selectedStep !== null && selectedEvent ? (
      <div className="rounded-lg border-l-2 border-gold/40 bg-navy-900 p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <h4 className="font-body text-sm font-semibold text-cream">
            Step {selectedStep}:{' '}
            {STEP_LABELS[selectedStep] ?? `Step ${selectedStep}`}
          </h4>
          <div className="flex items-center gap-2 flex-shrink-0">
            {(() => {
              const sd = selectedEvent?.duration;
              const cd =
                endTimes[selectedStep] !== undefined &&
                startTimesRef.current[selectedStep] !== undefined
                  ? endTimes[selectedStep] - startTimesRef.current[selectedStep]
                  : null;
              const ms = sd ?? cd;
              return ms !== null && ms !== undefined ? (
                <span className="font-mono text-xs tabular-nums bg-navy-800 text-gold/70 px-2 py-0.5 rounded-full">
                  {formatDuration(ms)}
                </span>
              ) : null;
            })()}
            <button
              className="text-gold/40 hover:text-gold transition-colors"
              onClick={() => setSelectedStep(null)}
              aria-label="Close detail panel"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Output */}
        <p className="font-mono text-xs text-gold/60 uppercase tracking-wide mb-2">
          Output summary
        </p>
        {selectedEvent.data !== undefined ? (
          (() => {
            const full = JSON.stringify(selectedEvent.data, null, 2);
            const isLong = full.length > 300;
            const isExpanded = expandedSteps.has(selectedStep);
            const preview = isLong && !isExpanded ? full.slice(0, 300) + '…' : full;
            return (
              <>
                <pre className="font-mono text-xs text-cream-muted bg-navy-800 rounded-md border border-gold/20 p-3 overflow-x-auto whitespace-pre-wrap break-all">
                  {preview}
                </pre>
                {isLong && (
                  <button
                    className="mt-2 font-mono text-xs text-gold hover:text-gold/70 underline underline-offset-2 transition-colors"
                    onClick={() => toggleExpand(selectedStep)}
                  >
                    {isExpanded ? 'Show less' : 'Show full output'}
                  </button>
                )}
              </>
            );
          })()
        ) : (
          <p className="font-body text-xs text-cream-subtle italic">
            No output data transmitted for this step.
          </p>
        )}
      </div>
    ) : null;

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="rounded-lg border border-gold/20 bg-navy-950 p-6">
      <h3 className="font-body text-lg text-cream mb-4">
        Research in Progress
      </h3>

      {/* On desktop (md+) with admin: steps left, detail panel right */}
      <div className={isAdmin ? 'md:flex md:gap-6 md:items-start' : ''}>
        <div className={isAdmin ? 'md:w-56 flex-shrink-0' : ''}>{stepsList}</div>

        {isAdmin && (
          <div className="flex-1 min-w-0 mt-4 md:mt-0">
            {detailPanel ?? (
              // Placeholder hint when no step is selected
              completedSteps.size > 0 && (
                <p className="font-body text-xs text-cream-muted italic hidden md:block">
                  Click a completed step to inspect its output.
                </p>
              )
            )}
          </div>
        )}
      </div>

      {/* Saving indicator — shown while Step 8 'saving' event is active */}
      {steps.some((s) => s.step === 8 && s.status === 'saving') &&
        !steps.some((s) => s.step === 8 && s.status === 'complete') && (
          <div className="mt-4 flex items-center gap-2 font-body text-sm text-gold/80">
            <svg
              className="h-4 w-4 animate-spin text-gold"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Saving report…
          </div>
        )}

      {error && (
        <div className="mt-4 rounded-md bg-red-950/30 border border-red-500/30 px-4 py-3 font-body text-sm text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
