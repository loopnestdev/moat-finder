interface ScoreBadgeProps {
  score: number | null;
  size?: "sm" | "md" | "lg";
}

const sizeConfig = {
  sm: { px: 44, r: 17, sw: 4, textSize: "text-sm", subSize: "text-[9px]" },
  md: { px: 56, r: 22, sw: 5, textSize: "text-base", subSize: "text-[10px]" },
  lg: { px: 80, r: 32, sw: 6, textSize: "text-xl", subSize: "text-xs" },
};

const MONO = '"JetBrains Mono", monospace';

export default function ScoreBadge({ score, size = "md" }: ScoreBadgeProps) {
  const cfg = sizeConfig[size];
  const cx = cfg.px / 2;
  const cy = cfg.px / 2;
  const r = cfg.r;
  const circumference = 2 * Math.PI * r;

  if (score === null) {
    return (
      <svg
        width={cfg.px}
        height={cfg.px}
        viewBox={`0 0 ${cfg.px} ${cfg.px}`}
        aria-label="Score: N/A"
        className="flex-shrink-0"
      >
        {/* Track */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#2a2e7a"
          strokeWidth={cfg.sw}
        />
        {/* Arc (empty) */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="rgba(83,58,253,0.3)"
          strokeWidth={cfg.sw}
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        <text
          x={cx}
          y={cy - 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="rgba(255,255,255,0.45)"
          style={{
            fontFamily: MONO,
            fontSize: size === "lg" ? "18px" : size === "md" ? "14px" : "11px",
            fontWeight: 600,
          }}
        >
          N/A
        </text>
      </svg>
    );
  }

  const clamped = Math.min(10, Math.max(0, score));
  const fillFraction = clamped / 10;
  const dashOffset = circumference * (1 - fillFraction);

  const colour = score >= 8 ? "#10b981" : score >= 5 ? "#fbbf24" : "#ef4444";

  const glowClass =
    score >= 8
      ? "animate-pulse-glow-emerald"
      : score >= 5
        ? "animate-pulse-glow-amber"
        : "animate-pulse-glow-red";

  return (
    <svg
      width={cfg.px}
      height={cfg.px}
      viewBox={`0 0 ${cfg.px} ${cfg.px}`}
      aria-label={`Score: ${score.toFixed(1)} out of 10`}
      className={`flex-shrink-0 ${glowClass}`}
    >
      {/* Track ring */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="#2a2e7a"
        strokeWidth={cfg.sw}
      />
      {/* Filled arc */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={colour}
        strokeWidth={cfg.sw}
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      {/* Score number */}
      <text
        x={cx}
        y={cy - 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={colour}
        style={{
          fontFamily: MONO,
          fontSize: size === "lg" ? "18px" : size === "md" ? "14px" : "11px",
          fontWeight: 600,
        }}
      >
        {score.toFixed(1)}
      </text>
      {/* /10 sub-label */}
      <text
        x={cx}
        y={cy + (size === "lg" ? 16 : size === "md" ? 13 : 11)}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="rgba(255,255,255,0.45)"
        style={{ fontFamily: MONO, fontSize: size === "lg" ? "10px" : "8px" }}
      >
        /10
      </text>
    </svg>
  );
}
