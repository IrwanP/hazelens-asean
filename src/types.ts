export type ProvenanceCategory =
  | 'CURRENT SOURCE DATA'
  | 'FORECAST'
  | 'CALCULATED BY HAZELENS'
  | 'AI INTERPRETATION';

export type ImpactRiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';
export type WildfirePressureLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'VERY HIGH';
export type TransportAlignmentLevel = 'LOW' | 'MODERATE' | 'HIGH';
export type TrendOutlook = 'Improving' | 'Stable' | 'Deteriorating';
export type PrimaryDriver =
  | 'Wildfire Pressure'
  | 'Atmospheric Transport'
  | 'PM2.5 Exposure'
  | 'Fire Persistence Conditions';
export type ConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface FireDetection {
  latitude: number;
  longitude: number;
  confidence: 'high' | 'nominal' | 'low';
  frp: number; // Fire Radiative Power (MW)
  acqDate: string;
  acqTime: string;
  daynight: 'D' | 'N';
}

export interface SourceCluster {
  id: string;
  name: string;
  subregion: string;
  centroid: {
    lat: number;
    lon: number;
  };
  detectionCount: number;
  highConfidenceCount: number;
  avgFrp: number;
  maxFrp: number;
  totalFrp: number;
  latestObservationTime: string; // ISO or UTC string
  dayNightDistribution: {
    day: number;
    night: number;
  };
  wildfirePressure: WildfirePressureLevel;
  pressureScore: number; // 0-100
  disclaimer: string;
  provenance: 'CURRENT SOURCE DATA';
  source: string;
}

export interface TransportAlignmentDetail {
  clusterId: string;
  clusterName: string;
  sourceToCommunityBearing: number; // degrees 0-360
  currentTransportDirection: number; // (windDirection + 180) % 360
  angularDifference: number; // 0-180 degrees
  windSpeedKmh: number;
  alignmentLevel: TransportAlignmentLevel;
  alignmentScore: number; // 0-100
  forecastConsistency: 'Steady' | 'Shifting' | 'Variable';
  advisoryText: string;
  provenance: 'CALCULATED BY HAZELENS';
}

export interface LocalAirQualityInfo {
  primaryStandardName: string; // e.g. "Google Universal AQI (UAQI)" or local index if returned
  primaryCategory: string; // e.g. "Moderate", "Unhealthy", "Good"
  primaryValue?: number;
  pm25: number; // µg/m³
  pm10: number; // µg/m³
  universalAqi?: number; // Only present if Google Universal AQI (UAQI) is returned (1-100 scale)
  singapore1HourPm25Band?: 'Normal' | 'Elevated' | 'High' | 'Very High';
  provenance: 'CURRENT SOURCE DATA';
  source: string;
  isFallback?: boolean;
}

export interface RiskComponentBreakdown {
  wildfirePressureScore: number; // 30% weight
  transportAlignmentScore: number; // 25% weight
  communityExposureScore: number; // 30% weight
  firePersistenceScore: number; // 15% weight
}

export interface CommunityOutlookData {
  locationId: string;
  locationName: string;
  country: string;
  coordinates: {
    lat: number;
    lon: number;
  };
  now: {
    riskScore: number; // 0-100 deterministic
    riskLevel: ImpactRiskLevel;
    confidence: ConfidenceLevel;
    componentScores: RiskComponentBreakdown;
    airQuality: LocalAirQualityInfo;
    temperature: number;
    humidity: number;
    windSpeedKmh: number;
    windDirectionDeg: number;
    windBearing: string;
  };
  next6Hours: TrendOutlook;
  next24Hours: TrendOutlook;
  primaryDriver: PrimaryDriver;
  transportAlignments: TransportAlignmentDetail[];
  dominantAlignment: TransportAlignmentDetail | null;
  firePersistenceConditions: {
    score: number; // 0-100
    rating: 'Low' | 'Moderate' | 'High';
    forecastPrecipitation24h: number; // mm
    description: string;
  };
  earlyActionIntelligence: {
    next6Hours: string;
    next24Hours: string;
    sourceRegion: string;
    communitySpecificNotice: string;
    officialHealthRecommendations: string;
    mandatoryDisclaimer: string;
  };
  evidenceUsed: Array<{
    category: ProvenanceCategory;
    name: string;
    value: string;
    provider: string;
    timestamp: string;
    freshness: string;
  }>;
}

export interface SignalChangeItem {
  signalName: string;
  direction: 'increased' | 'decreased' | 'stable';
  symbol: '↑' | '↓' | '→';
  description: string;
}

export interface WhatChangedSnapshot {
  hasPrevious: boolean;
  baselineNotice?: string;
  headline: string;
  summary: string;
  whyThisMatters?: string;
  signals: SignalChangeItem[];
  previousRiskLevel?: ImpactRiskLevel;
  currentRiskLevel?: ImpactRiskLevel;
  timestamp: string;
  previousTimestamp: string | null;
}

export interface AttentionItem {
  locationId: string;
  locationName: string;
  country: string;
  impactLevel: ImpactRiskLevel;
  primaryConcern: string;
  nextAction: string;
}

export interface RegionalSituationData {
  statusLevel: 'Low' | 'Moderate' | 'Elevated' | 'High' | 'Severe';
  situationSummary: string;
  highestCommunityImpact: string;
  strongestSourcePressure: string;
  nextDecisionWindow: string; // e.g. "6 hours"
  confidence: ConfidenceLevel;
  totalActiveFiresDetected: number;
  borneoBoundingAreaCount: number;
  primarySensorName: string;
  observationWindow: string;
  geographicBoundsDescription: string;
  clusters: SourceCluster[];
}

export interface DecisionSystemState {
  regionalSituation: RegionalSituationData;
  whatChanged: WhatChangedSnapshot;
  attentionItems: AttentionItem[];
  communities: CommunityOutlookData[];
  fires: FireDetection[];
  clusters: SourceCluster[];
  timestamp: string;
}

export const RISK_PRIORITY: Record<string, number> = {
  SEVERE: 4,
  HIGH: 3,
  MODERATE: 2,
  LOW: 1,
};

/**
 * Shared deterministic ordering rule for HazeLens monitored communities:
 * 1. Risk severity descending (SEVERE=4 > HIGH=3 > MODERATE=2 > LOW=1)
 * 2. Community name ascending alphabetically (localeCompare) when tied
 */
export function sortCommunitiesByRisk<
  T extends {
    locationName?: string;
    name?: string;
    now?: { riskLevel?: ImpactRiskLevel | string };
    impactLevel?: ImpactRiskLevel | string;
    riskLevel?: ImpactRiskLevel | string;
  }
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const levelA = a.now?.riskLevel || a.impactLevel || a.riskLevel || 'LOW';
    const levelB = b.now?.riskLevel || b.impactLevel || b.riskLevel || 'LOW';
    const priorityA = RISK_PRIORITY[levelA] ?? 1;
    const priorityB = RISK_PRIORITY[levelB] ?? 1;

    const severityDiff = priorityB - priorityA;
    if (severityDiff !== 0) return severityDiff;

    const nameA = a.locationName || a.name || '';
    const nameB = b.locationName || b.name || '';
    return nameA.localeCompare(nameB);
  });
}
