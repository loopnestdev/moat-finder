interface BearCaseProps {
  bearCase: string;
  riskFactors: string[];
}

export default function BearCase({ bearCase, riskFactors }: BearCaseProps) {
  return (
    <div className="rounded-lg border border-red-100 bg-red-50 p-4 sm:p-6">
      <h3 className="text-sm font-semibold text-red-700 uppercase tracking-wider mb-3">
        Bear Case
      </h3>
      <p className="text-gray-800 leading-relaxed mb-4">{bearCase}</p>
      {riskFactors.length > 0 && (
        <ul className="space-y-1.5">
          {riskFactors.map((risk, i) => (
            <li key={i} className="flex gap-2 text-sm text-gray-700">
              <span className="text-red-500 flex-shrink-0 mt-0.5">⚠</span>
              <span>{risk}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
