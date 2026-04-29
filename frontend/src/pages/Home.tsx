import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import { usePipeline } from "../hooks/usePipeline";
import { useReportList } from "../hooks/useResearch";
import { tickerSchema } from "../lib/validation";
import { apiFetch, ApiError } from "../lib/api";
import ScoreBadge from "../components/report/ScoreBadge";
import PipelineProgress from "../components/research/PipelineProgress";
import Modal from "../components/ui/Modal";
import Button from "../components/ui/Button";
import Spinner from "../components/ui/Spinner";
import type { ResearchListItem } from "../types/report.types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatUpside(pct: number): string {
  return (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%";
}

function formatTargetPrice(price: number): string {
  return (
    "$" +
    price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export default function Home() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isApproved, isAdmin } = useAuth();
  const pipeline = usePipeline();
  const { data: reportList, isLoading: listLoading } = useReportList();

  const [input, setInput] = useState("");
  const [inputError, setInputError] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [pendingTicker, setPendingTicker] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [showMessage, setShowMessage] = useState("");
  const [pipelineActive, setPipelineActive] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<"claude" | "gemini">(
    "claude",
  );

  // Filter & sort state
  const [minScore, setMinScore] = useState<number | null>(null);
  const [minUpside, setMinUpside] = useState<number | null>(null);
  const [sectorFilter, setSectorFilter] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "score" | "upside">("date");

  const isFiltered =
    minScore !== null ||
    minUpside !== null ||
    sectorFilter !== "" ||
    sortBy !== "date";

  const filtered: ResearchListItem[] = (reportList ?? [])
    .filter((r) => minScore === null || (r.score ?? 0) >= minScore)
    .filter(
      (r) => minUpside === null || (r.upside_percent ?? -999) >= minUpside,
    )
    .filter(
      (r) =>
        !sectorFilter ||
        r.hot_sector_match.some((s) =>
          s.toLowerCase().includes(sectorFilter.toLowerCase()),
        ),
    )
    .sort((a, b) => {
      if (sortBy === "score") return (b.score ?? 0) - (a.score ?? 0);
      if (sortBy === "upside")
        return (b.upside_percent ?? -999) - (a.upside_percent ?? -999);
      return (
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const result = tickerSchema.safeParse(input);
    if (!result.success) {
      setInputError(result.error.issues[0]?.message ?? "Invalid ticker");
      return;
    }
    setInputError("");
    const ticker = result.data;

    setIsChecking(true);
    setShowMessage("");
    try {
      await apiFetch(`/api/v1/research/${ticker}`);
      void navigate(`/research/${ticker}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        if (!user) {
          setShowMessage("Log in to research new tickers.");
        } else if (isApproved) {
          setPendingTicker(ticker);
          setShowConfirm(true);
        } else {
          setShowMessage("Your account is awaiting admin approval.");
        }
      }
    } finally {
      setIsChecking(false);
    }
  };

  const handleConfirmResearch = () => {
    setShowConfirm(false);
    setPipelineActive(true);
    void pipeline.startResearch(pendingTicker, selectedProvider).then(() => {
      void queryClient.invalidateQueries({ queryKey: ["research"] });
      void navigate(`/research/${pendingTicker}`);
    });
  };

  if (pipelineActive) {
    return (
      <div className="max-w-lg mx-auto py-8">
        <h1 className="text-2xl font-bold text-cream mb-1 font-mono">
          Researching <span className="text-gold">{pendingTicker}</span>
        </h1>
        <p className="text-cream-subtle text-sm mb-6 font-body">
          Running 7-step AI research pipeline…
        </p>
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
      {/* Hero */}
      <div className="rounded-xl bg-gradient-to-br from-navy-800 via-[#1f2170] to-navy-950 border border-navy-700 shadow-[rgba(50,50,93,0.25)_0px_30px_45px_-30px,rgba(0,0,0,0.1)_0px_18px_36px_-18px] px-6 py-12 sm:px-12 sm:py-16 text-center">
        <p className="text-purple-light font-mono text-xs tracking-[0.3em] uppercase mb-4">
          AI-Powered Investment Research
        </p>
        <h1 className="font-display text-4xl sm:text-5xl font-light text-cream mb-4 leading-tight tracking-tight">
          Find the Moat
        </h1>
        <p className="text-cream-muted font-body text-base sm:text-lg mb-10 max-w-md mx-auto leading-relaxed">
          Deep-dive research on any stock — competitive moats, valuation, macro,
          and sentiment in one report.
        </p>

        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
        >
          <div className="flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value.toUpperCase());
                setInputError("");
                setShowMessage("");
              }}
              placeholder="Enter ticker (e.g. SKYT)"
              maxLength={10}
              aria-label="Stock ticker"
              className={[
                "w-full rounded border px-4 py-3 text-lg font-mono tracking-wider",
                "bg-navy-800 text-cream placeholder:text-cream-subtle",
                "focus:outline-none focus:ring-2 focus:ring-purple focus:border-purple",
                inputError ? "border-red-500" : "border-navy-700",
              ].join(" ")}
            />
            {inputError && (
              <p className="mt-1 text-sm text-red-400 text-left">
                {inputError}
              </p>
            )}
          </div>
          <Button
            type="submit"
            size="lg"
            isLoading={isChecking}
            className="whitespace-nowrap"
          >
            Research
          </Button>
        </form>

        {showMessage && (
          <p className="mt-4 text-sm text-cream-muted bg-navy-750 border border-navy-700 rounded px-4 py-3 max-w-md mx-auto">
            {showMessage}
          </p>
        )}
      </div>

      {/* Ticker grid */}
      <div>
        <h2 className="font-display text-xl font-light text-cream mb-4">
          Previously Researched
        </h2>

        {/* Filter & sort bar */}
        {!listLoading && reportList && reportList.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-3 items-end">
            {/* Score ≥ */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-cream-subtle font-mono uppercase tracking-wider">
                Score ≥
              </label>
              <input
                type="number"
                placeholder="8.0"
                step={0.5}
                min={0}
                max={10}
                value={minScore ?? ""}
                onChange={(e) =>
                  setMinScore(
                    e.target.value !== "" ? parseFloat(e.target.value) : null,
                  )
                }
                className="w-20 rounded border border-navy-700 bg-navy-800 text-cream font-mono text-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple focus:border-purple"
              />
            </div>

            {/* Upside ≥ */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-cream-subtle font-mono uppercase tracking-wider">
                Upside ≥
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  placeholder="50"
                  value={minUpside ?? ""}
                  onChange={(e) =>
                    setMinUpside(
                      e.target.value !== "" ? parseFloat(e.target.value) : null,
                    )
                  }
                  className="w-20 rounded border border-navy-700 bg-navy-800 text-cream font-mono text-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple focus:border-purple"
                />
                <span className="text-xs text-cream-subtle font-mono">%</span>
              </div>
            </div>

            {/* Sector */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-cream-subtle font-mono uppercase tracking-wider">
                Sector
              </label>
              <input
                type="text"
                placeholder="AI, Energy…"
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
                className="w-28 rounded border border-navy-700 bg-navy-800 text-cream font-body text-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple focus:border-purple"
              />
            </div>

            {/* Sort */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-cream-subtle font-mono uppercase tracking-wider">
                Sort
              </label>
              <select
                value={sortBy}
                onChange={(e) =>
                  setSortBy(e.target.value as "date" | "score" | "upside")
                }
                className="rounded border border-navy-700 bg-navy-800 text-cream font-body text-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple focus:border-purple"
              >
                <option value="date">Newest</option>
                <option value="score">Score ↓</option>
                <option value="upside">Upside ↓</option>
              </select>
            </div>

            {/* Clear */}
            {isFiltered && (
              <button
                onClick={() => {
                  setMinScore(null);
                  setMinUpside(null);
                  setSectorFilter("");
                  setSortBy("date");
                }}
                className="rounded border border-navy-700 text-cream-subtle font-mono text-xs px-3 py-1.5 hover:border-purple/50 hover:text-cream transition-all self-end"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}

        {/* Count */}
        {!listLoading && reportList && reportList.length > 0 && (
          <p className="text-xs text-cream-subtle font-mono mb-4">
            Showing {filtered.length} of {reportList.length} stock
            {reportList.length !== 1 ? "s" : ""}
          </p>
        )}

        {listLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="lg" />
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((report) => (
              <button
                key={report.ticker_symbol}
                onClick={() => {
                  void navigate(`/research/${report.ticker_symbol}`);
                }}
                className="text-left rounded border border-navy-700 bg-navy-800 p-5 hover:border-purple/50 hover:bg-navy-750 transition-all group"
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-2xl font-bold font-mono text-gold group-hover:text-gold-light transition-colors">
                    {report.ticker_symbol}
                  </span>
                  <ScoreBadge score={report.score} />
                </div>

                {/* Company name */}
                {report.company_name && (
                  <p className="text-sm text-cream-muted mb-2 truncate font-body">
                    {report.company_name}
                  </p>
                )}

                {/* Napkin math row */}
                {(report.target_price !== null ||
                  report.upside_percent !== null) && (
                  <div className="flex items-center gap-3 mb-3">
                    {report.target_price !== null && (
                      <span className="font-mono text-sm text-gold">
                        {formatTargetPrice(report.target_price)}
                      </span>
                    )}
                    {report.upside_percent !== null && (
                      <span
                        className={`font-mono text-sm ${
                          report.upside_percent >= 0
                            ? "text-emerald-400"
                            : "text-red-400"
                        }`}
                      >
                        {formatUpside(report.upside_percent)}
                      </span>
                    )}
                  </div>
                )}

                {/* Sector pills */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {report.sector && (
                    <span className="text-xs border border-purple-light/30 text-purple-light px-2 py-0.5 rounded font-mono">
                      {report.sector}
                    </span>
                  )}
                  {report.hot_sector_match.length > 0 && (
                    <span className="text-xs border border-navy-700 text-cream-subtle px-2 py-0.5 rounded font-mono bg-navy-950">
                      {report.hot_sector_match[0]}
                    </span>
                  )}
                </div>

                {/* Date */}
                <p className="text-xs text-cream-subtle font-mono">
                  {formatDate(report.updated_at)}
                </p>
              </button>
            ))}
          </div>
        ) : reportList && reportList.length > 0 ? (
          <p className="text-cream-subtle text-sm font-body">
            No stocks match the current filters.
          </p>
        ) : (
          <p className="text-cream-subtle text-sm font-body">
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
        <p className="text-sm text-cream-muted mb-4 font-body leading-relaxed">
          This will run the 7-step AI research pipeline for{" "}
          <strong className="font-mono text-gold">{pendingTicker}</strong> and
          use AI credits. This may take a minute.
        </p>
        <div className="mb-6">
          <label className="block font-body text-xs text-cream-subtle uppercase tracking-widest mb-2">
            Research Engine
          </label>
          <select
            value={selectedProvider}
            onChange={(e) =>
              setSelectedProvider(e.target.value as "claude" | "gemini")
            }
            className="w-full rounded border border-navy-700 bg-navy-800 text-cream font-body text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple focus:border-purple"
          >
            <option value="claude">Claude (Anthropic)</option>
            <option value="gemini">Gemini (Google)</option>
          </select>
        </div>
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
