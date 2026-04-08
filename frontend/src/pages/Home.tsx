import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { usePipeline } from '../hooks/usePipeline';
import { useReportList } from '../hooks/useResearch';
import { tickerSchema } from '../lib/validation';
import { apiFetch, ApiError } from '../lib/api';
import ScoreBadge from '../components/report/ScoreBadge';
import PipelineProgress from '../components/research/PipelineProgress';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import type { ResearchReport } from '../types/report.types';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function Home() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isApproved, isAdmin } = useAuth();
  const pipeline = usePipeline();
  const { data: reportList, isLoading: listLoading } = useReportList();

  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [pendingTicker, setPendingTicker] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [showMessage, setShowMessage] = useState('');
  const [pipelineActive, setPipelineActive] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const result = tickerSchema.safeParse(input);
    if (!result.success) {
      setInputError(result.error.issues[0]?.message ?? 'Invalid ticker');
      return;
    }
    setInputError('');
    const ticker = result.data;

    setIsChecking(true);
    setShowMessage('');
    try {
      await apiFetch(`/api/v1/research/${ticker}`);
      // Cache hit — navigate directly
      void navigate(`/research/${ticker}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // Cache miss
        if (!user) {
          setShowMessage('Log in to research new tickers.');
        } else if (isApproved) {
          setPendingTicker(ticker);
          setShowConfirm(true);
        } else {
          setShowMessage('Your account is awaiting admin approval.');
        }
      }
    } finally {
      setIsChecking(false);
    }
  };

  const handleConfirmResearch = () => {
    setShowConfirm(false);
    setPipelineActive(true);
    void pipeline.startResearch(pendingTicker).then(() => {
      void queryClient.invalidateQueries({ queryKey: ['research'] });
      void navigate(`/research/${pendingTicker}`);
    });
  };

  if (pipelineActive) {
    return (
      <div className="max-w-lg mx-auto py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 font-mono">
          Researching {pendingTicker}
        </h1>
        <PipelineProgress
          steps={pipeline.steps}
          isRunning={pipeline.isRunning}
          error={pipeline.error}
          isAdmin={isAdmin}
        />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Hero search */}
      <div className="text-center pt-10 sm:pt-16">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
          Find the Moat
        </h1>
        <p className="text-gray-500 mb-8 text-sm sm:text-base">
          AI-powered research on any stock ticker.
        </p>
        <form
          onSubmit={(e) => { void handleSubmit(e); }}
          className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
        >
          <div className="flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value.toUpperCase());
                setInputError('');
                setShowMessage('');
              }}
              placeholder="Enter ticker (e.g. SKYT)"
              maxLength={10}
              aria-label="Stock ticker"
              className={[
                'w-full rounded-md border px-4 py-3 text-lg font-mono tracking-wider',
                'focus:outline-none focus:ring-2 focus:ring-blue-500',
                inputError ? 'border-red-300' : 'border-gray-300',
              ].join(' ')}
            />
            {inputError && (
              <p className="mt-1 text-sm text-red-600 text-left">{inputError}</p>
            )}
          </div>
          <Button
            type="submit"
            size="lg"
            isLoading={isChecking}
            className="whitespace-nowrap"
          >
            Search
          </Button>
        </form>

        {showMessage && (
          <p className="mt-4 text-sm text-gray-600 bg-yellow-50 border border-yellow-200 rounded-md px-4 py-3 max-w-md mx-auto">
            {showMessage}
          </p>
        )}
      </div>

      {/* Ticker grid */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Previously Researched
        </h2>
        {listLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="lg" />
          </div>
        ) : reportList && reportList.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {reportList.map((report: ResearchReport) => (
              <button
                key={report.id}
                onClick={() => { void navigate(`/research/${report.ticker_symbol}`); }}
                className="text-left rounded-lg border border-gray-200 bg-white p-4 hover:shadow-md hover:border-gray-300 transition-all"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-xl font-bold font-mono text-gray-900">
                    {report.ticker_symbol}
                  </span>
                  <ScoreBadge score={report.score} />
                </div>
                {report.tickers?.company_name && (
                  <p className="text-sm text-gray-600 mb-2 truncate">
                    {report.tickers.company_name}
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {report.tickers?.sector && (
                    <Badge variant="blue">{report.tickers.sector}</Badge>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  {formatDate(report.updated_at)}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">
            No research yet. Be the first to research a ticker.
          </p>
        )}
      </div>

      {/* Confirm modal */}
      <Modal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        title={`Research ${pendingTicker}?`}
      >
        <p className="text-sm text-gray-600 mb-6">
          This will run the 7-step AI research pipeline for{' '}
          <strong className="font-mono">{pendingTicker}</strong> and use AI
          credits. This may take a minute.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setShowConfirm(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfirmResearch}>
            Confirm
          </Button>
        </div>
      </Modal>
    </div>
  );
}
