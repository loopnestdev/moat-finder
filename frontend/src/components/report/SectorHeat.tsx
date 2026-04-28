/** Single SVG flame icon — filled with gradient when active, dark when inactive */
function FlameIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="28"
      viewBox="0 0 22 28"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="flame-active"
          x1="11"
          y1="28"
          x2="11"
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
      </defs>
      <path
        d="M11 2C11 2 14 7 14 10C14 10 16 8 15.5 5.5C18 8 20 11.5 20 15C20 20.5 16 26 11 26C6 26 2 20.5 2 15C2 11.5 4 8 6.5 5.5C6 8 8 10 8 10C8 7 11 2 11 2Z"
        fill={active ? "url(#flame-active)" : "#2e2e2e"}
        stroke={active ? "none" : "#363636"}
        strokeWidth={active ? 0 : 1}
      />
      {active && (
        <path
          d="M11 14C11 14 12.5 16.5 12.5 18C12.5 19.4 11.8 20.5 11 20.5C10.2 20.5 9.5 19.4 9.5 18C9.5 16.5 11 14 11 14Z"
          fill="#fef3c7"
          opacity="0.7"
        />
      )}
    </svg>
  );
}

interface SectorHeatProps {
  heat: number;
  sectors: string[];
}

export default function SectorHeat({ heat, sectors = [] }: SectorHeatProps) {
  const clamped = Math.min(5, Math.max(0, Math.round(heat ?? 0)));

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        className="flex items-end gap-0.5"
        aria-label={`Sector heat: ${clamped} out of 5`}
      >
        {Array.from({ length: 5 }, (_, i) => (
          <FlameIcon key={i} active={i < clamped} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {sectors.map((sector) => (
          <span
            key={sector}
            className="text-xs border border-gold/60 text-gold bg-gold/10 px-3 py-1 rounded-full font-mono tracking-wide"
          >
            {sector}
          </span>
        ))}
      </div>
    </div>
  );
}
