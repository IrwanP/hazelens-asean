import { AttentionItem, sortCommunitiesByRisk } from '../types';
import { TermInfo } from './TermInfo';

interface AttentionNowPanelProps {
  items: AttentionItem[];
  onSelectCommunity?: (id: string) => void;
}

export function AttentionNowPanel({ items, onSelectCommunity }: AttentionNowPanelProps) {
  // Shared deterministic sort: Risk severity descending (SEVERE > HIGH > MODERATE > LOW), name ascending on tie
  const sortedItems = sortCommunitiesByRisk(items);

  const getBadgeStyle = (level: string) => {
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

  const getSentinelContext = (id: string) => {
    switch (id) {
      case 'palangka-raya':
        return {
          badge: 'Near-Source',
          description: 'Near-source community representing strong local/regional exposure close to fire-prone peatlands in Central Kalimantan.',
        };
      case 'kuching':
        return {
          badge: 'Cross-Border',
          description: 'Cross-border community representing a Malaysian receptor potentially influenced by wildfire activity in western Borneo.',
        };
      case 'singapore':
        return {
          badge: 'Transboundary',
          description: 'Transboundary community representing a farther downstream receptor where haze can arrive without major local burning.',
        };
      default:
        return {
          badge: 'Monitored Receptor',
          description: 'Deliberately selected monitored community used to monitor exposure scenarios.',
        };
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-[#090e18] p-5 shadow-xl space-y-3">
      {/* Header with Monitored Communities label & Info Tooltip */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-sm font-bold text-white tracking-wide uppercase font-mono">
            What Needs Attention Now?
          </h2>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-cyan-800/60 bg-cyan-950/40 text-cyan-400 inline-flex items-center">
            [MONITORED COMMUNITIES]
            <TermInfo term="Monitored Communities" position="bottom" />
          </span>
        </div>
        <span className="text-[11px] font-mono text-slate-500 inline-flex items-center">
          Receptor Triaging
          <TermInfo term="Environmental Impact Risk" position="bottom" />
        </span>
      </div>

      {/* Supporting Description */}
      <p className="text-[11px] text-slate-400 font-normal">
        Prioritizes environmental impact across selected monitored communities using HazeLens deterministic risk assessment.
      </p>

      <div className="divide-y divide-slate-800/80">
        {sortedItems.map((item) => {
          const sentinel = getSentinelContext(item.locationId);
          return (
            <div
              key={item.locationId}
              onClick={() => onSelectCommunity && onSelectCommunity(item.locationId)}
              className="py-3 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-4 hover:bg-slate-900/40 transition-colors rounded px-2 -mx-2 cursor-pointer"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-white font-sans">
                    {item.locationName}
                  </span>
                  <span className="text-slate-600 font-mono">·</span>
                  <span
                    className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${getBadgeStyle(
                      item.impactLevel
                    )}`}
                  >
                    {item.impactLevel}
                  </span>
                  <span
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-700 bg-slate-800/80 text-slate-300"
                    title={sentinel.description}
                  >
                    {sentinel.badge}
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-normal leading-relaxed">
                  {item.primaryConcern} {item.nextAction}
                </p>
              </div>

              <div className="text-[11px] font-mono text-cyan-400 shrink-0 hidden md:block">
                View Outlook →
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
