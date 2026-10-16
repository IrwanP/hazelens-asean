import { useState, useEffect, useRef } from 'react';
import { CommunityOutlookData } from '../types';
import { FormattedMarkdown } from './FormattedMarkdown';
import { formatUtcTime } from '../utils/time';

function GeminiSparkleIcon({ className = 'w-9 h-9' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="geminiSparkleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#c084fc" />
        </linearGradient>
      </defs>
      <path
        d="M18 2 C18 10.8 10.8 18 2 18 C10.8 18 18 25.2 18 34 C18 25.2 25.2 18 34 18 C25.2 18 18 10.8 18 2 Z"
        fill="url(#geminiSparkleGrad)"
      />
      <path
        d="M29 3 C29 5.8 26.8 8 24 8 C26.8 8 29 10.2 29 13 C29 10.2 31.2 8 34 8 C31.2 8 29 5.8 29 3 Z"
        fill="#38bdf8"
        opacity="0.9"
      />
    </svg>
  );
}

interface AiBriefPanelProps {
  communities: CommunityOutlookData[];
  selectedCommunityId: string;
  onContinueToAssessment?: () => void;
}

interface ParsedBriefSection {
  title: string;
  content: string;
}

export function AiBriefPanel({
  communities,
  selectedCommunityId,
  onContinueToAssessment,
}: AiBriefPanelProps) {
  const [briefing, setBriefing] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationStep, setGenerationStep] = useState<number>(0);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [evidenceUsed, setEvidenceUsed] = useState<string[]>([]);
  const [briefStatus, setBriefStatus] = useState<
    'idle' | 'generating' | 'ready' | 'timeout' | 'cancelled' | 'error'
  >('idle');
  const [briefErrorNotice, setBriefErrorNotice] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isRequestActiveRef = useRef<boolean>(false);

  const [queryInput, setQueryInput] = useState<string>('');
  const [isQuerying, setIsQuerying] = useState<boolean>(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [qaHistory, setQaHistory] = useState<Array<{ q: string; a: string; time: string }>>([]);

  // Discoverability & progressive expansion states
  const [isAskVisible, setIsAskVisible] = useState<boolean>(false);
  const [showAllQuestions, setShowAllQuestions] = useState<boolean>(false);
  const askSectionRef = useRef<HTMLDivElement>(null);
  const queryInputRef = useRef<HTMLInputElement>(null);

  const selectedCommunity = communities.find((c) => c.locationId === selectedCommunityId) || communities[0];

  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Progressive loading animation step timer & elapsed time counter during briefing synthesis
  useEffect(() => {
    let timer1: NodeJS.Timeout;
    let timer2: NodeJS.Timeout;
    let timer3: NodeJS.Timeout;
    let timer4: NodeJS.Timeout;
    let interval: NodeJS.Timeout;

    if (isGenerating) {
      setElapsedSeconds(0);
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);

      setGenerationStep(1); // Satellite observations ✓
      timer1 = setTimeout(() => setGenerationStep(2), 600); // Weather & transport ✓
      timer2 = setTimeout(() => setGenerationStep(3), 1200); // Community exposure ✓
      timer3 = setTimeout(() => setGenerationStep(4), 1800); // Risk drivers ✓
      timer4 = setTimeout(() => setGenerationStep(5), 2400); // Gemini synthesis ●
    } else {
      setGenerationStep(0);
      setElapsedSeconds(0);
    }

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
      clearInterval(interval);
    };
  }, [isGenerating]);

  // Cleanup abort controller and timeout timer on unmount
  useEffect(() => {
    return () => {
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  // Req 4: Manual Cancellation using the same abort lifecycle as the 30-second timeout
  const handleCancelAnalysis = () => {
    if (isRequestActiveRef.current && abortControllerRef.current) {
      isRequestActiveRef.current = false;
      if (timeoutTimerRef.current) {
        clearTimeout(timeoutTimerRef.current);
        timeoutTimerRef.current = null;
      }
      abortControllerRef.current.abort('cancelled');
      setIsGenerating(false);
      setBriefStatus('cancelled');
      setBriefErrorNotice('Gemini analysis stopped. The HazeLens deterministic assessment remains available.');
    }
  };

  // Req 3: Abortable request lifecycle with strict 30-second maximum
  const handleGenerateBriefing = async () => {
    if (isGenerating || isRequestActiveRef.current) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (timeoutTimerRef.current) {
      clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    isRequestActiveRef.current = true;

    setIsGenerating(true);
    setBriefStatus('generating');
    setBriefErrorNotice(null);

    // Hard 30-second timeout enforcement (Req 3)
    timeoutTimerRef.current = setTimeout(() => {
      if (isRequestActiveRef.current) {
        isRequestActiveRef.current = false;
        controller.abort('timeout');
        setIsGenerating(false);
        setBriefStatus('timeout');
        setBriefErrorNotice(
          'Gemini synthesis exceeded the 30-second response limit. The HazeLens deterministic assessment remains available.'
        );
      }
    }, 30000);

    try {
      const res = await fetch('/api/ai/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ communityId: selectedCommunity?.locationId }),
        signal: controller.signal,
      });

      // If aborted by 30s timer or manual cancellation, ignore response
      if (!isRequestActiveRef.current) {
        return;
      }

      if (timeoutTimerRef.current) {
        clearTimeout(timeoutTimerRef.current);
        timeoutTimerRef.current = null;
      }
      isRequestActiveRef.current = false;

      // Req 2: Harden frontend response parsing — inspect response.ok and Content-Type before calling json()
      const contentType = res.headers.get('content-type') || '';
      const isJson = contentType.toLowerCase().includes('application/json');

      if (!isJson) {
        console.error(
          `[HazeLens Diagnostics] Unexpected non-JSON content type: "${contentType}", HTTP status: ${res.status}`
        );
        setIsGenerating(false);
        setBriefStatus('error');
        setBriefErrorNotice(
          'Gemini Environmental Intelligence is temporarily unavailable. The underlying HazeLens assessment remains available.'
        );
        return;
      }

      let data: any;
      try {
        data = await res.json();
      } catch (jsonErr: any) {
        console.error('[HazeLens Diagnostics] JSON parsing error:', jsonErr);
        setIsGenerating(false);
        setBriefStatus('error');
        setBriefErrorNotice(
          'Gemini Environmental Intelligence is temporarily unavailable. The underlying HazeLens assessment remains available.'
        );
        return;
      }

      setIsGenerating(false);

      if (res.ok && data.briefing) {
        setBriefing(data.briefing);
        setGeneratedAt(data.generatedAt || new Date().toISOString());
        setEvidenceUsed(
          data.evidenceUsed && data.evidenceUsed.length > 0
            ? data.evidenceUsed
            : [
                'NASA FIRMS · NOAA-21 VIIRS (Rolling 24h)',
                'Copernicus CAMS via Open-Meteo [FALLBACK SOURCE]',
                'Open-Meteo Meteorological Reanalysis [FALLBACK SOURCE]',
                'HazeLens Deterministic Risk Engine',
              ]
        );
        setBriefStatus('ready');
      } else {
        console.error('[HazeLens Diagnostics] Server response failure:', data);
        const isServerTimeout = res.status === 504 || data?.error?.toLowerCase().includes('response limit') || data?.error?.toLowerCase().includes('timeout');
        setBriefStatus(isServerTimeout ? 'timeout' : 'error');
        setBriefErrorNotice(
          isServerTimeout
            ? 'Gemini synthesis exceeded the 30-second response limit. The HazeLens deterministic assessment remains available.'
            : 'Gemini Environmental Intelligence is temporarily unavailable. The underlying HazeLens assessment remains available.'
        );
      }
    } catch (err: any) {
      if (!isRequestActiveRef.current) {
        // Aborted by 30s timeout or manual cancellation
        return;
      }
      isRequestActiveRef.current = false;
      if (timeoutTimerRef.current) {
        clearTimeout(timeoutTimerRef.current);
        timeoutTimerRef.current = null;
      }
      setIsGenerating(false);
      setBriefStatus('error');
      console.error('[HazeLens Diagnostics] Network error during AI briefing:', err);
      setBriefErrorNotice(
        'Gemini Environmental Intelligence is temporarily unavailable. The underlying HazeLens assessment remains available.'
      );
    }
  };

  const handleSendQuery = async (promptText?: string) => {
    const q = promptText || queryInput;
    if (!q.trim() || isQuerying) return;

    setIsQuerying(true);
    setQueryError(null);
    try {
      const res = await fetch('/api/ai/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPrompt: q,
          locationId: selectedCommunity?.locationId,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.toLowerCase().includes('application/json')) {
        console.error(`[HazeLens Diagnostics] Unexpected non-JSON query response: ${contentType}`);
        setQueryError('Gemini Environmental Intelligence is temporarily unavailable. Please try again.');
        return;
      }

      let data: any;
      try {
        data = await res.json();
      } catch (jsonErr) {
        console.error('[HazeLens Diagnostics] JSON parsing error on query:', jsonErr);
        setQueryError('Gemini Environmental Intelligence is temporarily unavailable. Please try again.');
        return;
      }

      if (res.ok && data.answer) {
        setQaHistory((prev) => [
          { q, a: data.answer, time: formatUtcTime(new Date().toISOString()) },
          ...prev,
        ]);
        if (!promptText) setQueryInput('');
      } else {
        console.error('[HazeLens Diagnostics] Query error response:', data);
        setQueryError('Gemini Environmental Intelligence is temporarily unavailable. Please try again.');
      }
    } catch (err: any) {
      console.error('[HazeLens Diagnostics] Network error querying Gemini:', err);
      setQueryError('Gemini Environmental Intelligence is temporarily unavailable. Please try again.');
    } finally {
      setIsQuerying(false);
    }
  };

  // Structured parse of the 6 mandatory sections:
  // WHAT IS HAPPENING, WHAT CHANGED, WHO NEEDS ATTENTION, NEXT 6–24 HOURS, RECOMMENDED AWARENESS, CONFIDENCE & LIMITATIONS
  const parseBriefSections = (rawText: string): ParsedBriefSection[] => {
    const sections: ParsedBriefSection[] = [];
    const regex = /##\s*([A-Z0-9–\s]+)\n([\s\S]*?)(?=(?:##\s*[A-Z0-9–\s]+\n)|$)/gi;
    let match;
    while ((match = regex.exec(rawText)) !== null) {
      const title = match[1].trim();
      const content = match[2].trim();
      if (title && content) {
        sections.push({ title, content });
      }
    }

    if (sections.length === 0) {
      // Fallback if model used slightly varied markdown
      return [{ title: 'EXECUTIVE BRIEF', content: rawText }];
    }
    return sections;
  };

  const structuredSections = briefing ? parseBriefSections(briefing) : [];

  // IntersectionObserver to hide or reduce prominence of sticky shortcut when Ask HazeLens is in view (Req 2)
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsAskVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    const currentRef = askSectionRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
      observer.disconnect();
    };
  }, []);

  const scrollToAskHazeLens = () => {
    if (askSectionRef.current) {
      askSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => {
        queryInputRef.current?.focus();
      }, 450);
    }
  };

  // Prioritized 5 suggested questions + additional behind "More questions" (Req 4)
  const prioritizedQuestions = [
    `Why is ${selectedCommunity?.locationName || 'Palangka Raya'} at ${selectedCommunity?.now.riskLevel || 'SEVERE'} risk?`,
    'Which community needs the most attention?',
    'What changed since the previous assessment?',
    'What could cause the situation to improve?',
    'What should communities monitor during the next six hours?',
  ];

  const additionalQuestions = [
    'Which source region is driving wildfire pressure?',
    'What evidence supports this recommendation?',
  ];

  const displayedQuestions = showAllQuestions
    ? [...prioritizedQuestions, ...additionalQuestions]
    : prioritizedQuestions;

  return (
    <div className="space-y-6">
      {/* 1. Main Gemini Environmental Intelligence Container (Req 4) */}
      <div className="rounded-xl border border-slate-800 bg-[#090e18] p-5 sm:p-6 shadow-xl space-y-4">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-cyan-400 text-lg leading-none select-none">✦</span>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight font-sans">
                Gemini Environmental Intelligence
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-purple-800/60 bg-purple-950/40 text-purple-300">
                [AI INTERPRETATION]
              </span>
            </div>
            <p className="text-xs text-slate-300 font-medium mt-0.5">
              Evidence-grounded decision brief
            </p>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
              Powered by Gemini · Grounded in observed, forecast and HazeLens-calculated evidence
            </p>
          </div>

          {/* Action Button & Cancel Control (Req 4) */}
          <div className="flex items-center gap-2.5">
            {isGenerating && (
              <button
                type="button"
                onClick={handleCancelAnalysis}
                className="px-3 py-2 text-xs font-mono text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-800/80 rounded-lg bg-slate-900/60 transition-colors cursor-pointer"
              >
                Cancel Analysis
              </button>
            )}
            <button
              onClick={handleGenerateBriefing}
              disabled={isGenerating}
              className={`px-4 py-2.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 shadow-sm shrink-0 border ${
                isGenerating
                  ? 'bg-slate-900 border-cyan-500/50 text-cyan-300'
                  : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 border-cyan-300'
              }`}
            >
              {isGenerating ? (
                <>
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
                  </span>
                  <span className="font-mono">Analyzing Environmental Evidence...</span>
                </>
              ) : (
                <>
                  <span className="text-sm">✦</span>
                  <span>Generate Decision Brief</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Responsible AI Boundary Statement (Req 10) */}
        <div className="px-3.5 py-2 rounded-lg bg-[#070b13] border border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span className="text-cyan-400">🛡️</span>
            <span>
              Gemini explains and synthesizes the evidence. HazeLens deterministic logic calculates the numerical risk score.
            </span>
          </div>
          <span className="text-slate-500 hidden md:inline">Deterministic Boundary Enforced</span>
        </div>

        {/* Friendly Failure, Timeout, or Cancellation Notice (Req 3, 4, 8) */}
        {briefErrorNotice && (
          <div className="p-4 rounded-xl bg-[#0a101f] border border-cyan-900/60 text-xs text-slate-200 space-y-3 shadow-lg animate-fadeIn">
            <div className="flex items-center gap-2 font-semibold text-cyan-300">
              <span className="text-sm">ℹ️</span>
              <span>Notice</span>
            </div>
            <p className="text-slate-300 leading-relaxed font-sans">
              {briefErrorNotice}
            </p>
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleGenerateBriefing}
                className="px-3.5 py-1.5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold rounded-md text-xs cursor-pointer transition-colors shadow-sm"
              >
                Retry Gemini
              </button>
              {onContinueToAssessment && (
                <button
                  type="button"
                  onClick={onContinueToAssessment}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-md text-xs cursor-pointer border border-slate-700 transition-colors"
                >
                  Continue with HazeLens Assessment
                </button>
              )}
            </div>
          </div>
        )}

        {/* 2. Gemini Generation Animation Sequence with Unmistakable AI Processing State (Req 1, 2, 3) */}
        {isGenerating && (
          <div className="p-6 sm:p-7 rounded-xl bg-[#070c16] border border-cyan-500/40 space-y-4 shadow-[0_0_35px_rgba(6,182,212,0.12)] transition-all">
            {/* Clear AI Processing Focal Point with 44-52px Sparkle & Cyan-to-Violet Glow */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
              <div className="relative shrink-0 flex items-center justify-center p-3 rounded-2xl bg-gradient-to-br from-cyan-950/60 to-purple-950/50 border border-cyan-400/50 shadow-[0_0_24px_rgba(56,189,248,0.35)]">
                <GeminiSparkleIcon className="w-12 h-12 animate-[pulse_1.8s_ease-in-out_infinite] drop-shadow-[0_0_14px_rgba(56,189,248,0.7)]" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight font-sans">
                  Gemini is analyzing the environmental evidence
                </h3>
                <p className="text-xs text-cyan-200/90 font-mono">
                  Connecting satellite observations, weather, exposure and deterministic risk signals
                </p>

                {/* Active Status Signal, Real Elapsed Time Counter & Cancel Link (Req 2, 3, 4) */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1 font-mono text-xs">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-500/40 text-cyan-300">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-[pulse_1.5s_ease-in-out_infinite]"></span>
                    <span className="font-semibold">Analysis in progress</span>
                  </div>
                  <span className="text-slate-500">·</span>
                  <span className="text-slate-300 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800 text-[11px]">
                    Analyzing for {elapsedSeconds}s (30s limit)
                  </span>
                  <span className="text-slate-500">·</span>
                  <button
                    type="button"
                    onClick={handleCancelAnalysis}
                    className="text-slate-400 hover:text-rose-300 underline text-[11px] cursor-pointer"
                  >
                    Cancel Analysis
                  </button>
                </div>

                {/* Reassurance Message after ~8 Seconds */}
                {elapsedSeconds >= 8 && (
                  <div className="mt-2 p-2.5 rounded-lg bg-indigo-950/50 border border-indigo-500/40 text-indigo-200 text-xs font-mono flex items-center gap-2 animate-fadeIn shadow-sm">
                    <span className="text-indigo-400 text-sm">⏳</span>
                    <span>Gemini is still working. Complex environmental synthesis can take several seconds.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Visible Progress Bar (3-4px with smooth indeterminate gradient sweep) (Req 3) */}
            <div className="w-full h-1 bg-slate-800/90 rounded-full overflow-hidden relative">
              <div className="h-full bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-400 rounded-full w-full animate-pulse shadow-[0_0_8px_rgba(56,189,248,0.5)]"></div>
            </div>

            {/* Processing Hierarchy (Req 2) */}
            <div className="space-y-2 pt-1">
              <div className="text-[10px] font-mono uppercase text-slate-400 tracking-wider flex items-center justify-between">
                <span>Evidence Preparation & Synthesis Pipeline</span>
                <span className="text-slate-500">Deterministic → Generative</span>
              </div>

              {/* 4 compact completed stages with checkmarks */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#090e18] border border-slate-800/90 text-slate-300">
                  <span className="text-slate-400 truncate text-[11px]">Satellite observations</span>
                  <span className="text-emerald-400 font-bold ml-1.5 shrink-0">✓</span>
                </div>
                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#090e18] border border-slate-800/90 text-slate-300">
                  <span className="text-slate-400 truncate text-[11px]">Weather & transport</span>
                  <span className="text-emerald-400 font-bold ml-1.5 shrink-0">✓</span>
                </div>
                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#090e18] border border-slate-800/90 text-slate-300">
                  <span className="text-slate-400 truncate text-[11px]">Community exposure</span>
                  <span className="text-emerald-400 font-bold ml-1.5 shrink-0">✓</span>
                </div>
                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#090e18] border border-slate-800/90 text-slate-300">
                  <span className="text-slate-400 truncate text-[11px]">Risk drivers</span>
                  <span className="text-emerald-400 font-bold ml-1.5 shrink-0">✓</span>
                </div>
              </div>

              {/* Visually more prominent Gemini synthesis stage */}
              <div className="p-3 rounded-lg bg-gradient-to-r from-cyan-950/40 via-purple-950/30 to-cyan-950/40 border border-cyan-500/50 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-2.5">
                  <span className="text-cyan-400 text-base animate-pulse">✦</span>
                  <div>
                    <span className="text-xs font-bold font-mono text-cyan-200 block">
                      Gemini synthesis
                    </span>
                    <span className="text-[11px] text-slate-400 font-sans">
                      Synthesizing evidence into structured decision brief
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono text-xs font-bold">
                  <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping"></span>
                  <span>Synthesizing evidence</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. Rendered Decision Brief with Exactly 6 Structured Sections (Req 4, 6) */}
        {!isGenerating && briefing && (
          <div className="space-y-4 pt-1 animate-fadeIn">
            {/* Completion Transition Header (Req 4) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-emerald-950/20 border border-emerald-800/50 text-xs font-mono">
              <div className="flex items-center gap-2 text-emerald-300 font-semibold">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-xs">
                  ✓
                </span>
                <span>Gemini Decision Brief Ready</span>
                <span className="text-slate-500 font-normal">·</span>
                <span className="text-[11px] text-purple-300 font-normal">[AI INTERPRETATION — GROUNDED IN EVIDENCE]</span>
              </div>
              {generatedAt && (
                <span className="text-slate-400 text-[11px]">
                  Generated: {formatUtcTime(generatedAt)}
                </span>
              )}
            </div>

            {/* Structured Sections Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {structuredSections.map((sec, idx) => {
                const titleUpper = sec.title.toUpperCase();
                const isAwareness = titleUpper.includes('RECOMMENDED AWARENESS');
                const isHappening = titleUpper.includes('HAPPENING');
                const isWho = titleUpper.includes('WHO NEEDS ATTENTION');

                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border space-y-2 ${
                      isAwareness
                        ? 'md:col-span-2 bg-[#081220] border-cyan-700/60 shadow-lg'
                        : isWho
                        ? 'bg-[#0f0e1a] border-amber-800/50'
                        : isHappening
                        ? 'bg-[#0a101d] border-cyan-900/40'
                        : 'bg-[#070b13] border-slate-800/90'
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-slate-800/70 pb-1.5">
                      <span className="font-mono text-xs font-bold tracking-wider uppercase text-cyan-300 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                        {sec.title}
                      </span>
                      <span className="text-[9px] font-mono text-slate-500">SECTION 0{idx + 1}</span>
                    </div>

                    <FormattedMarkdown content={sec.content} className="text-xs text-slate-200 leading-relaxed font-sans" />

                    {/* Mandatory Responsible Guidance on Awareness Section (Req 7) */}
                    {isAwareness && !sec.content.includes('official local authority guidance') && (
                      <div className="pt-2 border-t border-cyan-900/40 text-[11px] font-mono text-amber-300">
                        Follow official local authority guidance for health, emergency and evacuation decisions.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 4. Evidence Used References (Req 9) */}
            <div className="p-3.5 rounded-lg bg-[#070b13] border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-mono text-slate-400 font-semibold uppercase text-[11px]">
                  Evidence used:
                </span>
                <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
                  {evidenceUsed.map((source, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300"
                    >
                      {source}
                    </span>
                  ))}
                </div>
              </div>

              <div className="text-[10px] font-mono text-slate-500">
                Grounding: Deterministic HazeLens Snapshot
              </div>
            </div>

            {/* Contextual Ask HazeLens CTA after Decision Brief (Req 1) */}
            <div className="p-4 rounded-xl border border-cyan-800/50 bg-gradient-to-r from-cyan-950/30 via-[#0a1120] to-purple-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-cyan-400 text-xs select-none">✦</span>
                  <h4 className="text-xs sm:text-sm font-bold text-white font-sans">
                    Want to understand this assessment further?
                  </h4>
                </div>
                <p className="text-xs text-slate-400 font-sans">
                  Ask Gemini about the evidence, risk drivers, or what may change next.
                </p>
              </div>

              <button
                onClick={scrollToAskHazeLens}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 hover:border-cyan-300 transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(34,211,238,0.15)] self-start sm:self-auto group"
              >
                <span>Ask HazeLens</span>
                <span className="text-sm font-bold group-hover:translate-x-0.5 transition-transform">→</span>
              </button>
            </div>
          </div>
        )}

        {/* Empty placeholder state */}
        {!isGenerating && !briefing && !briefErrorNotice && (
          <div className="p-8 text-center border border-dashed border-slate-800 rounded-lg bg-[#070b13] space-y-2">
            <span className="text-2xl text-cyan-400">✦</span>
            <p className="text-slate-300 text-xs font-medium">No decision brief generated for the current session.</p>
            <p className="text-[11px] text-slate-500 max-w-lg mx-auto">
              Click &quot;Generate Decision Brief&quot; to synthesize current NASA FIRMS detections, Copernicus air quality, and atmospheric transport vectors into structured decision intelligence.
            </p>
          </div>
        )}
      </div>

      {/* 2. Strengthened ✦ Ask HazeLens Interactive Section (Req 3, 4) */}
      <div
        ref={askSectionRef}
        id="ask-hazelens-section"
        className="rounded-xl border border-slate-800 bg-[#090e18] p-5 sm:p-6 shadow-xl space-y-4 scroll-mt-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-cyan-400 text-sm">✦</span>
              <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wide">
                Ask HazeLens
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-purple-800/60 bg-purple-950/40 text-purple-300">
                [AI INTERPRETATION]
              </span>
            </div>
            <p className="text-xs text-slate-300 font-medium mt-0.5">
              Ask Gemini about the evidence behind the current assessment.
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5 font-sans">
              Explore why the risk changed, which evidence matters most, and what to monitor next.
            </p>
          </div>

          <div className="text-xs font-mono text-slate-400 bg-[#070b13] border border-slate-800 px-2.5 py-1 rounded">
            Focused Community: <span className="text-cyan-300 font-semibold">{selectedCommunity?.locationName}</span>
          </div>
        </div>

        {/* Suggested Follow-up Questions (Req 4) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase text-slate-400 font-semibold tracking-wider">
              Suggested follow-up questions
            </span>
            {additionalQuestions.length > 0 && (
              <button
                onClick={() => setShowAllQuestions(!showAllQuestions)}
                className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer flex items-center gap-1"
              >
                <span>{showAllQuestions ? 'Fewer questions' : 'More questions'}</span>
                <span className="text-[9px]">{showAllQuestions ? '▲' : '▼'}</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {displayedQuestions.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSendQuery(prompt)}
                disabled={isQuerying}
                className="px-3 py-1.5 text-xs text-slate-300 bg-[#070b13] border border-slate-800 hover:border-cyan-500/50 hover:text-white hover:bg-slate-900/60 rounded-lg transition-all cursor-pointer text-left font-sans flex items-center gap-1.5 shadow-sm"
              >
                <span className="text-cyan-400/80 text-[10px]">✦</span>
                <span>{prompt}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Query Input with ref */}
        <div className="flex gap-2">
          <input
            ref={queryInputRef}
            type="text"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendQuery()}
            placeholder="Ask about wildfire pressure, transport direction, or health guidance..."
            className="flex-1 px-4 py-2.5 text-xs bg-[#070b13] border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 font-sans"
          />
          <button
            onClick={() => handleSendQuery()}
            disabled={isQuerying || !queryInput.trim()}
            className="px-4 py-2.5 text-xs font-semibold text-slate-900 bg-cyan-400 rounded-lg hover:bg-cyan-300 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            {isQuerying ? 'Querying...' : 'Ask Gemini'}
          </button>
        </div>

        {/* Query Error Notice */}
        {queryError && (
          <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-800/80 text-xs text-rose-300 font-mono">
            ⚠️ {queryError}
          </div>
        )}

        {/* Active Query Processing Feedback */}
        {isQuerying && (
          <div className="p-3.5 rounded-lg border border-cyan-800/60 bg-[#070f1e] flex items-center justify-between text-xs font-mono text-cyan-300 animate-pulse shadow-md">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
              <span className="font-semibold">Gemini is synthesizing answer from environmental evidence...</span>
            </div>
            <span className="text-[10px] text-slate-400 font-sans hidden sm:inline">Grounding in NASA FIRMS & telemetry</span>
          </div>
        )}

        {/* Q&A Stream */}
        {qaHistory.length > 0 && (
          <div className="space-y-3 pt-2">
            {qaHistory.map((item, idx) => (
              <div key={idx} className="p-4 rounded-lg border border-slate-800 bg-[#070b13] space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-cyan-300 border-b border-slate-800/60 pb-1.5">
                  <span className="flex items-center gap-1.5">
                    <span className="text-slate-500">Q:</span>
                    <span>{item.q}</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">{item.time}</span>
                </div>
                <FormattedMarkdown content={item.a} className="text-xs text-slate-200 leading-relaxed pt-1 font-sans" />
                <div className="pt-2 border-t border-slate-800/50 flex items-center justify-between text-[10px] font-mono text-slate-500">
                  <span>Grounded strictly in HazeLens telemetry</span>
                  <span className="text-purple-400">[AI INTERPRETATION]</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sticky Ask HazeLens Shortcut (Req 2) */}
      <div
        className={`fixed bottom-6 right-6 z-40 transition-all duration-300 ${
          isAskVisible ? 'opacity-0 pointer-events-none translate-y-3' : 'opacity-100 translate-y-0'
        }`}
      >
        <button
          onClick={scrollToAskHazeLens}
          title="Jump to Ask HazeLens"
          className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#080e1a]/95 hover:bg-[#0c1424] backdrop-blur-md border border-cyan-500/50 hover:border-cyan-400 text-cyan-300 hover:text-cyan-200 text-xs font-mono font-medium shadow-[0_4px_20px_rgba(34,211,238,0.25)] transition-all cursor-pointer group"
        >
          <span className="text-cyan-400 text-xs group-hover:scale-110 transition-transform">✦</span>
          <span className="font-sans font-semibold">Ask HazeLens</span>
          <span className="text-slate-500 text-[10px]">↓</span>
        </button>
      </div>
    </div>
  );
}
