interface ScoreBadgeProps {
  score: number | null;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-3 py-1',
  lg: 'text-base px-4 py-1.5',
};

export default function ScoreBadge({ score, size = 'md' }: ScoreBadgeProps) {
  if (score === null) {
    return (
      <span
        className={[
          'inline-flex items-center rounded-full font-semibold bg-gray-200 text-gray-600',
          sizeClasses[size],
        ].join(' ')}
      >
        N/A
      </span>
    );
  }

  const colourClass =
    score >= 8
      ? 'bg-score-high text-white'
      : score >= 5
        ? 'bg-score-mid text-gray-900'
        : 'bg-score-low text-white';

  return (
    <span
      className={[
        'inline-flex items-center rounded-full font-semibold',
        colourClass,
        sizeClasses[size],
      ].join(' ')}
      aria-label={`Score: ${score.toFixed(1)}`}
    >
      {score.toFixed(1)}
    </span>
  );
}
