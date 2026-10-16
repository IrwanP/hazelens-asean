import { useState, useEffect, useCallback } from 'react';
import { TopBar } from './components/TopBar';
import { ValuePropositionBanner } from './components/ValuePropositionBanner';
import { WhatChangedPanel } from './components/WhatChangedPanel';
import { AttentionNowPanel } from './components/AttentionNowPanel';
import { ActiveSourceRegionsPanel } from './components/ActiveSourceRegionsPanel';
import { AseanMap } from './components/AseanMap';
import { CommunityOutlookPanel } from './components/CommunityOutlookPanel';
import { AiBriefPanel } from './components/AiBriefPanel';
import { EvidenceAuditPanel } from './components/EvidenceAuditPanel';
import { DecisionSystemState } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'situation' | 'communities' | 'ai' | 'evidence'>('situation');
  const [decisionState, setDecisionState] = useState<DecisionSystemState | null>(null);
  const [selectedCommunityId, setSelectedCommunityId] = useState<string>('palangka-raya');
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const loadDecisionState = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/decision-state');
      if (res.ok) {
        const data: DecisionSystemState = await res.json();
        setDecisionState(data);
        setLastUpdated(data.timestamp || new Date().toISOString());
      }
    } catch (err) {
      console.error('Failed to load decision intelligence state:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDecisionState();
  }, [loadDecisionState]);

  const handleSelectCommunityAndOpenCommunities = (id: string) => {
    setSelectedCommunityId(id);
    setActiveTab('communities');
  };

  const handleViewEvidenceForCommunity = (id: string) => {
    setSelectedCommunityId(id);
    setActiveTab('evidence');
  };

  const handleSelectCluster = (id: string) => {
    setSelectedClusterId(id);
    const mapEl = document.getElementById('regional-evidence-map');
    if (mapEl) {
      mapEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  return (
    <div className="min-h-screen bg-[#070a11] text-slate-200 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* 3-Zone Top Bar Contract with Simplified 4-Tab Navigation (Req 2) */}
      <TopBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onRefresh={loadDecisionState}
        isRefreshing={isRefreshing}
        lastUpdated={lastUpdated}
      />

      {/* Main Decision Workspace */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 space-y-6">
        {decisionState && (
          <>
            {/* 1. Value Proposition Banner & Regional Environmental Situation (Req 3, 11) */}
            <ValuePropositionBanner
              situation={decisionState.regionalSituation}
              activeFiresCount={decisionState.regionalSituation.totalActiveFiresDetected}
              lastUpdated={lastUpdated}
            />

            {/* TAB 1: SITUATION (Decision Hierarchy: What Changed → Attention (Receptors) → Source Pressure → Regional Evidence Map) */}
            {/* Kept persistently in DOM using CSS display to preserve Google Maps lifecycle */}
            <div className={activeTab === 'situation' ? 'space-y-6' : 'hidden'}>
              {/* 2. What Changed Panel (Req 5) */}
              <WhatChangedPanel
                whatChanged={decisionState.whatChanged}
                onTriggerRefresh={loadDecisionState}
                isRefreshing={isRefreshing}
              />

              {/* 3. What Needs Attention Now? (Ranked Monitored Sentinel Communities by Environmental Impact Risk) */}
              <AttentionNowPanel
                items={decisionState.attentionItems || []}
                onSelectCommunity={handleSelectCommunityAndOpenCommunities}
              />

              {/* Contextual Model Link: Source vs Receptor distinction */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800/80 text-[11px] font-mono text-slate-400">
                <span>
                  <strong className="text-amber-400 font-medium">Source regions</strong> show where wildfire pressure originates. <strong className="text-cyan-400 font-medium">Monitored communities</strong> show where downstream environmental impact may matter.
                </span>
                <span className="text-[10px] text-slate-500 font-mono tracking-wider hidden sm:inline">
                  SOURCE → TRANSPORT → EXPOSURE → IMPACT → ACTION
                </span>
              </div>

              {/* 4. Where is the Pressure Coming From? (Top 3 Active Wildfire Source Regions) */}
              <ActiveSourceRegionsPanel
                clusters={decisionState.clusters}
                selectedClusterId={selectedClusterId}
                onSelectCluster={handleSelectCluster}
              />

              {/* 5. Regional Evidence Map (Below decision intelligence, reduced vertical height) */}
              <AseanMap
                fires={decisionState.fires}
                clusters={decisionState.clusters}
                communities={decisionState.communities}
                selectedCommunityId={selectedCommunityId}
                onSelectCommunity={setSelectedCommunityId}
                selectedClusterId={selectedClusterId}
                onSelectCluster={setSelectedClusterId}
                isVisible={activeTab === 'situation'}
              />
            </div>

            {/* TAB 2: COMMUNITIES (Req 8: Strictly NOW, NEXT, WHY, ACTION, View Evidence) */}
            <div className={activeTab === 'communities' ? 'space-y-6' : 'hidden'}>
              <CommunityOutlookPanel
                communities={decisionState.communities}
                selectedCommunityId={selectedCommunityId}
                onSelectCommunity={setSelectedCommunityId}
                onViewEvidence={handleViewEvidenceForCommunity}
              />
            </div>

            {/* TAB 3: AI BRIEF (Req 9: Concise Gemini brief in 5 structured sections) */}
            <div className={activeTab === 'ai' ? 'space-y-6' : 'hidden'}>
              <AiBriefPanel
                communities={decisionState.communities}
                selectedCommunityId={selectedCommunityId}
                onContinueToAssessment={() => setActiveTab('situation')}
              />
            </div>

            {/* TAB 4: EVIDENCE (Req 10: Exactly 4 categories: OBSERVED, FORECAST, CALCULATED, AI INTERPRETATION) */}
            <div className={activeTab === 'evidence' ? 'space-y-6' : 'hidden'}>
              <EvidenceAuditPanel
                communities={decisionState.communities}
                selectedCommunityId={selectedCommunityId}
              />
            </div>
          </>
        )}
      </main>

      {/* Institutional Decision Intelligence Footer */}
      <footer className="border-t border-slate-800/80 bg-[#06090f] px-6 py-4 text-xs text-slate-500">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 font-mono">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-semibold">HazeLens ASEAN</span>
            <span aria-hidden="true">·</span>
            <span>Environmental Decision Intelligence for Southeast Asia</span>
          </div>

          <div className="flex items-center gap-2 text-slate-400">
            <span>From environmental signals to early action.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
