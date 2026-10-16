import { CommunityOutlookData, sortCommunitiesByRisk } from '../types';
import { TermInfo } from './TermInfo';

interface CommunityOutlookPanelProps {
  communities: CommunityOutlookData[];
  selectedCommunityId: string;
  onSelectCommunity: (id: string) => void;
  onViewEvidence?: (id: string) => void;
}

export function CommunityOutlookPanel({
  communities,
  selectedCommunityId,
  onSelectCommunity,
  onViewEvidence,
}: CommunityOutlookPanelProps) {
  // Shared deterministic sort: Risk severity descending (SEVERE > HIGH > MODERATE > LOW), name ascending on tie
  const sortedCommunities = sortCommunitiesByRisk(communities);
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'SEVERE':
        return 'text-rose-400 border-rose-800/80 bg-rose-950/40';
      case 'HIGH':
        return 'text-orange-400 border-orange-800/80 bg-orange-950/40';
      case 'MODERATE':
        return 'text-amber-400 border-amber-800/80 bg-amber-950/40';
      default:
        return 'text-emerald-400 border-emerald-800/80 bg-emerald-950/40';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'Improving':
        return 'text-emerald-400';
      case 'Deteriorating':
        return 'text-rose-400';
      default:
        return 'text-slate-300';
    }
  };

  const sentinelContext: Record<string, { badge: string; scenario: string; description: string }> = {
    'palangka-raya': {
      badge: 'Near-Source',
      scenario: 'Near-Source Exposure',
      description: 'Near-source community representing strong local/regional exposure close to major fire-prone areas in Central Kalimantan.',
    },
    'kuching': {
      badge: 'Cross-Border',
      scenario: 'Cross-Border Receptor',
      description: 'Cross-border community representing a Malaysian receptor potentially influenced by wildfire activity across western Borneo.',
    },
    'singapore': {
      badge: 'Transboundary',
      scenario: 'Transboundary Receptor',
      description: 'Transboundary community representing a farther downstream receptor where haze may matter even without major local fire activity.',
    },
  };

  return (
    <div className="space-y-6">
      {/* Header: MONITORED COMMUNITIES */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-bold text-white uppercase font-mono tracking-wide">
              Monitored Communities
            </h2>
            <TermInfo term="Monitored Communities" position="bottom" />
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Selected receptor communities representing near-source, cross-border and transboundary exposure scenarios.
          </p>
        </div>
        <div className="text-xs font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-3 py-1 rounded inline-flex items-center">
          <span>Decision Cycle: 6–24 Hours</span>
          <TermInfo term="Decision Window" position="bottom" />
        </div>
      </div>

      {/* Grid of Community Cards: Using ONLY NOW, NEXT, WHY, ACTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {sortedCommunities.map((comm) => {
          const isSelected = comm.locationId === selectedCommunityId;
          const sentinel = sentinelContext[comm.locationId] || {
            badge: 'Monitored Receptor',
            scenario: 'Exposure Monitoring',
            description: 'Selected monitored receptor community.',
          };
          const whySummary =
            comm.primaryDriver === 'PM2.5 Exposure'
              ? 'PM2.5 particulate exposure + local wildfire smoke'
              : comm.primaryDriver === 'Wildfire Pressure'
              ? 'Active wildfire density + elevated Fire Radiative Power'
              : comm.primaryDriver === 'Atmospheric Transport'
              ? 'Wind vector alignment with upstream fire clusters'
              : 'Dry conditions + zero forecast precipitation';

          return (
            <div
              key={comm.locationId}
              onClick={() => onSelectCommunity(comm.locationId)}
              className={`rounded-xl border transition-all p-5 shadow-xl flex flex-col justify-between space-y-4 cursor-pointer ${
                isSelected
                  ? 'border-cyan-500/80 bg-[#091122] ring-1 ring-cyan-500/30'
                  : 'border-slate-800 bg-[#090e18] hover:border-slate-700'
              }`}
            >
              {/* Community Title, Sentinel Context Badge & Risk Badge */}
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-white tracking-tight">
                      {comm.locationName}
                    </h3>
                    <span
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-700 bg-slate-800/80 text-slate-300"
                      title={sentinel.description}
                    >
                      {sentinel.badge}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-slate-400 block mt-0.5">
                    {comm.country} · {sentinel.scenario}
                  </span>
                </div>
                <span
                  className={`px-2.5 py-1 text-xs font-mono font-bold rounded border ${getRiskColor(
                    comm.now.riskLevel
                  )}`}
                >
                  {comm.now.riskLevel}
                </span>
              </div>

              {/* 4 Clean Sections: NOW, NEXT, WHY, ACTION */}
              <div className="space-y-3.5 text-xs">
                {/* 1. NOW */}
                <div className="p-3 rounded-lg bg-[#070b14] border border-slate-800/80 space-y-1">
                  <span className="text-[10px] font-mono tracking-wider text-slate-400 uppercase font-semibold block">
                    NOW
                  </span>
                  <div className="text-sm font-bold text-white flex items-center">
                    <span className={getRiskColor(comm.now.riskLevel).split(' ')[0]}>
                      {comm.now.riskLevel}
                    </span>{' '}
                    <span className="ml-1 inline-flex items-center">
                      Environmental Impact Risk
                      <TermInfo term="Environmental Impact Risk" />
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">
                    Calculated Score: {comm.now.riskScore}/100 · {comm.now.confidence} Confidence
                  </div>
                </div>

                {/* 2. NEXT */}
                <div className="p-3 rounded-lg bg-[#070b14] border border-slate-800/80 space-y-1 font-mono">
                  <span className="text-[10px] tracking-wider text-slate-400 uppercase font-semibold block">
                    NEXT
                  </span>
                  <div className="flex justify-between text-xs pt-0.5">
                    <span className="text-slate-400">6h Horizon:</span>
                    <strong className={getTrendColor(comm.next6Hours)}>{comm.next6Hours}</strong>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">24h Horizon:</span>
                    <strong className={getTrendColor(comm.next24Hours)}>{comm.next24Hours}</strong>
                  </div>
                </div>

                {/* 3. WHY */}
                <div className="p-3 rounded-lg bg-[#070b14] border border-slate-800/80 space-y-1">
                  <span className="text-[10px] font-mono tracking-wider text-slate-400 uppercase font-semibold block">
                    WHY
                  </span>
                  <div className="text-xs font-semibold text-cyan-300 flex items-center">
                    <span>{comm.primaryDriver}</span>
                    <TermInfo
                      term={
                        comm.primaryDriver.includes('PM2.5')
                          ? 'PM2.5'
                          : comm.primaryDriver.includes('Wildfire')
                          ? 'Wildfire Pressure'
                          : comm.primaryDriver.includes('Transport')
                          ? 'Transport Alignment'
                          : 'Fire Persistence'
                      }
                    />
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed font-normal">
                    {whySummary}
                  </p>
                </div>

                {/* 4. ACTION */}
                <div className="p-3 rounded-lg bg-[#070b14] border border-slate-800/80 space-y-1">
                  <span className="text-[10px] font-mono tracking-wider text-slate-400 uppercase font-semibold block">
                    ACTION
                  </span>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Follow official local air-quality guidance and monitor changes during the next decision window.
                  </p>
                </div>
              </div>

              {/* View Evidence Action Link */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-500 text-[10px]">Verified Provenance Available</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onViewEvidence) onViewEvidence(comm.locationId);
                  }}
                  className="text-cyan-400 hover:text-cyan-300 underline font-semibold cursor-pointer"
                >
                  View Evidence →
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
