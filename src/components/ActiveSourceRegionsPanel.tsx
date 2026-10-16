import { SourceCluster } from '../types';
import { TermInfo } from './TermInfo';

interface ActiveSourceRegionsPanelProps {
  clusters: SourceCluster[];
  selectedClusterId?: string | null;
  onSelectCluster?: (id: string) => void;
}

export function ActiveSourceRegionsPanel({
  clusters,
  selectedClusterId,
  onSelectCluster,
}: ActiveSourceRegionsPanelProps) {
  // Rank top 3 wildfire source clusters using existing deterministic Wildfire Pressure calculation
  const topClusters = [...clusters]
    .sort((a, b) => {
      const pDiff = b.pressureScore - a.pressureScore;
      if (pDiff !== 0) return pDiff;
      const dDiff = b.detectionCount - a.detectionCount;
      if (dDiff !== 0) return dDiff;
      return b.totalFrp - a.totalFrp;
    })
    .slice(0, 3);

  const getPressureBadgeStyle = (level: string) => {
    switch (level) {
      case 'VERY HIGH':
        return 'text-rose-400 border-rose-800/80 bg-rose-950/40';
      case 'HIGH':
        return 'text-orange-400 border-orange-800/80 bg-orange-950/40';
      case 'MODERATE':
        return 'text-amber-400 border-amber-800/80 bg-amber-950/40';
      default:
        return 'text-emerald-400 border-emerald-800/80 bg-emerald-950/40';
    }
  };

  const getFrpLabel = (maxFrp: number) => {
    if (maxFrp >= 150) return `Extreme FRP (max: ${maxFrp} MW)`;
    if (maxFrp >= 50) return `Elevated FRP (max: ${maxFrp} MW)`;
    return `Moderate FRP (max: ${maxFrp} MW)`;
  };

  const getInterpretation = (cl: SourceCluster) => {
    if (cl.wildfirePressure === 'VERY HIGH') {
      return 'Persistent concentrated satellite fire activity across the source region.';
    }
    if (cl.wildfirePressure === 'HIGH') {
      return 'Elevated thermal anomaly density with active radiative energy output.';
    }
    if (cl.wildfirePressure === 'MODERATE') {
      return 'Moderate localized fire footprint observed within rolling 24 hours.';
    }
    return 'Low active-fire density observed within rolling 24 hours.';
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-[#090e18] p-5 shadow-xl space-y-3">
      {/* Header separating Source Pressure from Receptor Exposure (Req 2, 7) */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h2 className="text-sm font-bold text-white tracking-wide uppercase font-mono">
            Where is the Pressure Coming From?
          </h2>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-amber-800/60 bg-amber-950/40 text-amber-400 inline-flex items-center">
            [ACTIVE SOURCE REGIONS]
            <TermInfo term="Active Source Regions" position="bottom" />
          </span>
        </div>
        <span className="text-[11px] font-mono text-slate-500 inline-flex items-center">
          Wildfire Pressure Triage
          <TermInfo term="Wildfire Pressure" position="bottom" />
        </span>
      </div>

      {/* Conceptual Distinction Note (Req 2) */}
      <p className="text-[11px] text-slate-400 font-normal">
        Identifies the strongest wildfire source pressure across the monitored region, independently from downstream community exposure.
      </p>

      {/* Top 3 Active Source Region Rows */}
      <div className="divide-y divide-slate-800/80">
        {topClusters.map((cl, idx) => {
          const isSelected = cl.id === selectedClusterId;
          return (
            <div
              key={cl.id}
              onClick={() => onSelectCluster && onSelectCluster(cl.id)}
              className={`py-3 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-4 transition-colors rounded px-2 -mx-2 cursor-pointer ${
                isSelected ? 'bg-slate-900/70 ring-1 ring-cyan-500/40' : 'hover:bg-slate-900/40'
              }`}
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-slate-500">#{idx + 1}</span>
                  <span className="text-sm font-bold text-white font-sans">
                    {cl.name}
                  </span>
                  <span className="text-slate-600 font-mono">·</span>
                  <span
                    className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${getPressureBadgeStyle(
                      cl.wildfirePressure
                    )}`}
                  >
                    {cl.wildfirePressure}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono text-slate-400 pt-0.5">
                  <span className="text-amber-300 font-medium">
                    {cl.detectionCount} detections
                  </span>
                  <span>·</span>
                  <span className="text-slate-300">{getFrpLabel(cl.maxFrp)}</span>
                  <span>·</span>
                  <span className="text-slate-400">{cl.subregion}</span>
                </div>

                <p className="text-xs text-slate-300 font-normal leading-relaxed pt-0.5">
                  {getInterpretation(cl)}
                </p>
              </div>

              <div className="text-[11px] font-mono text-cyan-400 shrink-0 hidden md:block">
                Focus on Map →
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
