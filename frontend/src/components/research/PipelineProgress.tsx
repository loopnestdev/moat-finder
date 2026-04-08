import { useState, useEffect, useRef } from 'react';
import Spinner from '../ui/Spinner';
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
    steps.filter((s) => s.status === 'complete').map((s) => s.step),
  );

  // Build a map of step number → SSEEvent for completed pipeline steps (1–7)
  const completedStepEvents: Record<number, SSEEvent> = {};
  for (const s of steps) {
    if (s.status === 'complete' && s.step >= 1 && s.step <= 7) {
      completedStepEvents[s.step] = s;
    }
  }

  const errorStep = steps.find((s) => s.status === 'error')?.step ?? null;
  const lastCompleted = completedSteps.size > 0 ? Math.max(...completedSteps) : 0;
  const currentStep = isRunning ? lastCompleted + 1 : null;

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

  // Record when the pipeline starts (= step 1 start time)
  useEffect(() => {
    if (isRunning && !runningRef.current) {
      runningRef.current = true;
      startTimesRef.current[1] = Date.now();
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
      if (event.status === 'complete' && event.step >= 1 && event.step <= 7) {
        updates[event.step] = now;
        // The next step starts immediately after this one completes
        if (event.step < 7) {
          startTimesRef.current[event.step + 1] = now;
        }
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
    <ol className="space-y-3">
      {Array.from({ length: 7 }, (_, i) => {
        const stepNum = i + 1;
        const label = STEP_LABELS[stepNum] ?? `Step ${stepNum}`;
        const isComplete = completedSteps.has(stepNum);
        const isInProgress = currentStep === stepNum;
        const isError = errorStep === stepNum;
        const isPending = !isComplete && !isInProgress && !isError;
        const isSelected = selectedStep === stepNum;
        const isClickable = isAdmin && isComplete;

        const duration =
          isAdmin &&
          isComplete &&
          endTimes[stepNum] !== undefined &&
          startTimesRef.current[stepNum] !== undefined
            ? endTimes[stepNum] - startTimesRef.current[stepNum]
            : null;

        return (
          <li
            key={stepNum}
            className={[
              'flex items-center gap-3 rounded-md px-2 py-1 -mx-2 transition-colors',
              isClickable ? 'cursor-pointer hover:bg-gray-50' : '',
              isSelected ? 'bg-blue-50 hover:bg-blue-50' : '',
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
              {isComplete && (
                <svg
                  className="h-5 w-5 text-emerald-500"
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
              {isInProgress && <Spinner size="sm" />}
              {isError && (
                <svg
                  className="h-5 w-5 text-red-500"
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
                <span className="h-4 w-4 rounded-full border-2 border-gray-300" />
              )}
            </span>

            {/* Label */}
            <span
              className={[
                'text-sm flex-1',
                isComplete ? 'text-gray-900 font-medium' : '',
                isInProgress ? 'text-blue-700 font-medium' : '',
                isError ? 'text-red-700 font-medium' : '',
                isPending ? 'text-gray-400' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {label}
            </span>

            {/* Duration pill (admin only) */}
            {duration !== null && (
              <span className="text-xs text-gray-400 font-mono tabular-nums">
                {formatDuration(duration)}
              </span>
            )}

            {/* Expand chevron (admin + complete only) */}
            {isAdmin && isComplete && (
              <svg
                className={[
                  'h-4 w-4 flex-shrink-0 transition-transform duration-200',
                  isSelected ? 'text-blue-500 rotate-90' : 'text-gray-300',
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
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <h4 className="text-sm font-semibold text-blue-900">
            Step {selectedStep}:{' '}
            {STEP_LABELS[selectedStep] ?? `Step ${selectedStep}`}
          </h4>
          <div className="flex items-center gap-2 flex-shrink-0">
            {endTimes[selectedStep] !== undefined &&
              startTimesRef.current[selectedStep] !== undefined && (
                <span className="text-xs font-mono tabular-nums bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                  {formatDuration(
                    endTimes[selectedStep] -
                      startTimesRef.current[selectedStep],
                  )}
                </span>
              )}
            <button
              className="text-blue-400 hover:text-blue-600 transition-colors"
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
        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">
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
                <pre className="text-xs text-gray-700 bg-white rounded-md border border-blue-200 p-3 overflow-x-auto whitespace-pre-wrap break-all">
                  {preview}
                </pre>
                {isLong && (
                  <button
                    className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-800 underline underline-offset-2 transition-colors"
                    onClick={() => toggleExpand(selectedStep)}
                  >
                    {isExpanded ? 'Show less' : 'Show full output'}
                  </button>
                )}
              </>
            );
          })()
        ) : (
          <p className="text-xs text-gray-400 italic">
            No output data transmitted for this step.
          </p>
        )}
      </div>
    ) : null;

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
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
                <p className="text-xs text-gray-400 italic hidden md:block">
                  Click a completed step to inspect its output.
                </p>
              )
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
