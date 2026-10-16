import { WhatChangedSnapshot } from '../types';
import { TermInfo } from './TermInfo';
import { formatUtcTime } from '../utils/time';

interface WhatChangedPanelProps {
  whatChanged: WhatChangedSnapshot;
  onTriggerRefresh: () => void;
  isRefreshing: boolean;
}

export function WhatChangedPanel({
  whatChanged,
  onTriggerRefresh,
  isRefreshing,
}: WhatChangedPanelProps) {
  const isBaseline = !whatChanged.hasPrevious;

  const getTermForSignal = (name: string): string => {
    if (name.includes('Wildfire')) return 'Wildfire Pressure';
    if (name.includes('PM2.5')) return 'PM2.5';
    if (name.includes('Transport')) return 'Transport Alignment';
    if (name.includes('Persistence')) return 'Fire Persistence';
    return name;
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-[#090e18] p-5 shadow-xl space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-sm font-bold text-white tracking-wide uppercase font-mono">
            What Changed?
          </h2>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-cyan-800/60 bg-cyan-950/40 text-cyan-400">
            [CALCULATED BY HAZELENS]
          </span>
        </div>

        <div className="text-xs text-slate-400 font-mono">
          {whatChanged.previousTimestamp ? (
            <span>
              Compared with baseline from {formatUtcTime(whatChanged.previousTimestamp)}
            </span>
          ) : (
            <span className="text-cyan-400 font-mono">Baseline Session Active</span>
          )}
        </div>
      </div>

      {/* Content */}
      {isBaseline ? (
        <div className="p-4 rounded-lg bg-[#070b13] border border-dashed border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-mono text-cyan-300 font-semibold">
              Baseline assessment established. Change intelligence will appear after the next refresh.
            </p>
            <p className="text-[11px] text-slate-400">
              NASA FIRMS thermal detections, local PM2.5 baselines, and meteorological wind vectors are registered.
            </p>
          </div>

          <button
            onClick={onTriggerRefresh}
            disabled={isRefreshing}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-900 bg-cyan-400 rounded-md hover:bg-cyan-300 disabled:opacity-60 transition-colors whitespace-nowrap cursor-pointer shrink-0"
          >
            Run Refresh to Detect Change
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Headline Statement */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white">
              {whatChanged.headline}
            </span>
            {whatChanged.previousRiskLevel && whatChanged.currentRiskLevel && (
              <span className="text-xs font-mono text-slate-400">
                Level:{' '}
                <strong className="text-slate-300">{whatChanged.previousRiskLevel}</strong> →{' '}
                <strong className="text-cyan-300">{whatChanged.currentRiskLevel}</strong>
              </span>
            )}
          </div>

          {/* Clean Signal Direction List: Wildfire Pressure, PM2.5 Exposure, Transport Alignment, Rainfall / Fire Persistence */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            {whatChanged.signals.map((sig, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg border border-slate-800 bg-[#0b101c] flex items-center gap-2.5"
              >
                <span
                  className={`text-lg font-bold font-mono ${
                    sig.symbol === '↑'
                      ? 'text-rose-400'
                      : sig.symbol === '↓'
                      ? 'text-emerald-400'
                      : 'text-slate-400'
                  }`}
                >
                  {sig.symbol}
                </span>
                <div className="text-xs">
                  <div className="flex items-center text-slate-200 font-medium">
                    <span>{sig.signalName}</span>
                    <TermInfo term={getTermForSignal(sig.signalName)} />
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono capitalize">
                    {sig.direction}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Concise "Why this matters" statement (Req 5) */}
          <div className="p-3 rounded-lg bg-[#070c16] border border-cyan-900/30 text-xs text-slate-300 font-sans leading-relaxed">
            <strong className="text-cyan-300 font-semibold font-mono mr-1.5">Why this matters:</strong>
            {whatChanged.whyThisMatters || whatChanged.summary}
          </div>
        </div>
      )}
    </div>
  );
}
