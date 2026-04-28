import Modal from "../ui/Modal";
import Button from "../ui/Button";
import type { DiffJson } from "../../types/report.types";

interface DiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  diff: DiffJson | null;
  isLoading: boolean;
}

export default function DiffModal({
  isOpen,
  onClose,
  onConfirm,
  diff,
  isLoading,
}: DiffModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Research Update Summary">
      {diff ? (
        <div className="space-y-4 text-sm">
          {/* Score change */}
          {diff.score && (
            <div className="flex items-center gap-2">
              <span className="text-cream-subtle">Score:</span>
              <span className="font-mono font-medium text-cream">
                {diff.score.from?.toFixed(1) ?? "N/A"}
              </span>
              <span className="text-cream-subtle">→</span>
              <span
                className={[
                  "font-mono font-medium",
                  diff.score.to !== null &&
                  diff.score.from !== null &&
                  diff.score.to > diff.score.from
                    ? "text-emerald-400"
                    : "text-red-400",
                ].join(" ")}
              >
                {diff.score.to?.toFixed(1) ?? "N/A"}
              </span>
              {diff.score.to !== null && diff.score.from !== null && (
                <span className="text-cream-subtle">
                  {diff.score.to > diff.score.from ? "↑" : "↓"}
                </span>
              )}
            </div>
          )}

          {/* Changed fields */}
          {diff.changed_fields.length > 0 && (
            <div>
              <p className="font-medium text-cream-muted mb-1">
                Updated sections:
              </p>
              <ul className="list-disc list-inside text-cream-subtle space-y-0.5">
                {diff.changed_fields.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Added catalysts */}
          {diff.added_catalysts.length > 0 && (
            <div>
              <p className="font-medium text-emerald-400 mb-1">
                Added catalysts:
              </p>
              <ul className="list-disc list-inside text-cream-subtle space-y-0.5">
                {diff.added_catalysts.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Removed catalysts */}
          {diff.removed_catalysts.length > 0 && (
            <div>
              <p className="font-medium text-red-400 mb-1">
                Removed catalysts:
              </p>
              <ul className="list-disc list-inside text-cream-subtle space-y-0.5">
                {diff.removed_catalysts.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Summary */}
          <p className="text-cream-subtle italic">{diff.summary}</p>
        </div>
      ) : (
        <p className="text-sm text-cream-subtle">No changes detected.</p>
      )}

      <div className="flex gap-3 mt-6 justify-end">
        <Button variant="secondary" onClick={onClose} disabled={isLoading}>
          Discard
        </Button>
        <Button variant="primary" onClick={onConfirm} isLoading={isLoading}>
          Confirm &amp; Save
        </Button>
      </div>
    </Modal>
  );
}
