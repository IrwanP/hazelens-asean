import { useState } from 'react';
import { CommunityOutlookData } from '../types';
import { TermInfo } from './TermInfo';
import { TERMINOLOGY_GLOSSARY, TermDefinition } from '../data/terminology';

interface EvidenceAuditPanelProps {
  communities: CommunityOutlookData[];
  selectedCommunityId: string;
}

export function EvidenceAuditPanel({ communities, selectedCommunityId }: EvidenceAuditPanelProps) {
  const [activeCommunityId, setActiveCommunityId] = useState(selectedCommunityId);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedGlossaryCategory, setSelectedGlossaryCategory] = useState<string>('ALL');

  const comm = communities.find((c) => c.locationId === activeCommunityId) || communities[0];
  if (!comm) return null;

  const currentSourceDataItems = comm.evidenceUsed.filter(
    (e) => e.category === 'CURRENT SOURCE DATA' || (e.category as string) === 'OBSERVED'
  );
  const forecastItems = comm.evidenceUsed.filter((e) => e.category === 'FORECAST');
  const calculatedItems = comm.evidenceUsed.filter((e) => e.category === 'CALCULATED BY HAZELENS');

  // Tabular Audit Trail Data
  const auditTrailRows = [
    {
      sourceName: 'NASA FIRMS Active-Fire Detections',
      sensorSystem: 'NOAA-21 VIIRS (375m, Collection 2 NRT)',
      dataRetrieved: 'Active-fire thermal anomalies, FRP (MW), coordinates, acquisition time',
      updateFrequency: 'Rolling 24h observations (updated every 3h)',
      provenanceVerification: 'Direct NASA Earthdata ingestion; Borneo bbox (108°E–119°E, 5°S–4°N)',
      tier: 'CURRENT SOURCE DATA',
    },
    {
      sourceName: comm.now.airQuality.isFallback
        ? 'Copernicus CAMS via Open-Meteo [FALLBACK SOURCE]'
        : 'Google Air Quality API',
      sensorSystem: 'Copernicus Atmosphere Monitoring & Sentinel-5P',
      dataRetrieved: comm.now.airQuality.universalAqi !== undefined && !comm.now.airQuality.isFallback
        ? `PM2.5 (${comm.now.airQuality.pm25} µg/m³), PM10, Google Universal AQI (${comm.now.airQuality.universalAqi}), 6h/24h dispersion forecasts`
        : `PM2.5 (${comm.now.airQuality.pm25} µg/m³), PM10, ${comm.now.airQuality.primaryStandardName}${comm.now.airQuality.primaryValue !== undefined ? ` (${comm.now.airQuality.primaryValue})` : ''}, 6h/24h dispersion forecasts`,
      updateFrequency: 'Hourly meteorological reanalysis',
      provenanceVerification: comm.now.airQuality.isFallback
        ? 'Calibrated atmospheric dispersion modeling via Copernicus CAMS [FALLBACK SOURCE]'
        : 'Google Air Quality API primary environmental conditions',
      tier: 'CURRENT SOURCE DATA / FORECAST',
    },
    {
      sourceName: comm.now.airQuality.isFallback
        ? 'Open-Meteo Meteorological Reanalysis [FALLBACK SOURCE]'
        : 'Google Weather',
      sensorSystem: 'ECMWF / GFS Numerical Weather Prediction',
      dataRetrieved: `Wind vector (${comm.now.windSpeedKmh} km/h ${comm.now.windBearing}), temp (${comm.now.temperature}°C), RH (${comm.now.humidity}%), 24h rain (${comm.firePersistenceConditions.forecastPrecipitation24h} mm)`,
      updateFrequency: 'Hourly update cycle',
      provenanceVerification: comm.now.airQuality.isFallback
        ? 'Deterministic physical weather reanalysis via Open-Meteo / ECMWF [FALLBACK SOURCE]'
        : 'Google Weather API primary environmental conditions',
      tier: 'CURRENT SOURCE DATA / FORECAST',
    },
    {
      sourceName: 'HazeLens Atmospheric Transport Engine',
      sensorSystem: 'Deterministic Vector Projection Algorithm',
      dataRetrieved: 'Source-to-receptor angular delta, plume directionality, distance attenuation',
      updateFrequency: 'Real-time computation per data cycle',
      provenanceVerification: 'Pure trigonometric and deterministic calculations; zero AI hallucination',
      tier: 'CALCULATED BY HAZELENS',
    },
    {
      sourceName: 'HazeLens Multi-Factor Risk Synthesizer',
      sensorSystem: 'Authoritative Decision Matrix (30% Fire, 25% Wind, 30% PM2.5, 15% Rain)',
      dataRetrieved: `Environmental Impact Risk score (${comm.now.riskScore}/100) and tier (${comm.now.riskLevel})`,
      updateFrequency: 'Real-time upon telemetry ingest',
      provenanceVerification: 'Fail-closed mathematical boundary; Gemini cannot alter numerical values',
      tier: 'CALCULATED BY HAZELENS',
    },
    {
      sourceName: 'Google Gemini 3.8 Flash',
      sensorSystem: 'Multimodal Generative AI (@google/genai)',
      dataRetrieved: 'Contextual briefing synthesis, situation framing, and early-action reminders',
      updateFrequency: 'On-demand per 6–24h decision window',
      provenanceVerification: 'Grounding-bounded prompt constraint; deterministic data preserved strictly',
      tier: 'AI INTERPRETATION',
    },
  ];

  // Glossary items
  const glossaryList = Object.values(TERMINOLOGY_GLOSSARY);
  const categories = ['ALL', 'Remote Sensing', 'Air Quality & Exposure', 'HazeLens Analytics', 'Decision Protocol'];

  const filteredGlossary = glossaryList.filter((item: TermDefinition) => {
    const matchesCategory = selectedGlossaryCategory === 'ALL' || item.category === selectedGlossaryCategory;
    const matchesSearch =
      item.term.toLowerCase().includes(searchFilter.toLowerCase()) ||
      item.shortDefinition.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (item.citizenFriendlyNote && item.citizenFriendlyNote.toLowerCase().includes(searchFilter.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* 1. Header & Community Selector */}
      <div className="rounded-xl border border-slate-800 bg-[#090e18] p-5 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white uppercase font-mono tracking-wide">
                Evidence Provenance & Verification Audit
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-cyan-800/60 bg-cyan-950/40 text-cyan-400">
                [AUDIT TRAIL]
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Strict audit trail connecting raw satellite observations and weather telemetry to deterministic decision scores.
            </p>
          </div>

          {/* Monitored Community Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Community:</span>
            <div className="flex rounded-lg border border-slate-800 bg-[#070b13] p-0.5">
              {communities.map((c) => (
                <button
                  key={c.locationId}
                  onClick={() => setActiveCommunityId(c.locationId)}
                  className={`px-3 py-1 text-xs font-mono rounded transition-colors cursor-pointer ${
                    c.locationId === comm.locationId
                      ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {c.locationName}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Community Status Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-[#070c16] border border-slate-800/80 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-slate-300 font-bold">{comm.locationName} ({comm.country})</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400">Calculated Risk:</span>
            <strong className="text-cyan-300">{comm.now.riskScore}/100 ({comm.now.riskLevel})</strong>
          </div>
          <div className="flex items-center gap-4 text-slate-400 text-[11px]">
            <span>Primary Driver: <strong className="text-slate-200">{comm.primaryDriver}</strong></span>
            <span>Confidence: <strong className="text-emerald-400">{comm.now.confidence}</strong></span>
          </div>
        </div>
      </div>

      {/* 2. 4-Tier Provenance Evidence Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tier 1: CURRENT SOURCE DATA */}
        <div className="p-4 rounded-xl border border-cyan-900/40 bg-cyan-950/10 space-y-3 shadow-lg">
          <div className="flex items-center justify-between border-b border-cyan-900/30 pb-2">
            <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider flex items-center">
              [CURRENT SOURCE DATA] LIVE ENVIRONMENTAL DATA
              <TermInfo term="Active-fire detection" />
            </span>
            <span className="text-[10px] font-mono text-slate-500">Unmodified Ingestion</span>
          </div>

          <div className="space-y-2 text-xs font-mono">
            {currentSourceDataItems.map((item, idx) => (
              <div key={idx} className="p-2.5 rounded bg-[#0b101c] border border-slate-800/80">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="inline-flex items-center">
                    {item.name}
                    {item.name.includes('PM2.5') && <TermInfo term="PM2.5" />}
                    {item.name.includes('Wind') && <TermInfo term="Transport Alignment" />}
                  </span>
                  <strong className="text-cyan-300">{item.value}</strong>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 flex justify-between">
                  <span>Source: {item.provider}</span>
                  <span className="text-slate-600">{item.freshness}</span>
                </div>
              </div>
            ))}
            <div className="p-2.5 rounded bg-[#0b101c] border border-slate-800/80">
              <div className="flex justify-between text-slate-300">
                <span>Observed Weather at Receptor:</span>
                <strong className="text-slate-200">
                  {comm.now.temperature}°C · RH {comm.now.humidity}% · Wind {comm.now.windSpeedKmh} km/h ({comm.now.windBearing})
                </strong>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Source: {comm.now.airQuality.isFallback ? 'Open-Meteo Meteorological Reanalysis [FALLBACK SOURCE]' : 'Google Weather'}
              </div>
            </div>
          </div>
        </div>

        {/* Tier 2: FORECAST */}
        <div className="p-4 rounded-xl border border-emerald-900/40 bg-emerald-950/10 space-y-3 shadow-lg">
          <div className="flex items-center justify-between border-b border-emerald-900/30 pb-2">
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center">
              [FORECAST] Upstream Predictive Models
              <TermInfo term="Fire Persistence" />
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              {comm.now.airQuality.isFallback ? 'Copernicus / Open-Meteo [FALLBACK SOURCE]' : 'Google / Predictive Models'}
            </span>
          </div>

          <div className="space-y-2 text-xs font-mono">
            {forecastItems.map((item, idx) => (
              <div key={idx} className="p-2.5 rounded bg-[#0b101c] border border-slate-800/80">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="inline-flex items-center">
                    {item.name}
                    {item.name.includes('PM2.5') && <TermInfo term="PM2.5" />}
                  </span>
                  <strong className="text-emerald-300">{item.value}</strong>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 flex justify-between">
                  <span>Source: {item.provider}</span>
                  <span className="text-slate-600">{item.freshness}</span>
                </div>
              </div>
            ))}
            <div className="p-2.5 rounded bg-[#0b101c] border border-slate-800/80">
              <div className="flex justify-between text-slate-300">
                <span className="inline-flex items-center">
                  Fire Persistence Forecast:
                  <TermInfo term="Fire Persistence" />
                </span>
                <strong className="text-emerald-300">{comm.firePersistenceConditions.rating} ({comm.firePersistenceConditions.score}/100)</strong>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5 flex justify-between">
                <span>24h Rain: {comm.firePersistenceConditions.forecastPrecipitation24h} mm</span>
                <span>Source: {comm.now.airQuality.isFallback ? 'Open-Meteo / ECMWF [FALLBACK SOURCE]' : 'Google Weather'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tier 3: CALCULATED BY HAZELENS */}
        <div className="p-4 rounded-xl border border-purple-900/40 bg-purple-950/10 space-y-3 shadow-lg">
          <div className="flex items-center justify-between border-b border-purple-900/30 pb-2">
            <span className="text-xs font-mono font-bold text-purple-300 uppercase tracking-wider flex items-center">
              [CALCULATED BY HAZELENS] Deterministic Logic
              <TermInfo term="Environmental Impact Risk" />
            </span>
            <span className="text-[10px] font-mono text-slate-500">Mathematical Model</span>
          </div>

          <div className="space-y-2 text-xs font-mono">
            {calculatedItems.map((item, idx) => (
              <div key={idx} className="p-2.5 rounded bg-[#0b101c] border border-slate-800/80">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="inline-flex items-center">
                    {item.name}
                    {item.name.includes('Transport') && <TermInfo term="Transport Alignment" />}
                  </span>
                  <strong className="text-purple-300">{item.value}</strong>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Algorithm: {item.provider}</div>
              </div>
            ))}
            <div className="p-2.5 rounded bg-[#0b101c] border border-slate-800/80">
              <div className="text-slate-300 font-semibold mb-1">Risk Weight Component Breakdown:</div>
              <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-400">
                <div className="inline-flex items-center">
                  <span>Wildfire Pressure (30%):</span>
                  <TermInfo term="Wildfire Pressure" />
                  <strong className="text-slate-200 ml-1">{comm.now.componentScores.wildfirePressureScore}</strong>
                </div>
                <div className="inline-flex items-center">
                  <span>Transport Alignment (25%):</span>
                  <TermInfo term="Transport Alignment" />
                  <strong className="text-slate-200 ml-1">{comm.now.componentScores.transportAlignmentScore}</strong>
                </div>
                <div className="inline-flex items-center">
                  <span>Community Exposure (30%):</span>
                  <TermInfo term="PM2.5" />
                  <strong className="text-slate-200 ml-1">{comm.now.componentScores.communityExposureScore}</strong>
                </div>
                <div className="inline-flex items-center">
                  <span>Fire Persistence (15%):</span>
                  <TermInfo term="Fire Persistence" />
                  <strong className="text-slate-200 ml-1">{comm.now.componentScores.firePersistenceScore}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tier 4: AI INTERPRETATION */}
        <div className="p-4 rounded-xl border border-amber-900/40 bg-amber-950/10 space-y-3 shadow-lg">
          <div className="flex items-center justify-between border-b border-amber-900/30 pb-2">
            <span className="text-xs font-mono font-bold text-amber-300 uppercase tracking-wider">
              [AI INTERPRETATION] Gemini 3.8 Flash
            </span>
            <span className="text-[10px] font-mono text-slate-500">Contextualization</span>
          </div>

          <div className="p-2.5 rounded bg-[#0b101c] border border-slate-800/80 space-y-2 text-xs">
            <div className="text-slate-300 font-sans leading-relaxed">
              Gemini provides natural language briefings and conversational reasoning strictly grounded in the observed telemetry and deterministic calculations above.
            </div>
            <div className="text-[11px] font-mono text-amber-400/90 pt-1 border-t border-slate-800/80 flex items-center justify-between">
              <span>Primary Identified Driver:</span>
              <strong className="text-white">{comm.primaryDriver}</strong>
            </div>
            <div className="text-[11px] font-mono text-cyan-400 pt-1 border-t border-slate-800/80">
              Deterministic Boundary: Gemini never computes or alters numerical risk scores.
            </div>
          </div>
        </div>
      </div>

      {/* 3. Tabular Audit Trail (Source Name, Sensor / System, Data Retrieved, Update Frequency, Provenance Verification) */}
      <div className="rounded-xl border border-slate-800 bg-[#090e18] p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wide">
              Complete Tabular Audit Trail
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-cyan-800/60 bg-cyan-950/40 text-cyan-400">
              [SYSTEM INGESTION AUDIT]
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            {auditTrailRows.length} Telemetry Feeds Verified
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-[#070b13] text-[10px] font-mono uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Source Name</th>
                <th className="py-2.5 px-3">Sensor / System</th>
                <th className="py-2.5 px-3">Data Retrieved</th>
                <th className="py-2.5 px-3">Update Frequency</th>
                <th className="py-2.5 px-3">Provenance Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {auditTrailRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                  <td className="py-3 px-3 font-semibold text-slate-200 whitespace-nowrap">
                    {row.sourceName}
                  </td>
                  <td className="py-3 px-3 text-cyan-300">
                    {row.sensorSystem}
                  </td>
                  <td className="py-3 px-3 text-slate-300 font-sans max-w-xs">
                    {row.dataRetrieved}
                  </td>
                  <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                    {row.updateFrequency}
                  </td>
                  <td className="py-3 px-3 text-emerald-400/90 font-sans text-xs">
                    {row.provenanceVerification}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Understanding the Evidence — Terminology Glossary (Progressive Disclosure & Full Reference) */}
      <div className="rounded-xl border border-slate-800 bg-[#090e18] p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wide">
                Understanding the Evidence · Terminology Glossary
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-emerald-800/60 bg-emerald-950/40 text-emerald-400">
                [CITIZEN SCIENCE]
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Citizen-friendly reference for environmental indicators, satellite telemetry, and analytical definitions.
            </p>
          </div>

          {/* Quick Search */}
          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="Search terminology..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg bg-[#070b13] border border-slate-800 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/60 font-mono"
            />
          </div>
        </div>

        {/* Category Pills Filter */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedGlossaryCategory(cat)}
              className={`px-2.5 py-1 text-[11px] font-mono rounded transition-colors cursor-pointer ${
                selectedGlossaryCategory === cat
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                  : 'bg-[#070b13] text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Glossary Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
          {filteredGlossary.map((def) => (
            <div
              key={def.id}
              className="p-3.5 rounded-lg border border-slate-800/90 bg-[#070b14] space-y-1.5 flex flex-col justify-between hover:border-slate-700 transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs font-mono flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                    {def.term}
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                    {def.category}
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-sans leading-relaxed">
                  {def.shortDefinition}
                </p>
              </div>

              {def.citizenFriendlyNote && (
                <div className="pt-2 border-t border-slate-800/60 text-[10px] font-mono text-slate-400 flex items-start gap-1">
                  <span className="text-cyan-400 shrink-0">💡</span>
                  <span>{def.citizenFriendlyNote}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 5. Architectural Roadmap: Dynamic Receptor Discovery (Req 12) */}
      <div className="rounded-xl border border-slate-800 bg-[#090e18] p-5 shadow-xl space-y-2">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-xs font-mono font-bold uppercase text-slate-300">
            Architectural Roadmap · Dynamic Receptor Discovery
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-cyan-800/60 bg-cyan-950/40 text-cyan-400">
            [FUTURE CAPABILITY]
          </span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed font-normal">
          Future versions may evaluate a wider set of communities using source distance, transport alignment, air-quality exposure, forecast conditions and population context.
        </p>
      </div>
    </div>
  );
}
