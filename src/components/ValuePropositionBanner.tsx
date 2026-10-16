import { RegionalSituationData } from '../types';
import { TermInfo } from './TermInfo';
import { formatUtcTime } from '../utils/time';

interface ValuePropositionBannerProps {
  situation: RegionalSituationData;
  activeFiresCount: number;
  lastUpdated: string | null;
}

export function ValuePropositionBanner({
  situation,
  activeFiresCount,
  lastUpdated,
}: ValuePropositionBannerProps) {
  const getStatusColor = (level: string) => {
    switch (level) {
      case 'Severe':
        return 'text-rose-400 bg-rose-950/40 border-rose-800/60';
      case 'High':
        return 'text-orange-400 bg-orange-950/40 border-orange-800/60';
      case 'Elevated':
        return 'text-amber-400 bg-amber-950/40 border-amber-800/60';
      case 'Moderate':
        return 'text-yellow-300 bg-yellow-950/40 border-yellow-800/60';
      default:
        return 'text-emerald-400 bg-emerald-950/40 border-emerald-800/60';
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Mandatory Product Positioning (Req 11) */}
      <div className="rounded-xl border border-slate-800 bg-gradient-to-r from-[#090e18] via-[#0b1424] to-[#090e18] p-5 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
          <div>
            <span className="text-[11px] font-mono font-semibold tracking-wider uppercase text-cyan-400 block">
              Environmental Decision Intelligence for Southeast Asia
            </span>
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight mt-0.5">
              From environmental signals to early action.
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-[11px] font-mono rounded bg-cyan-950/60 border border-cyan-800/60 text-cyan-300 inline-flex items-center">
              Active Decision Window: 6–24h
              <TermInfo term="Decision Window" position="bottom" />
            </span>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal pt-2.5">
          HazeLens connects wildfire, weather and air-quality signals to identify what is changing, who may be affected next, and what communities should pay attention to.
        </p>
      </div>

      {/* 2. Regional Environmental Situation & Exactly 4 Decision Indicators (Req 3 & Req 1) */}
      <div className="rounded-xl border border-slate-800 bg-[#090e18] p-5 sm:p-6 shadow-2xl space-y-4">
        {/* Top Header & Status Level */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center">
              Regional Environmental Situation
              <TermInfo term="Environmental Impact Risk" />
            </h2>
            <span className={`px-2.5 py-0.5 text-xs font-mono font-bold rounded border ${getStatusColor(situation.statusLevel)}`}>
              {situation.statusLevel.toUpperCase()}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-cyan-800/60 bg-cyan-950/40 text-cyan-400">
              [CALCULATED BY HAZELENS]
            </span>
          </div>

          {/* Calibrated NASA FIRMS NOAA-21 Metadata Labeling (Req 1) */}
          <div className="text-right text-[11px] font-mono text-slate-400 space-y-0.5">
            <div className="flex items-center justify-end gap-1">
              <span className="text-slate-300 font-semibold inline-flex items-center">
                NASA FIRMS Active-Fire Detections:
                <TermInfo term="NASA FIRMS" />
              </span>{' '}
              <strong className="text-amber-400 font-bold ml-1">
                {situation.borneoBoundingAreaCount ?? activeFiresCount}
              </strong>{' '}
              <span className="text-slate-500 inline-flex items-center">
                active-fire detections (Borneo bbox: 108°E–119°E, 5°S–4°N)
                <TermInfo term="Active-fire detection" />
              </span>
            </div>
            <div className="text-[10px] text-slate-500 flex items-center justify-end gap-1">
              <span>NOAA-21 VIIRS · Near Real-Time · Rolling 24h · HazeLens Synced {formatUtcTime(lastUpdated)}</span>
              <TermInfo term="NOAA-21" />
              <TermInfo term="VIIRS" />
            </div>
          </div>
        </div>

        {/* Primary Narrative Summary */}
        <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-normal">
          {situation.situationSummary}
        </p>

        {/* Exactly 4 Top-Level Decision Indicators (Req 3) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
          <div className="p-3.5 rounded-lg border border-slate-800 bg-[#0b101c]">
            <span className="text-[10px] font-mono tracking-wider uppercase text-slate-400 flex items-center justify-between">
              HIGHEST COMMUNITY IMPACT
            </span>
            <span className="text-xs font-bold text-cyan-300 mt-1 block">
              {situation.highestCommunityImpact}
            </span>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-800 bg-[#0b101c]">
            <span className="text-[10px] font-mono tracking-wider uppercase text-slate-400 flex items-center justify-between">
              <span>STRONGEST SOURCE PRESSURE</span>
              <TermInfo term="Wildfire Pressure" />
            </span>
            <span className="text-xs font-bold text-amber-300 mt-1 block">
              {situation.strongestSourcePressure}
            </span>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-800 bg-[#0b101c]">
            <span className="text-[10px] font-mono tracking-wider uppercase text-slate-400 flex items-center justify-between">
              <span>NEXT DECISION WINDOW</span>
              <TermInfo term="Decision Window" />
            </span>
            <span className="text-xs font-bold text-emerald-400 mt-1 block font-mono">
              {situation.nextDecisionWindow}
            </span>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-800 bg-[#0b101c]">
            <span className="text-[10px] font-mono tracking-wider uppercase text-slate-400 block">
              ASSESSMENT CONFIDENCE
            </span>
            <span className="text-xs font-bold text-slate-200 mt-1 block font-mono">
              {situation.confidence} Confidence
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
