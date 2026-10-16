interface TopBarProps {
  activeTab: 'situation' | 'communities' | 'ai' | 'evidence';
  setActiveTab: (tab: 'situation' | 'communities' | 'ai' | 'evidence') => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  lastUpdated: string | null;
}

export function TopBar({
  activeTab,
  setActiveTab,
  onRefresh,
  isRefreshing,
  lastUpdated,
}: TopBarProps) {
  return (
    <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-slate-800 bg-[#080c14]/95 backdrop-blur-md sticky top-0 z-40">
      {/* Zone 1: Brand wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xl font-bold tracking-tight text-white whitespace-nowrap">
          HazeLens ASEAN
        </span>
      </div>

      {/* Zone 2: 4 simplified single-line navigation links */}
      <nav className="flex items-center gap-4 sm:gap-8 text-xs sm:text-sm font-medium text-slate-400 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('situation')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'situation' ? 'text-cyan-400 border-b-2 border-cyan-400 pb-0.5 font-semibold' : ''
          }`}
        >
          Situation
        </button>
        <button
          onClick={() => setActiveTab('communities')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'communities' ? 'text-cyan-400 border-b-2 border-cyan-400 pb-0.5 font-semibold' : ''
          }`}
        >
          Communities
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'ai' ? 'text-cyan-400 border-b-2 border-cyan-400 pb-0.5 font-semibold' : ''
          }`}
        >
          AI Brief
        </button>
        <button
          onClick={() => setActiveTab('evidence')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'evidence' ? 'text-cyan-400 border-b-2 border-cyan-400 pb-0.5 font-semibold' : ''
          }`}
        >
          Evidence
        </button>
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="px-4 py-2 text-xs font-semibold text-slate-900 bg-cyan-400 rounded-lg hover:bg-cyan-300 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer shadow-sm"
        >
          {isRefreshing ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5 text-slate-900" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              <span>Refreshing Signals...</span>
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5 text-slate-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 16h5v5" />
              </svg>
              <span>Refresh Intelligence</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
}
