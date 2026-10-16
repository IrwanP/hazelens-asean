import { useState } from 'react';
import { SourceCluster, FireDetection } from '../types';

interface SourceRegionsPanelProps {
  clusters: SourceCluster[];
  fires: FireDetection[];
  selectedClusterId?: string | null;
  onSelectCluster?: (id: string) => void;
}

export function SourceRegionsPanel({
  clusters,
  fires,
  selectedClusterId,
  onSelectCluster,
}: SourceRegionsPanelProps) {
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(
    selectedClusterId || (clusters[0] ? clusters[0].id : null)
  );

  const activeClusterId = selectedClusterId || internalSelectedId;
  const activeCluster = clusters.find((c) => c.id === activeClusterId) || clusters[0];

  const handleClusterClick = (id: string) => {
    setInternalSelectedId(id);
    if (onSelectCluster) onSelectCluster(id);
  };

  const getPressureBadge = (level: string) => {
    switch (level) {
      case 'VERY HIGH':
        return 'text-rose-400 bg-rose-950/40 border-rose-800/60';
      case 'HIGH':
        return 'text-orange-400 bg-orange-950/40 border-orange-800/60';
      case 'MODERATE':
        return 'text-amber-400 bg-amber-950/40 border-amber-800/60';
      default:
        return 'text-emerald-400 bg-emerald-950/40 border-emerald-800/60';
    }
  };

  return (
    <div className="space-y-6">
      {/* Source Clusters Grid Header */}
      <div className="rounded-xl border border-slate-800 bg-[#090e18] p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-white uppercase font-mono tracking-wide">
              Source Region Intelligence
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              NASA FIRMS thermal detections grouped into meaningful spatial source clusters with deterministic Wildfire Pressure.
            </p>
          </div>

          <div className="text-xs font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-800/50 px-2.5 py-1 rounded">
            [CURRENT SOURCE DATA — SATELLITE RADIOMETRY]
          </div>
        </div>

        {/* Disclaimer as specified */}
        <div className="p-3 rounded-lg bg-[#070b13] border border-slate-800 text-[11px] font-mono text-slate-400 leading-relaxed">
          ℹ️ {clusters[0]?.disclaimer || 'NASA FIRMS detects thermal anomalies from satellite pixel radiometry; detections represent fire activity footprints rather than individual separate wildfires.'}
        </div>

        {/* Clusters List / Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {clusters.map((cl) => {
            const isSelected = cl.id === activeCluster?.id;
            return (
              <div
                key={cl.id}
                onClick={() => handleClusterClick(cl.id)}
                className={`p-4 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#0f172a] border-cyan-500/80 shadow-lg'
                    : 'bg-[#0b101c] border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-white text-sm">{cl.name}</h3>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {cl.subregion} · Centroid {cl.centroid.lat.toFixed(2)}°, {cl.centroid.lon.toFixed(2)}°
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded border shrink-0 ${getPressureBadge(cl.wildfirePressure)}`}>
                    {cl.wildfirePressure}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-800/80 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-500 block">DETECTIONS</span>
                    <strong className="text-amber-300 text-sm">{cl.detectionCount}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">HIGH CONF.</span>
                    <strong className="text-red-400 text-sm">{cl.highConfidenceCount}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">MAX FRP</span>
                    <strong className="text-cyan-300 text-sm">{cl.maxFrp} MW</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Cluster Deep Inspection Panel as specified */}
      {activeCluster && (
        <div className="rounded-xl border border-cyan-500/40 bg-[#090e18] p-5 sm:p-6 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-bold text-white tracking-tight">{activeCluster.name}</h3>
                <span className={`px-2 py-0.5 text-xs font-mono font-bold rounded border ${getPressureBadge(activeCluster.wildfirePressure)}`}>
                  {activeCluster.wildfirePressure} WILDFIRE PRESSURE
                </span>
                <span className="text-[10px] font-mono text-cyan-400">[CURRENT SOURCE DATA]</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                Centroid: {activeCluster.centroid.lat.toFixed(4)}°N, {activeCluster.centroid.lon.toFixed(4)}°E · Subregion: {activeCluster.subregion}
              </p>
            </div>

            <div className="text-xs font-mono text-slate-400">
              Latest Observation: <strong className="text-slate-200">{activeCluster.latestObservationTime}</strong>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 font-mono text-xs">
            <div className="p-3 rounded bg-[#0b101c] border border-slate-800">
              <span className="text-[10px] text-slate-400 block">TOTAL DETECTIONS</span>
              <strong className="text-base font-bold text-amber-300 mt-1 block">{activeCluster.detectionCount}</strong>
            </div>

            <div className="p-3 rounded bg-[#0b101c] border border-slate-800">
              <span className="text-[10px] text-slate-400 block">HIGH-CONFIDENCE</span>
              <strong className="text-base font-bold text-rose-400 mt-1 block">{activeCluster.highConfidenceCount}</strong>
            </div>

            <div className="p-3 rounded bg-[#0b101c] border border-slate-800">
              <span className="text-[10px] text-slate-400 block">AVERAGE FRP</span>
              <strong className="text-base font-bold text-slate-200 mt-1 block">{activeCluster.avgFrp} MW</strong>
            </div>

            <div className="p-3 rounded bg-[#0b101c] border border-slate-800">
              <span className="text-[10px] text-slate-400 block">MAXIMUM FRP</span>
              <strong className="text-base font-bold text-cyan-300 mt-1 block">{activeCluster.maxFrp} MW</strong>
            </div>

            <div className="p-3 rounded bg-[#0b101c] border border-slate-800">
              <span className="text-[10px] text-slate-400 block">DAY OBSERVATIONS</span>
              <strong className="text-base font-bold text-yellow-300 mt-1 block">{activeCluster.dayNightDistribution.day}</strong>
            </div>

            <div className="p-3 rounded bg-[#0b101c] border border-slate-800">
              <span className="text-[10px] text-slate-400 block">NIGHT OBSERVATIONS</span>
              <strong className="text-base font-bold text-blue-300 mt-1 block">{activeCluster.dayNightDistribution.night}</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
