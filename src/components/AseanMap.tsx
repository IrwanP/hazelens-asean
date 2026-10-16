import { useEffect, useRef, useState } from 'react';
import { FireDetection, CommunityOutlookData, SourceCluster, sortCommunitiesByRisk } from '../types';
import { useGoogleMaps } from '../context/GoogleMapsContext';
import { TermInfo } from './TermInfo';

/**
 * Canonical HazeLens Risk Tier to Color Mapping:
 * - SEVERE:   #ef4444 (Red)
 * - HIGH:     #f97316 (Orange)
 * - MODERATE: #f59e0b (Amber / Yellow)
 * - LOW:      #10b981 (Emerald Green)
 */
export function getCommunityRiskColor(riskLevel?: string): string {
  switch (riskLevel) {
    case 'SEVERE':
      return '#ef4444';
    case 'HIGH':
      return '#f97316';
    case 'MODERATE':
      return '#f59e0b';
    case 'LOW':
    default:
      return '#10b981';
  }
}

/**
 * CommunityMarkerIcon: Reuses the exact downward-pointing BACKWARD_CLOSED_ARROW
 * SVG symbol used on the Google Map overlays for community markers.
 * Derived from Google Maps JS API SymbolPath.BACKWARD_CLOSED_ARROW (path: "M 0,0 -1.9,-4.5 0,-3.4 1.9,-4.5 z").
 *
 * Semantic styling:
 * - Fill: Current deterministic Environmental Impact Risk tier
 * - Stroke: Cyan (#38bdf8) when focused/selected, neutral dark (#080c14) when non-focused
 */
export function CommunityMarkerIcon({
  color = '#ef4444',
  stroke = '#080c14',
  strokeWidth = 0.5,
  size = 16,
  className = 'inline-block shrink-0 align-middle',
  isFocused = false,
}: {
  color?: string;
  stroke?: string;
  strokeWidth?: number;
  size?: number;
  className?: string;
  isFocused?: boolean;
}) {
  const width = Math.round(size * (5.0 / 5.6));
  const effectiveStroke = isFocused ? '#38bdf8' : stroke;
  const effectiveStrokeWidth = isFocused ? 0.8 : strokeWidth;

  return (
    <svg
      width={width}
      height={size}
      viewBox="-2.5 -5.1 5.0 5.6"
      fill={color}
      stroke={effectiveStroke}
      strokeWidth={effectiveStrokeWidth}
      strokeLinejoin="round"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M 0,0 L -1.9,-4.5 L 0,-3.4 L 1.9,-4.5 Z" />
    </svg>
  );
}

interface AseanMapProps {
  fires: FireDetection[];
  clusters: SourceCluster[];
  communities: CommunityOutlookData[];
  selectedCommunityId: string;
  onSelectCommunity: (id: string) => void;
  selectedClusterId?: string | null;
  onSelectCluster?: (id: string) => void;
  isVisible?: boolean;
}

export function AseanMap({
  fires,
  clusters,
  communities,
  selectedCommunityId,
  onSelectCommunity,
  selectedClusterId,
  onSelectCluster,
  isVisible = true,
}: AseanMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);

  const { isLoaded, isLoading, error } = useGoogleMaps();

  // Switch requirement: "High Significance Only"
  const [highSignificanceOnly, setHighSignificanceOnly] = useState<boolean>(false);
  const [showTransportVectors, setShowTransportVectors] = useState<boolean>(true);

  // Selected Cluster popup state
  const [activePopupCluster, setActivePopupCluster] = useState<SourceCluster | null>(null);

  // Focus and pan to selected cluster when selectedClusterId updates
  useEffect(() => {
    if (selectedClusterId && clusters.length > 0) {
      const targetCluster = clusters.find((c) => c.id === selectedClusterId);
      if (targetCluster) {
        setActivePopupCluster(targetCluster);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo({
            lat: targetCluster.centroid.lat,
            lng: targetCluster.centroid.lon,
          });
        }
      }
    }
  }, [selectedClusterId, clusters]);

  // Initialize or re-attach Google Maps JavaScript API instance
  useEffect(() => {
    if (!isLoaded || !(window as any).google?.maps || !mapContainerRef.current) return;

    const google = (window as any).google;

    if (!mapInstanceRef.current) {
      // Center on maritime Southeast Asia (Borneo, Peninsular Malaysia, Singapore, Sumatra)
      const map = new google.maps.Map(mapContainerRef.current, {
        center: { lat: 0.2, lng: 109.5 },
        zoom: 6,
        minZoom: 4,
        maxZoom: 13,
        mapTypeId: 'terrain',
        streetViewControl: false,
        mapTypeControl: true,
        fullscreenControl: true,
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#0d131f' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#090e18' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
          {
            featureType: 'administrative.country',
            elementType: 'geometry.stroke',
            stylers: [{ color: '#334155' }, { weight: 1.5 }],
          },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#060a12' }] },
          { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#38bdf8' }] },
          { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#111827' }] },
        ],
      });

      mapInstanceRef.current = map;

      // Initial resize trigger to ensure taller desktop dimensions (min-height 640px) are fully recognized
      setTimeout(() => {
        if (mapInstanceRef.current && google.maps) {
          google.maps.event.trigger(mapInstanceRef.current, 'resize');
          mapInstanceRef.current.setCenter({ lat: 0.2, lng: 109.5 });
          mapInstanceRef.current.setZoom(6);
        }
      }, 100);
    } else {
      // Trigger resize in case container dimensions changed or was hidden
      google.maps.event.trigger(mapInstanceRef.current, 'resize');
    }
  }, [isLoaded]);

  // Window resize handler: preserves map center and zoom while ensuring Google Maps canvas recalculates layout
  useEffect(() => {
    const handleResize = () => {
      if (mapInstanceRef.current && (window as any).google?.maps) {
        const google = (window as any).google;
        const currentCenter = mapInstanceRef.current.getCenter() || { lat: 0.2, lng: 109.5 };
        const currentZoom = mapInstanceRef.current.getZoom() || 6;
        google.maps.event.trigger(mapInstanceRef.current, 'resize');
        mapInstanceRef.current.setCenter(currentCenter);
        mapInstanceRef.current.setZoom(currentZoom);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Trigger resize when map container visibility is restored
  useEffect(() => {
    if (isVisible && mapInstanceRef.current && (window as any).google?.maps) {
      setTimeout(() => {
        if (mapInstanceRef.current && (window as any).google?.maps) {
          (window as any).google.maps.event.trigger(mapInstanceRef.current, 'resize');
          mapInstanceRef.current.setCenter({ lat: 0.2, lng: 109.5 });
          mapInstanceRef.current.setZoom(6);
        }
      }, 50);
    }
  }, [isVisible]);

  // Update Overlays: NASA FIRMS detection markers, Source Cluster centroids, Community markers, Transport vectors
  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current || !(window as any).google?.maps) return;
    const google = (window as any).google;
    const map = mapInstanceRef.current;

    // Clear previous overlays
    overlaysRef.current.forEach((item) => item.setMap(null));
    overlaysRef.current = [];

    // Filter fires based on High Significance Only switch (high confidence or FRP >= 15 MW)
    const displayedFires = highSignificanceOnly
      ? fires.filter((f) => f.confidence === 'high' || f.frp >= 15)
      : fires;

    // 1. Overlay NASA FIRMS Active Fire Detections
    // Marker Hierarchy:
    // - small orange = nominal FIRMS detection
    // - red = high-confidence or high-FRP detection
    // - larger circles = stronger FRP
    displayedFires.forEach((fire) => {
      const isHighSignificance = fire.confidence === 'high' || fire.frp >= 20;

      const fillColor = isHighSignificance ? '#ef4444' : '#f97316';
      const strokeColor = isHighSignificance ? '#b91c1c' : '#c2410c';
      const fillOpacity = isHighSignificance ? 0.85 : 0.6;

      // Circle radius proportional to FRP (meters)
      const radiusMeters = Math.min(Math.max(fire.frp * 220, 2500), 28000);

      const circle = new google.maps.Circle({
        strokeColor,
        strokeOpacity: 0.8,
        strokeWeight: 1,
        fillColor,
        fillOpacity,
        map,
        center: { lat: fire.latitude, lng: fire.longitude },
        radius: radiusMeters,
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="color: #0f172a; font-family: system-ui; font-size: 11px; padding: 4px;">
            <strong style="color: #b91c1c;">NASA FIRMS Thermal Detection</strong><br/>
            <strong>Coordinates:</strong> ${fire.latitude.toFixed(4)}°, ${fire.longitude.toFixed(4)}°<br/>
            <strong>Confidence:</strong> ${fire.confidence.toUpperCase()}<br/>
            <strong>Fire Radiative Power:</strong> ${fire.frp} MW<br/>
            <strong>Acquired:</strong> ${fire.acqDate} ${fire.acqTime} UTC<br/>
            <span style="font-size: 9px; color: #64748b;">[OBSERVED SATELLITE PIXEL]</span>
          </div>
        `,
      });

      circle.addListener('click', () => {
        infoWindow.setPosition({ lat: fire.latitude, lng: fire.longitude });
        infoWindow.open(map);
      });

      overlaysRef.current.push(circle);
    });

    // 2. Overlay Source Cluster Centroid Markers
    clusters.forEach((cl) => {
      const isClusterSelected = cl.id === selectedClusterId;
      const pressureColor =
        cl.wildfirePressure === 'VERY HIGH'
          ? '#e11d48'
          : cl.wildfirePressure === 'HIGH'
          ? '#ea580c'
          : cl.wildfirePressure === 'MODERATE'
          ? '#d97706'
          : '#059669';

      const clusterMarker = new google.maps.Marker({
        position: { lat: cl.centroid.lat, lng: cl.centroid.lon },
        map,
        title: `${cl.name} (${cl.wildfirePressure} Pressure)`,
        label: {
          text: `🔥 ${cl.detectionCount}`,
          color: '#ffffff',
          fontSize: '11px',
          fontWeight: 'bold',
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: isClusterSelected ? 16 : 13,
          fillColor: pressureColor,
          fillOpacity: 0.9,
          strokeColor: '#ffffff',
          strokeWeight: isClusterSelected ? 2.5 : 1.5,
        },
      });

      clusterMarker.addListener('click', () => {
        setActivePopupCluster(cl);
        if (onSelectCluster) onSelectCluster(cl.id);
      });

      overlaysRef.current.push(clusterMarker);
    });

    // 3. Overlay Community Markers (Palangka Raya, Kuching, Singapore)
    communities.forEach((comm) => {
      const isSelected = comm.locationId === selectedCommunityId;
      const riskColor = getCommunityRiskColor(comm.now.riskLevel);

      const communityMarker = new google.maps.Marker({
        position: { lat: comm.coordinates.lat, lng: comm.coordinates.lon },
        map,
        title: `${comm.locationName} (${comm.now.riskLevel} Risk)`,
        label: {
          text: comm.locationName,
          color: isSelected ? '#38bdf8' : '#ffffff',
          fontSize: isSelected ? '13px' : '11px',
          fontWeight: 'bold',
        },
        icon: {
          path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
          scale: isSelected ? 8 : 6.5,
          fillColor: riskColor,
          fillOpacity: 1,
          strokeColor: isSelected ? '#38bdf8' : '#080c14',
          strokeWeight: isSelected ? 2.5 : 1.5,
        },
      });

      communityMarker.addListener('click', () => {
        onSelectCommunity(comm.locationId);
      });

      overlaysRef.current.push(communityMarker);

      // 4. Transport Alignment Indicator Vector
      if (showTransportVectors && comm.dominantAlignment && comm.dominantAlignment.alignmentLevel !== 'LOW') {
        const driftRad = (((comm.now.windDirectionDeg + 180) % 360) * Math.PI) / 180;
        const vectorKm = Math.min(Math.max(comm.now.windSpeedKmh * 4.0, 40), 140);

        const destLat = comm.coordinates.lat + (vectorKm * Math.cos(driftRad)) / 111;
        const destLng =
          comm.coordinates.lon +
          (vectorKm * Math.sin(driftRad)) / (111 * Math.cos((comm.coordinates.lat * Math.PI) / 180));

        const vectorLine = new google.maps.Polyline({
          path: [
            { lat: comm.coordinates.lat, lng: comm.coordinates.lon },
            { lat: destLat, lng: destLng },
          ],
          geodesic: true,
          strokeColor: '#06b6d4',
          strokeOpacity: 0.85,
          strokeWeight: 2,
          icons: [
            {
              icon: {
                path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                scale: 2.5,
                fillColor: '#06b6d4',
                fillOpacity: 1,
                strokeColor: '#080c14',
              },
              offset: '100%',
            },
          ],
          map,
        });

        overlaysRef.current.push(vectorLine);
      }
    });
  }, [
    isLoaded,
    fires,
    clusters,
    communities,
    selectedCommunityId,
    selectedClusterId,
    highSignificanceOnly,
    showTransportVectors,
    onSelectCommunity,
    onSelectCluster,
  ]);

  return (
    <div id="regional-evidence-map" className="rounded-xl border border-slate-800 bg-[#070b12] overflow-hidden shadow-2xl flex flex-col">
      {/* Map Control Bar & Switch */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 border-b border-slate-800 bg-[#090e18] text-xs gap-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">Regional Evidence Map</span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-400 font-mono inline-flex items-center">
            NASA FIRMS Active Fires
            <TermInfo term="NASA FIRMS" />
          </span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-400 font-mono inline-flex items-center">
            Transport Alignment
            <TermInfo term="Transport Alignment" />
          </span>
        </div>

        {/* Filter Controls & Mandatory Switch */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white select-none">
            <input
              type="checkbox"
              checked={showTransportVectors}
              onChange={(e) => setShowTransportVectors(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
            />
            <span>Transport Vectors</span>
          </label>

          {/* High Significance Only switch */}
          <label className="flex items-center gap-1.5 cursor-pointer text-amber-300 hover:text-amber-200 select-none font-medium">
            <input
              type="checkbox"
              checked={highSignificanceOnly}
              onChange={(e) => setHighSignificanceOnly(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
            />
            <span className="inline-flex items-center">
              High Significance (FRP ≥ 15 MW)
              <TermInfo term="FRP" />
            </span>
          </label>
        </div>
      </div>

      {/* Small non-blocking developer configuration warning */}
      {error && (
        <div className="px-4 py-2 bg-slate-900/90 border-b border-slate-800 text-slate-300 text-xs flex items-center justify-between font-mono">
          <div className="flex items-center gap-2">
            <span className="text-amber-400">⚠️</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Map Stage Viewport: Desktop >= 1200px: min-height: 640px, height: clamp(640px, 70vh, 760px); Tablet: 520px; Mobile: 420px (Req 1, 2) */}
      <div className="asean-map-stage relative w-full bg-[#070c16] shrink-0">
        {/* Google Map Container: always rendered in DOM with matching responsive height constraints */}
        <div ref={mapContainerRef} className="asean-map-canvas w-full h-full" />

        {/* Selected Cluster Info Card Popup */}
        {activePopupCluster && (
          <div className="absolute top-4 right-4 z-20 bg-[#090e18]/95 backdrop-blur-md border border-cyan-500/60 rounded-xl p-4 text-xs shadow-2xl max-w-sm space-y-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-white text-sm">{activePopupCluster.name}</span>
              <button
                onClick={() => setActivePopupCluster(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5 font-mono text-slate-300">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 inline-flex items-center">
                  Wildfire Pressure:
                  <TermInfo term="Wildfire Pressure" />
                </span>
                <strong className="text-amber-300">{activePopupCluster.wildfirePressure}</strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 inline-flex items-center">
                  Total Detections:
                  <TermInfo term="Active-fire detection" />
                </span>
                <strong className="text-white">{activePopupCluster.detectionCount} detections</strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">High Confidence:</span>
                <strong className="text-red-400">{activePopupCluster.highConfidenceCount}</strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 inline-flex items-center">
                  Average FRP:
                  <TermInfo term="FRP" />
                </span>
                <strong className="text-slate-200">{activePopupCluster.avgFrp} MW</strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Maximum FRP:</span>
                <strong className="text-cyan-300">{activePopupCluster.maxFrp} MW</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Latest Observed:</span>
                <strong className="text-slate-400 text-[10px]">{activePopupCluster.latestObservationTime}</strong>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-500">
              {activePopupCluster.disclaimer}
            </div>
          </div>
        )}

        {/* Subtle loading state while Google Maps JS loads */}
        {!isLoaded && isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#070c16]/80 z-10 pointer-events-none">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <span className="text-xs font-mono text-cyan-400">Initializing Google Maps Basemap...</span>
          </div>
        )}
      </div>

      {/* Compact Two-Row Map Legend with Risk-Driven Community Marker Symbols & Focus Treatment (Req 4, 5, 6) */}
      <div className="px-4 py-2 border-t border-slate-800 bg-[#080d16] flex flex-wrap items-center justify-between gap-y-1.5 gap-x-4 text-[11px] font-mono text-slate-400">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="text-slate-300 font-sans font-semibold">Legend:</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0"></span> Nominal Fire
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0"></span> High Conf / FRP
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-amber-400 text-xs shrink-0">🔥</span> Source Cluster
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-cyan-400 font-bold shrink-0">→</span> Transport Vector
          </span>

          {/* Communities: Palangka Raya · Singapore · Kuching (Sorted by shared deterministic rule) */}
          <span className="inline-flex items-center gap-2 px-2 py-0.5 rounded bg-slate-900/80 border border-slate-800">
            <span className="text-slate-400">Communities:</span>
            {sortCommunitiesByRisk(
              communities.length > 0
                ? communities
                : ([
                    { locationId: 'palangka-raya', locationName: 'Palangka Raya', now: { riskLevel: 'SEVERE' } },
                    { locationId: 'singapore', locationName: 'Singapore', now: { riskLevel: 'HIGH' } },
                    { locationId: 'kuching', locationName: 'Kuching', now: { riskLevel: 'MODERATE' } },
                  ] as any[])
            ).map((comm, idx) => {
              const isFocused = comm.locationId === selectedCommunityId;
              const riskColor = getCommunityRiskColor(comm.now.riskLevel);
              return (
                <span key={comm.locationId} className="inline-flex items-center gap-1.5">
                  {idx > 0 && <span className="text-slate-600 mr-0.5">·</span>}
                  <button
                    type="button"
                    onClick={() => onSelectCommunity(comm.locationId)}
                    className={`inline-flex items-center gap-1 cursor-pointer transition-colors hover:text-cyan-300 ${
                      isFocused ? 'text-cyan-200 font-semibold' : 'text-slate-300'
                    }`}
                    title={`Click to focus ${comm.locationName} on map`}
                  >
                    <CommunityMarkerIcon
                      color={riskColor}
                      isFocused={isFocused}
                      size={16}
                    />
                    <span>{comm.locationName}</span>
                    <span className="text-[10px] opacity-75 font-mono">· {comm.now.riskLevel}</span>
                  </button>
                </span>
              );
            })}
          </span>
        </div>

        {/* Semantic Note: Fill = current risk · Cyan outline = focused community */}
        <div className="text-[10px] text-slate-400 shrink-0">
          <span>Fill = current risk</span> · <span className="text-cyan-400 font-medium">Cyan outline = focused community</span>
        </div>
      </div>
    </div>
  );
}
