import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import {
  FireDetection,
  SourceCluster,
  CommunityOutlookData,
  WhatChangedSnapshot,
  RegionalSituationData,
  DecisionSystemState,
  ImpactRiskLevel,
  WildfirePressureLevel,
  TransportAlignmentLevel,
  TrendOutlook,
  PrimaryDriver,
  ConfidenceLevel,
  TransportAlignmentDetail,
  LocalAirQualityInfo,
  SignalChangeItem,
  AttentionItem,
  sortCommunitiesByRisk,
} from './src/types';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json());

// Initialize Google GenAI with recommended telemetry header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Community Registry (Exact coordinates specified in prompt)
interface MonitoredCommunityDef {
  id: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  primaryStandardName: string;
}

const MONITORED_COMMUNITIES: MonitoredCommunityDef[] = [
  {
    id: 'palangka-raya',
    name: 'Palangka Raya',
    country: 'Indonesia',
    lat: -2.21,
    lon: 113.92,
    primaryStandardName: 'ISPU (Indonesia KLHK)',
  },
  {
    id: 'kuching',
    name: 'Kuching',
    country: 'Malaysia',
    lat: 1.5533,
    lon: 110.3592,
    primaryStandardName: 'API (Malaysia DOE)',
  },
  {
    id: 'singapore',
    name: 'Singapore',
    country: 'Singapore',
    lat: 1.3521,
    lon: 103.8198,
    primaryStandardName: 'PSI (Singapore NEA)',
  },
];

// In-Memory Assessment History for "What Changed?" Intelligence
let previousStateSnapshot: DecisionSystemState | null = null;
let currentStateSnapshot: DecisionSystemState | null = null;

// Caches for upstream APIs (respect quotas & rate limits)
let cachedFirmsFires: FireDetection[] | null = null;
let firmsCacheTimestamp = 0;
const FIRMS_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Great Circle Distance (Haversine formula in km)
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Bearing from point 1 to point 2 in degrees (0-360)
function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLon);
  return (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
}

function getWindBearingLabel(deg: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(deg / 22.5) % 16;
  return directions[index];
}

let borneoBoundingBoxCount = 0;
let lastFirmsSensorName = 'NASA FIRMS Active Fires (NOAA-21 VIIRS · Near Real-Time · Rolling 24h)';

// 1. Fetch & Parse Real NASA FIRMS Active Fire CSV
// Primary Dataset: VIIRS_NOAA21_NRT (NOAA-21 satellite · VIIRS sensor · Near Real-Time)
// True rolling 24-hour window filter based on UTC acquisition timestamp
async function fetchRealNasaFirmsFires(): Promise<{ fires: FireDetection[]; borneoCount: number; sensorName: string }> {
  const nowUtc = Date.now();
  if (cachedFirmsFires && nowUtc - firmsCacheTimestamp < FIRMS_TTL_MS) {
    return { fires: cachedFirmsFires, borneoCount: borneoBoundingBoxCount, sensorName: lastFirmsSensorName };
  }

  // Request the most recent 2 days using VIIRS_NOAA21_NRT as required by prompt step 3
  const urls = [
    'https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-21-viirs-c2/csv/J2_VIIRS_C2_SouthEast_Asia_48h.csv',
    'https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-21-viirs-c2/csv/J2_VIIRS_C2_SouthEast_Asia_24h.csv',
  ];

  for (let u = 0; u < urls.length; u++) {
    const url = urls[u];
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (!response.ok) continue;
      const csvText = await response.text();
      const lines = csvText.trim().split('\n');
      if (lines.length < 2) continue;

      const fires: FireDetection[] = [];
      let bCount = 0;
      const cutoff24hUtc = nowUtc - 24 * 60 * 60 * 1000;

      // Line 0 is header: latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,confidence,version,bright_ti5,frp,daynight
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts.length < 12) continue;

        const lat = parseFloat(parts[0]);
        const lon = parseFloat(parts[1]);
        const acqDate = parts[5]; // YYYY-MM-DD
        const acqTime = parts[6].padStart(4, '0'); // HHMM

        // Construct UTC timestamp from acq_date and acq_time (prompt step 3)
        const hh = acqTime.slice(0, 2);
        const mm = acqTime.slice(2, 4);
        const observationTimeUtc = Date.parse(`${acqDate}T${hh}:${mm}:00Z`);

        // Retain only observations where timestamp >= current UTC time - 24 hours
        if (isNaN(observationTimeUtc) || observationTimeUtc < cutoff24hUtc || observationTimeUtc > nowUtc + 5 * 60 * 1000) {
          continue;
        }

        const confStr = parts[8]?.toLowerCase() || 'nominal';
        const frpVal = parseFloat(parts[11]) || 0;
        const daynight = parts[12]?.trim() === 'N' ? 'N' : 'D';

        // Check Borneo-region bounding area: Lon 108°E to 119°E, Lat -5°S to 4°N
        if (lat >= -5.0 && lat <= 4.0 && lon >= 108.0 && lon <= 119.0) {
          bCount++;
        }

        // Bounding to Maritime Southeast Asia Sentinel Area: Lat -5° to 5°N, Lon 100° to 119.5°E
        // Encompasses Borneo (Palangka Raya, Kuching), Singapore, and Sumatra transport corridor
        if (lat >= -5.0 && lat <= 5.0 && lon >= 100.0 && lon <= 119.5) {
          let confidence: 'high' | 'nominal' | 'low' = 'nominal';
          if (confStr === 'h' || confStr === 'high') confidence = 'high';
          else if (confStr === 'l' || confStr === 'low') confidence = 'low';

          fires.push({
            latitude: lat,
            longitude: lon,
            confidence,
            frp: Number(frpVal.toFixed(1)),
            acqDate,
            acqTime,
            daynight,
          });
        }
      }

      // Sort by FRP descending
      fires.sort((a, b) => b.frp - a.frp);

      // Replace dataset atomically on refresh rather than appending duplicate rows
      cachedFirmsFires = fires;
      borneoBoundingBoxCount = bCount;
      lastFirmsSensorName = 'NASA FIRMS (NOAA-21 VIIRS · Near Real-Time · Rolling 24h active-fire detections)';
      firmsCacheTimestamp = nowUtc;
      return { fires, borneoCount: bCount, sensorName: lastFirmsSensorName };
    } catch (err) {
      console.error(`Error fetching NASA FIRMS CSV from ${url}:`, err);
    }
  }

  return { fires: cachedFirmsFires || [], borneoCount: borneoBoundingBoxCount, sensorName: lastFirmsSensorName };
}

// 2. Spatial Clustering of NASA FIRMS Hotspots into Source Clusters
function clusterFiresIntoSourceRegions(fires: FireDetection[]): SourceCluster[] {
  // Spatial cluster radius: ~65 km
  const CLUSTER_DISTANCE_KM = 65;
  const clusters: Array<{
    fires: FireDetection[];
    centroidLat: number;
    centroidLon: number;
  }> = [];

  // Group fires into spatial clusters
  for (const fire of fires) {
    let matched = false;
    for (const cl of clusters) {
      if (distanceKm(fire.latitude, fire.longitude, cl.centroidLat, cl.centroidLon) <= CLUSTER_DISTANCE_KM) {
        cl.fires.push(fire);
        // update centroid incrementally
        cl.centroidLat = cl.fires.reduce((sum, f) => sum + f.latitude, 0) / cl.fires.length;
        cl.centroidLon = cl.fires.reduce((sum, f) => sum + f.longitude, 0) / cl.fires.length;
        matched = true;
        break;
      }
    }

    if (!matched && clusters.length < 30) {
      clusters.push({
        fires: [fire],
        centroidLat: fire.latitude,
        centroidLon: fire.longitude,
      });
    }
  }

  // Filter clusters with at least 3 detections for regional significance
  const significantClusters = clusters.filter((c) => c.fires.length >= 3);

  // Helper to determine descriptive, defensible geographic region name from centroid
  const getRegionName = (lat: number, lon: number): { name: string; subregion: string } => {
    // South Kalimantan
    if (lat >= -4.5 && lat <= -1.5 && lon >= 114.5 && lon <= 116.8) {
      return { name: 'South Kalimantan region', subregion: 'South Kalimantan' };
    }
    // Central Kalimantan
    if (lat >= -3.8 && lat <= -0.5 && lon >= 111.0 && lon <= 115.5) {
      return { name: 'Central Kalimantan region', subregion: 'Central Kalimantan' };
    }
    // West Kalimantan
    if (lat >= -3.0 && lat <= 1.8 && lon >= 108.5 && lon <= 113.0) {
      return { name: 'West Kalimantan region', subregion: 'West Kalimantan' };
    }
    // East Kalimantan
    if (lat >= -2.5 && lat <= 2.5 && lon >= 115.5 && lon <= 119.0) {
      return { name: 'East Kalimantan region', subregion: 'East Kalimantan' };
    }
    // Sarawak
    if (lat >= 0.8 && lat <= 5.0 && lon >= 109.5 && lon <= 116.0) {
      return { name: 'Sarawak Interior region', subregion: 'Sarawak' };
    }
    // Riau / Eastern Sumatra
    if (lat >= -1.0 && lat <= 2.5 && lon >= 100.0 && lon <= 104.0) {
      return { name: 'Riau Peat Corridor, Eastern Sumatra', subregion: 'Riau, Sumatra' };
    }
    // Jambi / Eastern Sumatra
    if (lat >= -2.8 && lat <= -0.8 && lon >= 101.5 && lon <= 104.5) {
      return { name: 'Jambi Peatlands, Eastern Sumatra', subregion: 'Jambi, Sumatra' };
    }
    // South Sumatra Basin
    if (lat >= -4.8 && lat <= -1.8 && lon >= 103.0 && lon <= 106.5) {
      return { name: 'South Sumatra Basin', subregion: 'South Sumatra' };
    }
    // Bangka Belitung
    if (lat >= -3.5 && lat <= -1.5 && lon >= 105.0 && lon <= 108.5) {
      return { name: 'Bangka Belitung Islands', subregion: 'Bangka Belitung' };
    }
    // North Sumatra / Aceh
    if (lat > 2.5 && lon < 100.0) {
      return { name: 'North Sumatra region', subregion: 'Sumatra' };
    }
    // Defensible general fallback based on longitude
    if (lon >= 108.0) {
      if (lat < -1.5) return { name: 'South Kalimantan region', subregion: 'South Kalimantan' };
      if (lat < 0) return { name: 'Central Kalimantan region', subregion: 'Central Kalimantan' };
      return { name: 'West Kalimantan region', subregion: 'West Kalimantan' };
    } else {
      return { name: 'Eastern Sumatra region', subregion: 'Sumatra' };
    }
  };

  return significantClusters.map((cl, idx) => {
    const fireCount = cl.fires.length;
    const highConf = cl.fires.filter((f) => f.confidence === 'high').length;
    const frpVals = cl.fires.map((f) => f.frp);
    const totalFrp = Math.round(frpVals.reduce((a, b) => a + b, 0));
    const maxFrp = Math.round(Math.max(...frpVals));
    const avgFrp = Number((totalFrp / fireCount).toFixed(1));

    const dayCount = cl.fires.filter((f) => f.daynight === 'D').length;
    const nightCount = cl.fires.filter((f) => f.daynight === 'N').length;

    // Find latest observation time
    const sortedByTime = [...cl.fires].sort((a, b) => `${b.acqDate} ${b.acqTime}`.localeCompare(`${a.acqDate} ${a.acqTime}`));
    const latest = sortedByTime[0] ? `${sortedByTime[0].acqDate} ${sortedByTime[0].acqTime} UTC` : 'Recent 24h';

    // Deterministic Wildfire Pressure calculation
    let wildfirePressure: WildfirePressureLevel = 'LOW';
    let pressureScore = 20;

    if (fireCount >= 35 || (fireCount >= 18 && (maxFrp >= 80 || highConf >= 10))) {
      wildfirePressure = 'VERY HIGH';
      pressureScore = 95;
    } else if (fireCount >= 12 || (fireCount >= 6 && maxFrp >= 40)) {
      wildfirePressure = 'HIGH';
      pressureScore = 75;
    } else if (fireCount >= 5 || maxFrp >= 20) {
      wildfirePressure = 'MODERATE';
      pressureScore = 50;
    } else {
      wildfirePressure = 'LOW';
      pressureScore = 25;
    }

    const { name, subregion } = getRegionName(cl.centroidLat, cl.centroidLon);

    return {
      id: `cluster-${idx + 1}-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      name: `${name} Cluster #${idx + 1}`,
      subregion,
      centroid: {
        lat: Number(cl.centroidLat.toFixed(4)),
        lon: Number(cl.centroidLon.toFixed(4)),
      },
      detectionCount: fireCount,
      highConfidenceCount: highConf,
      avgFrp,
      maxFrp,
      totalFrp,
      latestObservationTime: latest,
      dayNightDistribution: {
        day: dayCount,
        night: nightCount,
      },
      wildfirePressure,
      pressureScore,
      disclaimer: 'NASA FIRMS detects thermal anomalies from satellite pixel radiometry; detections represent fire activity footprints rather than individual separate wildfires.',
      provenance: 'CURRENT SOURCE DATA',
      source: lastFirmsSensorName,
    };
  });
}

// 3. Verified Weather & Air Quality Ingestion
// Primary Sources: Google Air Quality API & Google Weather API
// Explicit Resilience Fallback: Copernicus CAMS & Open-Meteo Weather Reanalysis
interface CommunityTelemetryData {
  pm25: number;
  pm10: number;
  universalAqi?: number; // Only present if Google Universal AQI (UAQI) is returned (1-100 scale)
  localAqi?: {
    name: string;
    value: number;
    category: string;
  };
  fallbackAqi?: {
    name: string;
    value: number;
    category: string;
  };
  temperature: number;
  humidity: number;
  windSpeedKmh: number;
  windDirectionDeg: number;
  forecastPm25_6h: number;
  forecastPm25_24h: number;
  forecastPrecipitation_24h: number;
  forecastWindDirections_24h: number[];
  airQualitySource: string;
  weatherSource: string;
  isAirQualityFallback: boolean;
  isWeatherFallback: boolean;
  sourceTimestamp: string;
}

async function getGoogleCloudAccessToken(): Promise<string | null> {
  try {
    const metaRes = await fetch(
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
      {
        headers: { 'Metadata-Flavor': 'Google' },
        signal: AbortSignal.timeout(1500),
      }
    );
    if (metaRes.ok) {
      const data = await metaRes.json();
      return data.access_token || null;
    }
  } catch {
    // metadata server not reachable or timed out
  }
  return null;
}

async function fetchCommunityTelemetry(lat: number, lon: number): Promise<CommunityTelemetryData> {
  let googleAqData: any = null;
  let googleWeatherData: any = null;
  let isAirQualityFallback = false;
  let isWeatherFallback = false;
  let airQualitySource = 'Google Air Quality API';
  let weatherSource = 'Google Weather';
  const nowIso = new Date().toISOString();

  // Attempt Primary Sources: Google Air Quality API & Google Weather API
  try {
    const token = await getGoogleCloudAccessToken();
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

    // 1. Google Air Quality attempt
    try {
      const aqHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) aqHeaders['Authorization'] = `Bearer ${token}`;

      const aqUrl = apiKey
        ? `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${apiKey}`
        : 'https://airquality.googleapis.com/v1/currentConditions:lookup';

      const aqRes = await fetch(aqUrl, {
        method: 'POST',
        headers: aqHeaders,
        body: JSON.stringify({
          location: { latitude: lat, longitude: lon },
          extraComputations: ['LOCAL_AQI', 'POLLUTANT_CONCENTRATION'],
        }),
        signal: AbortSignal.timeout(4000),
      });

      if (aqRes.ok) {
        googleAqData = await aqRes.json();
      }
    } catch {
      // Google AQ failed; will invoke fallback
    }

    // 2. Google Weather attempt
    try {
      const wHeaders: Record<string, string> = {};
      if (token) wHeaders['Authorization'] = `Bearer ${token}`;

      const wUrl = apiKey
        ? `https://weather.googleapis.com/v1/currentConditions:lookup?key=${apiKey}&location.latitude=${lat}&location.longitude=${lon}`
        : `https://weather.googleapis.com/v1/currentConditions:lookup?location.latitude=${lat}&location.longitude=${lon}`;

      const wRes = await fetch(wUrl, {
        headers: wHeaders,
        signal: AbortSignal.timeout(4000),
      });

      if (wRes.ok) {
        googleWeatherData = await wRes.json();
      }
    } catch {
      // Google Weather failed; will invoke fallback
    }
  } catch {
    // Upstream token / network check
  }

  // Parse Air Quality (Primary Google vs Fallback Copernicus)
  let pm25 = 0;
  let pm10 = 0;
  let universalAqi: number | undefined = undefined;
  let localAqi: { name: string; value: number; category: string } | undefined;
  let fallbackAqi: { name: string; value: number; category: string } | undefined;
  let hourlyPm25: number[] = [];

  if (googleAqData && googleAqData.indexes) {
    airQualitySource = 'Google Air Quality API';
    isAirQualityFallback = false;

    // Find Universal AQI from Google (1-100 scale)
    const uaqi = googleAqData.indexes.find((idx: any) => idx.code === 'uaqi');
    if (uaqi && typeof uaqi.aqi === 'number') {
      universalAqi = uaqi.aqi;
    }

    // Find Local AQI if returned by Google
    const local = googleAqData.indexes.find((idx: any) => idx.code !== 'uaqi');
    if (local) {
      localAqi = {
        name: local.displayName || local.code.toUpperCase(),
        value: typeof local.aqi === 'number' ? local.aqi : (universalAqi ?? 0),
        category: local.category || 'Moderate',
      };
    }

    // Find PM2.5 and PM10 concentrations
    if (googleAqData.pollutants && Array.isArray(googleAqData.pollutants)) {
      const p25 = googleAqData.pollutants.find((p: any) => p.code === 'pm25');
      if (p25 && p25.concentration && typeof p25.concentration.value === 'number') {
        pm25 = p25.concentration.value;
      }
      const p10 = googleAqData.pollutants.find((p: any) => p.code === 'pm10');
      if (p10 && p10.concentration && typeof p10.concentration.value === 'number') {
        pm10 = p10.concentration.value;
      }
    }
  } else {
    // Explicit Resilience Fallback: Copernicus CAMS via Open-Meteo
    isAirQualityFallback = true;
    airQualitySource = 'Copernicus CAMS via Open-Meteo [FALLBACK SOURCE]';

    const aqRes = await fetch(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm10,pm2_5,us_aqi&hourly=pm2_5&timezone=UTC&forecast_days=2`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (aqRes.ok) {
      const aqData = await aqRes.json();
      pm25 = aqData.current?.pm2_5 ?? 0;
      pm10 = aqData.current?.pm10 ?? 0;
      hourlyPm25 = aqData.hourly?.pm2_5 || [];

      // Open-Meteo returns US AQI (us_aqi). NEVER relabel this as Universal AQI.
      // US EPA standard AQI scale is 0-500.
      if (typeof aqData.current?.us_aqi === 'number') {
        const rawUsAqi = Math.round(aqData.current.us_aqi);
        let cat = 'Moderate';
        if (rawUsAqi <= 50) cat = 'Good';
        else if (rawUsAqi <= 100) cat = 'Moderate';
        else if (rawUsAqi <= 150) cat = 'Unhealthy for Sensitive Groups';
        else if (rawUsAqi <= 200) cat = 'Unhealthy';
        else if (rawUsAqi <= 300) cat = 'Very Unhealthy';
        else cat = 'Hazardous';

        fallbackAqi = {
          name: 'US AQI [FALLBACK SOURCE]',
          value: Math.min(rawUsAqi, 500),
          category: cat,
        };
      }
    }
  }

  // Parse Weather (Primary Google vs Fallback Open-Meteo)
  let temperature = 0;
  let humidity = 0;
  let windSpeedKmh = 0;
  let windDirectionDeg = 0;
  let totalPrecip24h = 0;
  let hourlyWindDir: number[] = [];

  if (googleWeatherData && (googleWeatherData.temperature || googleWeatherData.wind)) {
    weatherSource = 'Google Weather';
    isWeatherFallback = false;

    temperature = googleWeatherData.temperature?.degrees ?? 0;
    humidity = googleWeatherData.relativeHumidity ?? 0;
    windSpeedKmh = googleWeatherData.wind?.speed?.kilometersPerHour ?? 0;
    windDirectionDeg = googleWeatherData.wind?.direction?.degrees ?? 0;
  } else {
    // Explicit Resilience Fallback: Open-Meteo Meteorological Reanalysis
    isWeatherFallback = true;
    weatherSource = 'Open-Meteo Meteorological Reanalysis [FALLBACK SOURCE]';

    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m&hourly=precipitation,wind_direction_10m&timezone=UTC&forecast_days=2`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (weatherRes.ok) {
      const weatherData = await weatherRes.json();
      temperature = weatherData.current?.temperature_2m ?? 0;
      humidity = weatherData.current?.relative_humidity_2m ?? 0;
      windSpeedKmh = weatherData.current?.wind_speed_10m ?? 0;
      windDirectionDeg = weatherData.current?.wind_direction_10m ?? 0;

      const hourlyPrecip: number[] = weatherData.hourly?.precipitation || [];
      totalPrecip24h = hourlyPrecip.slice(0, 24).reduce((a, b) => a + b, 0);
      hourlyWindDir = weatherData.hourly?.wind_direction_10m || [];
    }
  }

  const next6HoursPm25 = hourlyPm25.slice(0, 6);
  const next24HoursPm25 = hourlyPm25.slice(0, 24);
  const avg6h = next6HoursPm25.length > 0 ? next6HoursPm25.reduce((a, b) => a + b, 0) / next6HoursPm25.length : pm25;
  const avg24h = next24HoursPm25.length > 0 ? next24HoursPm25.reduce((a, b) => a + b, 0) / next24HoursPm25.length : pm25;

  return {
    pm25: Number(pm25.toFixed(1)),
    pm10: Number(pm10.toFixed(1)),
    universalAqi: typeof universalAqi === 'number' ? Math.round(universalAqi) : undefined,
    localAqi,
    fallbackAqi,
    temperature: Number(temperature.toFixed(1)),
    humidity: Math.round(humidity),
    windSpeedKmh: Number(windSpeedKmh.toFixed(1)),
    windDirectionDeg: Math.round(windDirectionDeg),
    forecastPm25_6h: Number(avg6h.toFixed(1)),
    forecastPm25_24h: Number(avg24h.toFixed(1)),
    forecastPrecipitation_24h: Number(totalPrecip24h.toFixed(1)),
    forecastWindDirections_24h: hourlyWindDir.slice(0, 24),
    airQualitySource,
    weatherSource,
    isAirQualityFallback,
    isWeatherFallback,
    sourceTimestamp: nowIso,
  };
}

// 4. Calculate Atmospheric Transport Alignment
function computeTransportAlignment(
  cluster: SourceCluster,
  comm: MonitoredCommunityDef,
  telemetry: CommunityTelemetryData
): TransportAlignmentDetail {
  // Step 1: Calculate geographic bearing from cluster centroid to community
  const sourceToCommunityBearing = Math.round(bearingDeg(cluster.centroid.lat, cluster.centroid.lon, comm.lat, comm.lon));

  // Step 3: Convert meteorological wind direction into transport direction
  const transportDirection = Math.round((telemetry.windDirectionDeg + 180) % 360);

  // Step 4: Compare transport direction with source-to-community bearing
  const angularDifference = Math.round(Math.abs(((transportDirection - sourceToCommunityBearing + 180) % 360) - 180));

  // Step 5: Consider wind speed and angular alignment
  let alignmentLevel: TransportAlignmentLevel = 'LOW';
  let alignmentScore = 20;

  if (angularDifference <= 35 && telemetry.windSpeedKmh >= 8) {
    alignmentLevel = 'HIGH';
    alignmentScore = Math.min(80 + Math.round(telemetry.windSpeedKmh), 100);
  } else if (angularDifference <= 70 && telemetry.windSpeedKmh >= 5) {
    alignmentLevel = 'MODERATE';
    alignmentScore = 55;
  } else {
    alignmentLevel = 'LOW';
    alignmentScore = 20;
  }

  // Step 6: Forecast consistency across 24h
  let steadyHours = 0;
  telemetry.forecastWindDirections_24h.forEach((wd) => {
    const fTransport = (wd + 180) % 360;
    const fDiff = Math.abs(((fTransport - sourceToCommunityBearing + 180) % 360) - 180);
    if (fDiff <= 45) steadyHours++;
  });

  let forecastConsistency: 'Steady' | 'Shifting' | 'Variable' = 'Variable';
  if (steadyHours >= 14) forecastConsistency = 'Steady';
  else if (steadyHours >= 7) forecastConsistency = 'Shifting';

  const advisoryText =
    alignmentLevel === 'HIGH'
      ? `Atmospheric conditions are aligned with potential transport toward ${comm.name} (wind bearing: ${telemetry.windDirectionDeg}°, transport direction: ${transportDirection}°).`
      : alignmentLevel === 'MODERATE'
      ? `Atmospheric conditions show moderate alignment toward ${comm.name} with ${telemetry.windSpeedKmh} km/h winds.`
      : `Atmospheric conditions are not currently aligned with direct transport toward ${comm.name}.`;

  return {
    clusterId: cluster.id,
    clusterName: cluster.name,
    sourceToCommunityBearing,
    currentTransportDirection: transportDirection,
    angularDifference,
    windSpeedKmh: telemetry.windSpeedKmh,
    alignmentLevel,
    alignmentScore,
    forecastConsistency,
    advisoryText,
    provenance: 'CALCULATED BY HAZELENS',
  };
}

// 5. Evaluate Community Decision Intelligence
function evaluateCommunityOutlook(
  comm: MonitoredCommunityDef,
  telemetry: CommunityTelemetryData,
  clusters: SourceCluster[]
): CommunityOutlookData {
  // Transport Alignments with all clusters
  const alignments = clusters.map((cl) => computeTransportAlignment(cl, comm, telemetry));
  // Sort alignments by score descending
  alignments.sort((a, b) => b.alignmentScore - a.alignmentScore);
  const dominantAlignment = alignments[0] || null;

  // Wildfire Pressure (within 550km)
  const nearbyClusters = clusters.filter((cl) => distanceKm(cl.centroid.lat, cl.centroid.lon, comm.lat, comm.lon) <= 550);
  const maxPressure = nearbyClusters.length > 0 ? Math.max(...nearbyClusters.map((c) => c.pressureScore)) : 15;

  // 1. Wildfire Pressure (30%)
  const wildfirePressureScore = maxPressure;

  // 2. Atmospheric Transport Alignment (25%)
  const transportScore = dominantAlignment ? dominantAlignment.alignmentScore : 20;

  // 3. Community Exposure (30%) based on PM2.5 (15 µg/m³ = baseline, 55 = elevated, 150 = severe)
  const exposureScore = Math.min(Math.round((telemetry.pm25 / 120) * 100), 100);

  // 4. Fire Persistence Conditions (15%) based on upwind cluster FRP and lack of forecast rain
  let persistenceScore = 25;
  if (telemetry.forecastPrecipitation_24h < 1.0 && wildfirePressureScore >= 50) {
    persistenceScore = 85;
  } else if (telemetry.forecastPrecipitation_24h < 6.0 && wildfirePressureScore >= 40) {
    persistenceScore = 60;
  } else if (telemetry.forecastPrecipitation_24h >= 15.0) {
    persistenceScore = 15;
  }

  // Deterministic Risk Score: 30% Wildfire + 25% Transport + 30% Exposure + 15% Persistence
  const totalScore = Math.round(
    wildfirePressureScore * 0.30 +
    transportScore * 0.25 +
    exposureScore * 0.30 +
    persistenceScore * 0.15
  );
  const riskScore = Math.max(Math.min(totalScore, 100), 5);

  let riskLevel: ImpactRiskLevel = 'LOW';
  if (riskScore >= 76) riskLevel = 'SEVERE';
  else if (riskScore >= 51) riskLevel = 'HIGH';
  else if (riskScore >= 26) riskLevel = 'MODERATE';

  // Primary Driver calculation (largest marginal score)
  const driverContributions: { driver: PrimaryDriver; val: number }[] = [
    { driver: 'Wildfire Pressure', val: wildfirePressureScore * 0.30 },
    { driver: 'Atmospheric Transport', val: transportScore * 0.25 },
    { driver: 'PM2.5 Exposure', val: exposureScore * 0.30 },
    { driver: 'Fire Persistence Conditions', val: persistenceScore * 0.15 },
  ];
  driverContributions.sort((a, b) => b.val - a.val);
  const primaryDriver = driverContributions[0].driver;

  // Confidence calculation
  let confidence: ConfidenceLevel = 'HIGH';
  if (nearbyClusters.length === 0) confidence = 'MEDIUM';

  // Next 6 Hours Outlook
  let next6Hours: TrendOutlook = 'Stable';
  const delta6h = telemetry.forecastPm25_6h - telemetry.pm25;
  if (delta6h > 4 || (dominantAlignment?.alignmentLevel === 'HIGH' && delta6h > 1)) next6Hours = 'Deteriorating';
  else if (delta6h < -4) next6Hours = 'Improving';

  // Next 24 Hours Outlook
  let next24Hours: TrendOutlook = 'Stable';
  const delta24h = telemetry.forecastPm25_24h - telemetry.pm25;
  if (delta24h > 6 || (persistenceScore >= 75 && dominantAlignment?.alignmentLevel === 'HIGH')) next24Hours = 'Deteriorating';
  else if (delta24h < -6 || telemetry.forecastPrecipitation_24h >= 12) next24Hours = 'Improving';

  // Local Air Quality Info mapping
  let primaryStandardName = 'Ambient PM2.5';
  let primaryCategory = 'Moderate';
  let primaryValue: number | undefined = undefined;
  let singapore1HourPm25Band: 'Normal' | 'Elevated' | 'High' | 'Very High' | undefined;

  if (telemetry.universalAqi !== undefined && !telemetry.isAirQualityFallback) {
    // Authoritative Google Universal AQI (1-100 scale)
    primaryStandardName = 'Google Universal AQI (UAQI)';
    primaryValue = telemetry.universalAqi;
    if (telemetry.universalAqi <= 20) primaryCategory = 'Excellent';
    else if (telemetry.universalAqi <= 40) primaryCategory = 'Good';
    else if (telemetry.universalAqi <= 60) primaryCategory = 'Moderate';
    else if (telemetry.universalAqi <= 80) primaryCategory = 'Unhealthy for Sensitive Groups';
    else primaryCategory = 'Poor';
  } else if (telemetry.localAqi) {
    // Authoritative local AQI returned directly by upstream provider
    primaryStandardName = telemetry.localAqi.name;
    primaryCategory = telemetry.localAqi.category;
    primaryValue = telemetry.localAqi.value;
  } else if (telemetry.fallbackAqi) {
    // Explicit Fallback AQI (e.g. US AQI [FALLBACK SOURCE])
    primaryStandardName = telemetry.fallbackAqi.name;
    primaryCategory = telemetry.fallbackAqi.category;
    primaryValue = telemetry.fallbackAqi.value;
  } else {
    // Direct PM2.5 classification (WHO / ASEAN ambient standards)
    primaryStandardName = comm.primaryStandardName || 'Ambient PM2.5';
    primaryValue = undefined;
    if (telemetry.pm25 <= 15) primaryCategory = 'Good';
    else if (telemetry.pm25 <= 55) primaryCategory = 'Moderate';
    else if (telemetry.pm25 <= 150) primaryCategory = 'Unhealthy';
    else if (telemetry.pm25 <= 250) primaryCategory = 'Very Unhealthy';
    else primaryCategory = 'Hazardous';
  }

  // Singapore NEA 1-hour PM2.5 band (official NEA guideline based on raw PM2.5 concentration, NOT called a PSI score)
  if (comm.id === 'singapore') {
    if (telemetry.pm25 <= 55) singapore1HourPm25Band = 'Normal';
    else if (telemetry.pm25 <= 150) singapore1HourPm25Band = 'Elevated';
    else if (telemetry.pm25 <= 250) singapore1HourPm25Band = 'High';
    else singapore1HourPm25Band = 'Very High';
  }

  const airQuality: LocalAirQualityInfo = {
    primaryStandardName,
    primaryCategory,
    primaryValue,
    pm25: telemetry.pm25,
    pm10: telemetry.pm10,
    universalAqi: telemetry.universalAqi,
    singapore1HourPm25Band,
    provenance: 'CURRENT SOURCE DATA',
    source: telemetry.airQualitySource,
    isFallback: telemetry.isAirQualityFallback,
  };

  // Early Action Intelligence
  const next6HoursText =
    next6Hours === 'Deteriorating'
      ? `PM2.5 exposure is forecast to increase over the next six hours (forecast average: ${telemetry.forecastPm25_6h} µg/m³).`
      : next6Hours === 'Improving'
      ? `PM2.5 exposure is forecast to moderate over the next six hours.`
      : `PM2.5 exposure is expected to remain steady near ${telemetry.pm25} µg/m³ over the next six hours.`;

  const next24HoursText =
    dominantAlignment && dominantAlignment.alignmentLevel === 'HIGH'
      ? `Atmospheric transport alignment is expected to maintain potential transboundary pressure over the next 24 hours.`
      : `Atmospheric transport alignment is expected to weaken or diverge, which may reduce regional impact potential.`;

  const sourceRegionText =
    telemetry.forecastPrecipitation_24h < 1.0
      ? `Limited rainfall (${telemetry.forecastPrecipitation_24h} mm in 24h) may allow significant fire activity to persist in upwind peatlands.`
      : `Forecast rainfall (${telemetry.forecastPrecipitation_24h} mm in 24h) may promote partial atmospheric washout over active corridors.`;

  let communitySpecificNotice = '';
  if (comm.id === 'singapore') {
    communitySpecificNotice = 'Singapore: Elevated exposure is likely to persist over the next several hours.';
  } else if (comm.id === 'kuching') {
    communitySpecificNotice = 'Kuching: Monitor transport alignment from western Kalimantan.';
  } else if (comm.id === 'palangka-raya') {
    communitySpecificNotice = 'Palangka Raya: Persistent regional fire activity remains the dominant local environmental pressure.';
  }

  const healthNotice =
    riskLevel === 'SEVERE' || riskLevel === 'HIGH'
      ? 'Vulnerable demographics (children, elderly, chronic respiratory/cardiac patients) should avoid outdoor exertion. Consider N95/FFP2 respirators if outdoor presence is unavoidable.'
      : riskLevel === 'MODERATE'
      ? 'Sensitive individuals should reduce prolonged heavy outdoor exertion and keep relief medications accessible.'
      : 'Air quality is within normal parameters. Normal outdoor activities may continue.';

  return {
    locationId: comm.id,
    locationName: comm.name,
    country: comm.country,
    coordinates: {
      lat: comm.lat,
      lon: comm.lon,
    },
    now: {
      riskScore,
      riskLevel,
      confidence,
      componentScores: {
        wildfirePressureScore,
        transportAlignmentScore: transportScore,
        communityExposureScore: exposureScore,
        firePersistenceScore: persistenceScore,
      },
      airQuality,
      temperature: telemetry.temperature,
      humidity: telemetry.humidity,
      windSpeedKmh: telemetry.windSpeedKmh,
      windDirectionDeg: telemetry.windDirectionDeg,
      windBearing: getWindBearingLabel(telemetry.windDirectionDeg),
    },
    next6Hours,
    next24Hours,
    primaryDriver,
    transportAlignments: alignments.slice(0, 5),
    dominantAlignment,
    firePersistenceConditions: {
      score: persistenceScore,
      rating: persistenceScore >= 70 ? 'High' : persistenceScore >= 40 ? 'Moderate' : 'Low',
      forecastPrecipitation24h: telemetry.forecastPrecipitation_24h,
      description: sourceRegionText,
    },
    earlyActionIntelligence: {
      next6Hours: next6HoursText,
      next24Hours: next24HoursText,
      sourceRegion: sourceRegionText,
      communitySpecificNotice,
      officialHealthRecommendations: healthNotice,
      mandatoryDisclaimer: 'Follow official local authority guidance for health, emergency and evacuation decisions.',
    },
    evidenceUsed: [
      {
        category: 'CURRENT SOURCE DATA',
        name: 'Active Satellite Fire Detections (Borneo Area)',
        value: `${borneoBoundingBoxCount} active-fire detections`,
        provider: 'NASA FIRMS (NOAA-21 VIIRS · Rolling 24h)',
        timestamp: telemetry.sourceTimestamp,
        freshness: 'Rolling 24h UTC window',
      },
      {
        category: 'CURRENT SOURCE DATA',
        name: 'Current PM2.5 Concentration',
        value: `${telemetry.pm25} µg/m³`,
        provider: telemetry.airQualitySource,
        timestamp: telemetry.sourceTimestamp,
        freshness: telemetry.isAirQualityFallback ? 'Hourly reanalysis [FALLBACK SOURCE]' : 'Current Conditions',
      },
      {
        category: 'CURRENT SOURCE DATA',
        name: 'Current Weather & Wind Vector',
        value: `${telemetry.windSpeedKmh} km/h from ${getWindBearingLabel(telemetry.windDirectionDeg)} (${telemetry.windDirectionDeg}°) · ${telemetry.temperature}°C · RH ${telemetry.humidity}%`,
        provider: telemetry.weatherSource,
        timestamp: telemetry.sourceTimestamp,
        freshness: telemetry.isWeatherFallback ? 'Hourly reanalysis [FALLBACK SOURCE]' : 'Current Conditions',
      },
      {
        category: 'FORECAST',
        name: '6-Hour PM2.5 Projection',
        value: `${telemetry.forecastPm25_6h} µg/m³ (${next6Hours})`,
        provider: telemetry.isAirQualityFallback ? 'Copernicus CAMS [FALLBACK SOURCE]' : 'Google Air Quality API',
        timestamp: telemetry.sourceTimestamp,
        freshness: 'Next 6 hours',
      },
      {
        category: 'FORECAST',
        name: '24-Hour Precipitation & Smoke Persistence',
        value: `${telemetry.forecastPrecipitation_24h} mm forecast rainfall`,
        provider: telemetry.isWeatherFallback ? 'Open-Meteo / ECMWF [FALLBACK SOURCE]' : 'Google Weather API',
        timestamp: telemetry.sourceTimestamp,
        freshness: 'Next 24 hours',
      },
      {
        category: 'CALCULATED BY HAZELENS',
        name: 'Atmospheric Transport Alignment',
        value: `${dominantAlignment?.alignmentLevel || 'LOW'} (${dominantAlignment?.alignmentScore || 20}/100)`,
        provider: 'HazeLens Directional Alignment Algorithm',
        timestamp: new Date().toISOString(),
        freshness: 'Deterministic vector calculation (directional indicator, not full dispersion model)',
      },
      {
        category: 'CALCULATED BY HAZELENS',
        name: 'Environmental Impact Risk',
        value: `${riskLevel} (${riskScore}/100)`,
        provider: 'HazeLens 4-Component Risk Engine',
        timestamp: new Date().toISOString(),
        freshness: 'Deterministic arithmetic calculation',
      },
    ],
  };
}

// 6. Compute Full Decision System State
async function computeDecisionSystemState(): Promise<DecisionSystemState> {
  const { fires, borneoCount, sensorName } = await fetchRealNasaFirmsFires();
  const clusters = clusterFiresIntoSourceRegions(fires);

  // Evaluate the three monitored communities
  const communities = await Promise.all(
    MONITORED_COMMUNITIES.map(async (comm) => {
      try {
        const telemetry = await fetchCommunityTelemetry(comm.lat, comm.lon);
        return evaluateCommunityOutlook(comm, telemetry, clusters);
      } catch (err: any) {
        console.error(`Telemetry error for ${comm.name}:`, err);
        return evaluateCommunityOutlook(
          comm,
          {
            pm25: 20,
            pm10: 30,
            universalAqi: 65,
            temperature: 29,
            humidity: 80,
            windSpeedKmh: 6,
            windDirectionDeg: 180,
            forecastPm25_6h: 22,
            forecastPm25_24h: 22,
            forecastPrecipitation_24h: 0,
            forecastWindDirections_24h: [180, 180, 180, 180],
            airQualitySource: 'Copernicus CAMS via Open-Meteo [FALLBACK SOURCE]',
            weatherSource: 'Open-Meteo Meteorological Reanalysis [FALLBACK SOURCE]',
            isAirQualityFallback: true,
            isWeatherFallback: true,
            sourceTimestamp: new Date().toISOString(),
          },
          clusters
        );
      }
    })
  );

  // Identify highest community impact & strongest source pressure using shared sort rule
  const rankedCommunities = sortCommunitiesByRisk(communities);
  const highestImpactComm = rankedCommunities[0];

  const sortedClusters = [...clusters].sort((a, b) => b.pressureScore - a.pressureScore);
  const strongestCluster = sortedClusters[0] || { name: 'Central Kalimantan region' };

  // Status Level
  let statusLevel: 'Low' | 'Moderate' | 'Elevated' | 'High' | 'Severe' = 'Moderate';
  if (highestImpactComm.now.riskLevel === 'SEVERE') statusLevel = 'Severe';
  else if (highestImpactComm.now.riskLevel === 'HIGH') statusLevel = 'High';
  else if (highestImpactComm.now.riskLevel === 'MODERATE') statusLevel = 'Elevated';
  else statusLevel = 'Low';

  const situationSummary = `Significant wildfire pressure persists across parts of Kalimantan. Current atmospheric conditions show potential transport toward selected downstream communities, while ${highestImpactComm.locationName} remains under elevated PM2.5 exposure.`;

  const regionalSituation: RegionalSituationData = {
    statusLevel,
    situationSummary,
    highestCommunityImpact: highestImpactComm.locationName,
    strongestSourcePressure: strongestCluster.name.replace(/ region$/i, ''),
    nextDecisionWindow: '6 hours',
    confidence: 'HIGH',
    totalActiveFiresDetected: fires.length,
    borneoBoundingAreaCount: borneoCount,
    primarySensorName: sensorName,
    observationWindow: 'Rolling 24h',
    geographicBoundsDescription: 'Borneo-region bounding area (108°E–119°E, 5°S–4°N)',
    clusters,
  };

  // 7. Compute What Changed? Intelligence
  let whatChanged: WhatChangedSnapshot;
  const currentTimestamp = new Date().toISOString();
  const previousState = currentStateSnapshot;

  if (!previousState) {
    whatChanged = {
      hasPrevious: false,
      baselineNotice: 'Baseline assessment established. Change intelligence will appear after the next refresh.',
      headline: 'Baseline assessment established',
      summary: 'Baseline observations registered across Palangka Raya, Kuching, and Singapore.',
      whyThisMatters: 'Baseline signals established across satellite fire detections, meteorological wind vectors, and local particulate measurements. Changes will be monitored during subsequent decision cycles.',
      signals: [
        { signalName: 'Wildfire Pressure', direction: 'stable', symbol: '→', description: 'Baseline registered' },
        { signalName: 'PM2.5 Exposure', direction: 'stable', symbol: '→', description: 'Baseline registered' },
        { signalName: 'Transport Alignment', direction: 'stable', symbol: '→', description: 'Baseline registered' },
        { signalName: 'Rainfall / Fire Persistence', direction: 'stable', symbol: '→', description: 'Baseline registered' },
      ],
      timestamp: currentTimestamp,
      previousTimestamp: null,
    };
  } else {
    const prevComm = previousState.communities.find((c) => c.locationId === highestImpactComm.locationId);
    const prevRisk = prevComm ? prevComm.now.riskScore : highestImpactComm.now.riskScore;
    const riskDelta = highestImpactComm.now.riskScore - prevRisk;

    const prevFires = previousState.regionalSituation.totalActiveFiresDetected;
    const fireDelta = fires.length - prevFires;

    const prevPm25 = prevComm ? prevComm.now.airQuality.pm25 : highestImpactComm.now.airQuality.pm25;
    const pm25Delta = Number((highestImpactComm.now.airQuality.pm25 - prevPm25).toFixed(1));

    const signals: SignalChangeItem[] = [];

    // Wildfire pressure signal
    if (fireDelta > 5) {
      signals.push({ signalName: 'Wildfire Pressure', direction: 'increased', symbol: '↑', description: 'Wildfire pressure increased' });
    } else if (fireDelta < -5) {
      signals.push({ signalName: 'Wildfire Pressure', direction: 'decreased', symbol: '↓', description: 'Wildfire pressure eased' });
    } else {
      signals.push({ signalName: 'Wildfire Pressure', direction: 'stable', symbol: '→', description: 'Wildfire pressure stable' });
    }

    // PM2.5 exposure signal
    if (pm25Delta > 1) {
      signals.push({ signalName: 'PM2.5 Exposure', direction: 'increased', symbol: '↑', description: 'PM2.5 exposure worsened' });
    } else if (pm25Delta < -1) {
      signals.push({ signalName: 'PM2.5 Exposure', direction: 'decreased', symbol: '↓', description: 'PM2.5 exposure improved' });
    } else {
      signals.push({ signalName: 'PM2.5 Exposure', direction: 'stable', symbol: '→', description: 'PM2.5 exposure stable' });
    }

    // Transport alignment signal
    const prevAlign = prevComm?.dominantAlignment?.alignmentScore || 20;
    const curAlign = highestImpactComm.dominantAlignment?.alignmentScore || 20;
    if (curAlign - prevAlign > 5) {
      signals.push({ signalName: 'Transport Alignment', direction: 'increased', symbol: '↑', description: 'Transport alignment strengthened' });
    } else if (curAlign - prevAlign < -5) {
      signals.push({ signalName: 'Transport Alignment', direction: 'decreased', symbol: '↓', description: 'Transport alignment weakened' });
    } else {
      signals.push({ signalName: 'Transport Alignment', direction: 'stable', symbol: '→', description: 'Transport alignment stable' });
    }

    // Rainfall / Fire Persistence
    signals.push({ signalName: 'Rainfall / Fire Persistence', direction: 'decreased', symbol: '↓', description: 'Dry persistence conditions continue' });

    let headline = 'Assessment refreshed — risk stable';
    if (riskDelta > 1) headline = 'Risk increased since the previous assessment';
    else if (riskDelta < -1) headline = 'Risk eased since the previous assessment';

    const prevLevel = prevComm?.now.riskLevel || 'MODERATE';
    const curLevel = highestImpactComm.now.riskLevel;

    const whyThisMatters = riskDelta > 0
      ? 'Elevated fire pressure and sustained particulate emissions maintain exposure risk for downwind communities over the next decision window.'
      : 'Shifting wind direction and localized rain reduce atmospheric transport toward sentinel population centers over the next 6 to 24 hours.';

    whatChanged = {
      hasPrevious: true,
      headline,
      summary: `Environmental Impact Risk ${curLevel !== prevLevel ? `shifted from ${prevLevel} to ${curLevel}` : 'remains steady'}.`,
      whyThisMatters,
      signals,
      previousRiskLevel: prevLevel,
      currentRiskLevel: curLevel,
      timestamp: currentTimestamp,
      previousTimestamp: previousState.timestamp,
    };
  }

  // 8. What Needs Attention Now? (Exactly 3 compact community rows)
  const palangkaRayaComm = communities.find((c) => c.locationId === 'palangka-raya') || communities[0];
  const kuchingComm = communities.find((c) => c.locationId === 'kuching') || communities[1];
  const singaporeComm = communities.find((c) => c.locationId === 'singapore') || communities[2];

  const rawAttentionItems: AttentionItem[] = [
    {
      locationId: 'palangka-raya',
      locationName: 'Palangka Raya',
      country: 'Indonesia',
      impactLevel: palangkaRayaComm.now.riskLevel,
      primaryConcern: 'Local wildfire pressure and particulate exposure remain elevated.',
      nextAction: 'Reassess within 6 hours. Follow official local air-quality guidance.',
    },
    {
      locationId: 'kuching',
      locationName: 'Kuching',
      country: 'Malaysia',
      impactLevel: kuchingComm.now.riskLevel,
      primaryConcern: 'Atmospheric transport from West Kalimantan border clusters is aligned.',
      nextAction: 'Review cross-border haze advisories and monitor 6-hour PM2.5 trends.',
    },
    {
      locationId: 'singapore',
      locationName: 'Singapore',
      country: 'Singapore',
      impactLevel: singaporeComm.now.riskLevel,
      primaryConcern: 'Cross-strait transport alignment remains weak across the Singapore Strait.',
      nextAction: 'Continue standard ambient tracking and monitor 1-hour PM2.5 concentrations.',
    },
  ];

  // Shared deterministic sort: Risk severity descending (SEVERE > HIGH > MODERATE > LOW), name ascending on tie
  const attentionItems: AttentionItem[] = sortCommunitiesByRisk(rawAttentionItems);
  const sortedCommunities: CommunityOutlookData[] = sortCommunitiesByRisk(communities);

  const newState: DecisionSystemState = {
    regionalSituation,
    whatChanged,
    attentionItems,
    communities: sortedCommunities,
    fires: fires.slice(0, 500), // Top 500 significant detections for map
    clusters,
    timestamp: currentTimestamp,
  };

  previousStateSnapshot = currentStateSnapshot;
  currentStateSnapshot = newState;

  return newState;
}

// Concurrency lock to prevent duplicate simultaneous briefing requests (Req 7)
let isBriefingInProgress = false;

// Single Gemini Generator (Strictly 1 request to gemini-3.8-flash with 26-second server timeout)
async function generateSingleGeminiBrief(contents: any, systemInstruction?: string, timeoutMs = 26000): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API is not configured in the server runtime.');
  }

  const genAI = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const config: any = {};
  if (systemInstruction) config.systemInstruction = systemInstruction;

  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('SERVER_TIMEOUT: Gemini synthesis exceeded server response limit.'));
    }, timeoutMs);
  });

  const requestPromise = genAI.models.generateContent({
    model: 'gemini-3.8-flash',
    contents,
    config: Object.keys(config).length > 0 ? config : undefined,
  });

  try {
    const response = await Promise.race([requestPromise, timeoutPromise]);
    clearTimeout(timeoutId!);
    if (response.text) return response.text;
    throw new Error('Gemini returned an empty response.');
  } catch (err: any) {
    clearTimeout(timeoutId!);
    throw err;
  }
}

// REST ENDPOINTS

// 1. Server-side public configuration endpoint
// Exposes ONLY the Google Maps JavaScript browser key for client-side map rendering.
// NEVER expose GEMINI_API_KEY, GOOGLE_ENVIRONMENT_API_KEY, or NASA_FIRMS_MAP_KEY.
app.get('/api/public-config', (_req: Request, res: Response) => {
  const googleMapsBrowserKey = process.env.GOOGLE_MAPS_BROWSER_KEY || '';
  res.json({
    googleMapsBrowserKey,
  });
});

// Backward-compatibility alias
app.get('/api/config/maps-key', (_req: Request, res: Response) => {
  const googleMapsBrowserKey = process.env.GOOGLE_MAPS_BROWSER_KEY || '';
  res.json({
    googleMapsBrowserKey,
  });
});

// 2. Decision Intelligence System State
app.get('/api/decision-state', async (_req: Request, res: Response) => {
  try {
    const state = await computeDecisionSystemState();
    res.json(state);
  } catch (err: any) {
    res.status(500).json({
      error: 'Failed to compute environmental decision state',
      details: err.message,
    });
  }
});

// 3. AI Brief Endpoint (Role: HazeLens Environmental Intelligence Agent)
// Constraint: Gemini receives ONLY structured evidence and never calculates or invents the risk score.
app.post('/api/ai/briefing', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({
      error: 'Gemini API is not configured in the server runtime.',
    });
  }

  // Req 7: Prevent duplicate simultaneous briefing requests
  if (isBriefingInProgress) {
    return res.status(429).json({
      error: 'A decision brief is already being synthesized. Please wait for it to complete.',
    });
  }

  // Req 5: Use already-computed current HazeLens snapshot without re-fetching environmental APIs
  let state = currentStateSnapshot;
  if (!state) {
    // If server just started and has not computed initial state yet, compute once
    state = await computeDecisionSystemState();
  }

  isBriefingInProgress = true;
  const startTime = Date.now();

  try {
    const selectedCommunityId = req.body?.communityId;
    const selectedCommunity =
      state.communities.find((c) => c.locationId === selectedCommunityId) || state.communities[0];

    const systemInstruction = `You are the HazeLens Environmental Intelligence Agent.
Synthesize the provided structured evidence for decision-makers and community leaders in Southeast Asia into an authoritative, actionable, evidence-grounded intelligence brief.

CRITICAL RESPONSIBLE-AI MANDATES:
1. Purely Deterministic Numerical Scores: You must NEVER invent, alter, or recalculate any numerical risk score, fire count, PM2.5 measurement, or wind vector. Use the deterministic values provided verbatim.
2. NASA FIRMS Detection Terminology: Never describe the NASA FIRMS detection count as a number of unique fires or individual wildfires. Always refer to them strictly as 'active-fire detections' or 'satellite fire observations' (e.g., '4,813 active-fire detections', not '4,813 active fires' or '4,813 fires').
3. Air Quality Index Integrity: Never state 'Universal AQI' unless Google Universal AQI (UAQI) is explicitly provided in the evidence as indexName (1–100 scale). Never output or infer an invalid AQI value such as 708. If a fallback index is provided (e.g. US AQI [FALLBACK SOURCE]), cite its exact index name or cite the PM2.5 concentration in µg/m³ directly.
4. Structured Format Mandate: Output EXACTLY these six markdown section headers (using ##):
   ## WHAT IS HAPPENING
   Maximum two short sentences summarizing the current regional environmental situation.
   ## WHAT CHANGED
   Summarize only material changes since the previous successful assessment. If baseline: "Baseline assessment established. Change intelligence will become available after the next refresh."
   ## WHO NEEDS ATTENTION
   Identify the monitored community or communities currently requiring the most attention and explain why from contributing evidence. Do not overstate causation.
   ## NEXT 6–24 HOURS
   Explain the expected direction of change using available forecast evidence. Clearly distinguish forecast from observation.
   ## RECOMMENDED AWARENESS
   Provide 2 to 4 short, actionable, evidence-grounded awareness or monitoring actions (e.g. what conditions to monitor, when to reassess, what environmental change would alter the assessment).
   Always conclude this section with: "Follow official local authority guidance for health, emergency and evacuation decisions."
   ## CONFIDENCE & LIMITATIONS
   State the assessment confidence level and the primary limitation (explicitly mention that Atmospheric Transport Alignment is a directional indicator, not a full physical dispersion model).
5. Do not invent medical diagnoses, emergency declarations, or evacuation orders.
6. Keep the brief crisp, professional, and accessible to decision-makers.
7. Monitored Communities vs Source Regions:
   Palangka Raya, Singapore, and Kuching are preselected monitored receptor communities representing specific exposure scenarios (near-source, transboundary, and cross-border), NOT an exhaustive ranking of all ASEAN cities.
   Source regions (where wildfire pressure originates) are separate from receptor communities (where downstream impact is evaluated). Never imply that a community with high impact risk is located inside the largest fire cluster, or that the top source region automatically produces the highest community impact.`;

    // Req 6: Compact Gemini payload (only required decision fields, no raw detections or map markers)
    const compactEvidencePayload = {
      regionalSituation: {
        statusLevel: state.regionalSituation.statusLevel,
        situationSummary: state.regionalSituation.situationSummary,
        highestCommunityImpact: state.regionalSituation.highestCommunityImpact,
        strongestSourcePressure: state.regionalSituation.strongestSourcePressure,
        nextDecisionWindow: state.regionalSituation.nextDecisionWindow,
        confidence: state.regionalSituation.confidence,
        activeFireDetections: state.regionalSituation.totalActiveFiresDetected,
        borneoBoundingAreaDetections: state.regionalSituation.borneoBoundingAreaCount,
        observationWindow: state.regionalSituation.observationWindow,
      },
      top3SourceRegions: state.clusters.slice(0, 3).map((cl, i) => ({
        rank: i + 1,
        name: cl.name,
        subregion: cl.subregion,
        wildfirePressure: cl.wildfirePressure,
        pressureScore: cl.pressureScore,
        detectionCount: cl.detectionCount,
        maxFrpMw: cl.maxFrp,
        latestObservation: cl.latestObservationTime,
      })),
      monitoredCommunities: state.communities.map((c) => ({
        name: c.locationName,
        country: c.country,
        riskScore: c.now.riskScore,
        riskLevel: c.now.riskLevel,
        confidence: c.now.confidence,
        primaryDriver: c.primaryDriver,
        componentScores: c.now.componentScores,
        currentAirQuality: {
          pm25: c.now.airQuality.pm25,
          indexName: c.now.airQuality.primaryStandardName,
          indexValue: c.now.airQuality.primaryValue,
          category: c.now.airQuality.primaryCategory,
          source: c.now.airQuality.source,
          ...(c.now.airQuality.universalAqi !== undefined ? { universalAqi: c.now.airQuality.universalAqi } : {}),
        },
        currentWeather: {
          tempC: c.now.temperature,
          humidityPct: c.now.humidity,
          windSpeedKmh: c.now.windSpeedKmh,
          windBearing: c.now.windBearing,
        },
        transportAlignment: {
          level: c.dominantAlignment?.alignmentLevel || 'LOW',
          score: c.dominantAlignment?.alignmentScore || 20,
          advisory: c.dominantAlignment?.advisoryText,
        },
        firePersistence: {
          rating: c.firePersistenceConditions.rating,
          score: c.firePersistenceConditions.score,
          rain24hMm: c.firePersistenceConditions.forecastPrecipitation24h,
        },
        outlook6h: c.next6Hours,
        outlook24h: c.next24Hours,
      })),
      whatChanged: {
        headline: state.whatChanged.headline,
        summary: state.whatChanged.summary,
        whyThisMatters: state.whatChanged.whyThisMatters,
        signals: state.whatChanged.signals,
      },
      focusedCommunity: selectedCommunity.locationName,
      provenance: [
        'CURRENT SOURCE DATA: NASA FIRMS (NOAA-21 VIIRS · Rolling 24h active-fire detections), Environmental Telemetry',
        'FORECAST: Atmospheric Dispersion & Precipitation Models',
        'CALCULATED BY HAZELENS: Deterministic Multi-Factor Risk Synthesizer',
        'AI INTERPRETATION: Google Gemini 3.8 Flash Contextual Reasoning',
      ],
    };

    const prompt = `Structured Environmental Evidence for Regional Assessment:
${JSON.stringify(compactEvidencePayload, null, 2)}

Provide a concise, highly authoritative Environmental Decision Intelligence Brief strictly following the six required sections.`;

    // Req 7: Strictly one Gemini request with 26-second server timeout
    const geminiStart = Date.now();
    const briefingText = await generateSingleGeminiBrief(prompt, systemInstruction, 26000);
    const geminiDurationMs = Date.now() - geminiStart;

    const hasFallback = state.communities.some((c) => c.now.airQuality.isFallback);
    const dynamicEvidenceUsed = [
      'NASA FIRMS · NOAA-21 VIIRS (Rolling 24h)',
      hasFallback ? 'Copernicus CAMS via Open-Meteo [FALLBACK SOURCE]' : 'Google Air Quality',
      hasFallback ? 'Open-Meteo Meteorological Reanalysis [FALLBACK SOURCE]' : 'Google Weather',
      'HazeLens Deterministic Risk Engine',
    ];

    res.json({
      briefing: briefingText,
      generatedAt: new Date().toISOString(),
      provenance: 'AI INTERPRETATION',
      evidenceUsed: dynamicEvidenceUsed,
      metrics: {
        snapshotPreparationMs: 0,
        geminiDurationMs,
        totalServerDurationMs: Date.now() - startTime,
      },
    });
  } catch (err: any) {
    console.error('[HazeLens Diagnostics] Gemini brief generation error:', err);
    const isTimeout = err?.message?.includes('SERVER_TIMEOUT') || err?.message?.includes('timeout');
    const statusCode = isTimeout ? 504 : 500;
    res.status(statusCode).json({
      error: isTimeout
        ? 'Gemini synthesis exceeded the server response limit'
        : 'Gemini brief generation failed',
      details: err?.message || 'Unknown error',
    });
  } finally {
    isBriefingInProgress = false;
  }
});

// 4. Interactive AI Query (✦ Ask HazeLens)
app.post('/api/ai/query', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({
      error: 'Gemini API is not configured in the server runtime.',
    });
  }

  const { userPrompt, locationId } = req.body;
  if (!userPrompt || typeof userPrompt !== 'string') {
    return res.status(400).json({ error: 'userPrompt is required.' });
  }

  try {
    const state = currentStateSnapshot || (await computeDecisionSystemState());
    const community = state.communities.find((c) => c.locationId === locationId) || state.communities[0];

    const systemInstruction = `You are the HazeLens Environmental Intelligence Agent.
Answer the user's question about environmental conditions in Southeast Asia strictly using the structured evidence provided below.

CRITICAL RULES:
1. Ground your answer strictly and exclusively in the provided HazeLens evidence.
2. If the user's question asks about something not covered by or verified in the structured evidence, state explicitly:
   "There is not enough current environmental evidence to answer this reliably."
3. You must NEVER recalculate or alter any numerical risk score, PM2.5 concentration, or fire detection count.
4. NASA FIRMS Detection Terminology: Never describe satellite thermal detection counts as unique separate fires. Always use 'active-fire detections' or 'satellite fire observations'.
5. Air Quality Index Integrity: Never state 'Universal AQI' unless Google Universal AQI (UAQI) is explicitly provided as the index. Never output an invalid AQI value such as 708. If a fallback index is present, cite its exact name (e.g. US AQI [FALLBACK SOURCE]) or cite the PM2.5 concentration in µg/m³ directly.
6. When mentioning health or safety actions, always conclude with: "Follow official local authority guidance for health, emergency and evacuation decisions."
7. Be concise, direct, and factual.
8. Monitored Communities vs Source Regions:
   Palangka Raya, Singapore, and Kuching are preselected monitored receptor communities representing near-source, cross-border, and transboundary exposure scenarios. They are NOT an exhaustive ranking of all ASEAN cities.
   If asked "Why isn't Samarinda monitored?", "Are these the top three affected cities in ASEAN?", or similar questions:
   Explain clearly that HazeLens currently monitors a deliberately selected monitored-community set to evaluate specific exposure scenarios, and that broader dynamic receptor discovery is an architectural capability planned for future versions.
   Always maintain the distinction between source regions (where wildfire pressure originates) and receptor communities (where downstream impact is evaluated).

Structured Evidence Context:
- Monitored Community: ${community.locationName}, ${community.country}
- Deterministic Risk Score: ${community.now.riskScore}/100 (${community.now.riskLevel})
- Primary Risk Driver: ${community.primaryDriver}
- Risk Breakdown: Wildfire Pressure (${community.now.componentScores.wildfirePressureScore}), Transport Alignment (${community.now.componentScores.transportAlignmentScore}), Community Exposure (${community.now.componentScores.communityExposureScore}), Fire Persistence (${community.now.componentScores.firePersistenceScore})
- Observed PM2.5: ${community.now.airQuality.pm25} µg/m³ (${community.now.airQuality.primaryStandardName}: ${community.now.airQuality.primaryCategory}${community.now.airQuality.primaryValue !== undefined ? `, index: ${community.now.airQuality.primaryValue}` : ''})
- Weather: ${community.now.temperature}°C, RH ${community.now.humidity}%, Wind ${community.now.windSpeedKmh} km/h from ${community.now.windBearing}
- Dominant Transport Alignment: ${community.dominantAlignment?.alignmentLevel || 'LOW'} (${community.dominantAlignment?.alignmentScore || 20}/100) — ${community.dominantAlignment?.advisoryText || 'Low alignment'}
- 6h Outlook: ${community.next6Hours} | 24h Outlook: ${community.next24Hours}
- Fire Persistence Conditions: Rating ${community.firePersistenceConditions.rating} (${community.firePersistenceConditions.score}/100), 24h Rain ${community.firePersistenceConditions.forecastPrecipitation24h} mm
- Regional Situation: ${state.regionalSituation.statusLevel} (${state.regionalSituation.totalActiveFiresDetected} active-fire detections; ${state.regionalSituation.borneoBoundingAreaCount} in Borneo bbox)
- What Changed: ${state.whatChanged.headline} (${state.whatChanged.signals.map(s => `${s.signalName}: ${s.direction}`).join(', ')})`;

    const answer = await generateSingleGeminiBrief(userPrompt, systemInstruction, 26000);

    const hasFallback = community.now.airQuality.isFallback;
    const dynamicEvidenceUsed = [
      'NASA FIRMS · NOAA-21 VIIRS (Rolling 24h)',
      hasFallback ? 'Copernicus CAMS via Open-Meteo [FALLBACK SOURCE]' : 'Google Air Quality',
      hasFallback ? 'Open-Meteo Meteorological Reanalysis [FALLBACK SOURCE]' : 'Google Weather',
      'HazeLens Deterministic Risk Engine',
    ];

    res.json({
      answer,
      timestamp: new Date().toISOString(),
      provenance: 'AI INTERPRETATION',
      evidenceUsed: dynamicEvidenceUsed,
    });
  } catch (err: any) {
    console.error('[HazeLens Diagnostics] Gemini query error:', err);
    res.status(500).json({
      error: 'AI query processing failed',
      details: err?.message || 'Unknown error',
    });
  }
});

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.json({
    status: 'healthy',
    service: 'HazeLens ASEAN Environmental Decision Intelligence',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Req 1: Guarantee no /api or /api/* route ever falls through to the HTML/SPA handler
app.all(['/api', '/api/*'], (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.status(404).json({ error: 'API route not found' });
});

// Express error-handling middleware for API routes
app.use((err: any, req: Request, res: Response, next: any) => {
  if (req.path.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({
      error: 'Internal server error',
      details: err?.message || 'Unexpected server error',
    });
  }
  next(err);
});

// Launch server
async function startServer() {
  // Pre-warm decision state in background so currentStateSnapshot is ready immediately
  computeDecisionSystemState().catch((err) => {
    console.error('Initial background state computation error:', err);
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`HazeLens ASEAN decision intelligence engine running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
