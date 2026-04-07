import Badge from '../ui/Badge';

interface SectorHeatProps {
  heat: number;
  sectors: string[];
}

export default function SectorHeat({ heat, sectors }: SectorHeatProps) {
  const clamped = Math.min(5, Math.max(0, Math.round(heat)));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-0.5" aria-label={`Sector heat: ${clamped} out of 5`}>
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={i < clamped ? 'text-orange-500 text-lg' : 'text-gray-300 text-lg'}>
            {i < clamped ? '🔥' : '○'}
          </span>
        ))}
      </div>
      {sectors.map((sector) => (
        <Badge key={sector} variant="orange">
          {sector}
        </Badge>
      ))}
    </div>
  );
}
