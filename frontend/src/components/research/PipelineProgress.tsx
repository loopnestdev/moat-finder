import Spinner from '../ui/Spinner';
import type { SSEEvent } from '../../types/report.types';

interface PipelineProgressProps {
  steps: SSEEvent[];
  isRunning: boolean;
  error: string | null;
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

export default function PipelineProgress({
  steps,
  isRunning,
  error,
}: PipelineProgressProps) {
  const completedSteps = new Set(
    steps.filter((s) => s.status === 'complete').map((s) => s.step),
  );
  const errorStep = steps.find((s) => s.status === 'error')?.step ?? null;
  const lastCompleted = completedSteps.size > 0 ? Math.max(...completedSteps) : 0;
  const currentStep = isRunning ? lastCompleted + 1 : null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        Research in Progress
      </h3>
      <ol className="space-y-3">
        {Array.from({ length: 7 }, (_, i) => {
          const stepNum = i + 1;
          const label = STEP_LABELS[stepNum] ?? `Step ${stepNum}`;
          const isComplete = completedSteps.has(stepNum);
          const isInProgress = currentStep === stepNum;
          const isError = errorStep === stepNum;
          const isPending = !isComplete && !isInProgress && !isError;

          return (
            <li key={stepNum} className="flex items-center gap-3">
              {/* Icon */}
              <span className="flex-shrink-0 h-6 w-6 flex items-center justify-center">
                {isComplete && (
                  <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {isInProgress && <Spinner size="sm" />}
                {isError && (
                  <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                {isPending && (
                  <span className="h-4 w-4 rounded-full border-2 border-gray-300" />
                )}
              </span>
              {/* Label */}
              <span
                className={[
                  'text-sm',
                  isComplete ? 'text-gray-900 font-medium' : '',
                  isInProgress ? 'text-blue-700 font-medium' : '',
                  isError ? 'text-red-700 font-medium' : '',
                  isPending ? 'text-gray-400' : '',
                ].join(' ')}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
