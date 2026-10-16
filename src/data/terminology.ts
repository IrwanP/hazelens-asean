export interface TermDefinition {
  id: string;
  term: string;
  shortDefinition: string;
  category: 'Remote Sensing' | 'Air Quality & Exposure' | 'HazeLens Analytics' | 'Decision Protocol';
  citizenFriendlyNote?: string;
}

export const TERMINOLOGY_GLOSSARY: Record<string, TermDefinition> = {
  'NASA FIRMS': {
    id: 'NASA FIRMS',
    term: 'NASA FIRMS',
    category: 'Remote Sensing',
    shortDefinition: "NASA's satellite-based system for near-real-time active-fire and thermal-anomaly information.",
    citizenFriendlyNote: "Provides near-real-time active-fire data across Southeast Asia within 3 hours of satellite overpass.",
  },
  'NOAA-21': {
    id: 'NOAA-21',
    term: 'NOAA-21',
    category: 'Remote Sensing',
    shortDefinition: "An environmental satellite carrying the VIIRS Earth-observation sensor.",
    citizenFriendlyNote: "Part of the Joint Polar Satellite System (JPSS-2), orbiting Earth to capture high-resolution imagery.",
  },
  'VIIRS': {
    id: 'VIIRS',
    term: 'VIIRS',
    category: 'Remote Sensing',
    shortDefinition: "A satellite sensor that detects thermal anomalies associated with active burning.",
    citizenFriendlyNote: "The Visible Infrared Imaging Radiometer Suite detects thermal anomalies at 375-meter spatial resolution.",
  },
  'Active-fire detection': {
    id: 'Active-fire detection',
    term: 'Active-Fire Detection',
    category: 'Remote Sensing',
    shortDefinition: "A satellite-observed thermal anomaly that may indicate active burning. It does not necessarily represent a separate wildfire.",
    citizenFriendlyNote: "Each pixel anomaly reflects thermal output in that area; large fires often generate multiple detection points.",
  },
  'FRP': {
    id: 'FRP',
    term: 'FRP (Fire Radiative Power)',
    category: 'Remote Sensing',
    shortDefinition: "Fire Radiative Power, an indicator of the heat energy emitted by a detected fire.",
    citizenFriendlyNote: "Higher FRP indicates more intense combustion and greater smoke and particulate emissions.",
  },
  'PM2.5': {
    id: 'PM2.5',
    term: 'PM2.5',
    category: 'Air Quality & Exposure',
    shortDefinition: "Fine airborne particles smaller than 2.5 micrometers (μm) and an important indicator of smoke-related exposure.",
    citizenFriendlyNote: "Due to their tiny size, these particles can penetrate deep into lungs and enter the bloodstream.",
  },
  'PM10': {
    id: 'PM10',
    term: 'PM10',
    category: 'Air Quality & Exposure',
    shortDefinition: "Inhalable airborne particles with diameters 10 μm and smaller, including dust, pollen, and coarse smoke particles.",
    citizenFriendlyNote: "Coarser than PM2.5, causing respiratory irritation in nose, throat, and upper airways.",
  },
  'PSI': {
    id: 'PSI',
    term: 'PSI (Pollutant Standards Index)',
    category: 'Air Quality & Exposure',
    shortDefinition: "Singapore’s Pollutant Standards Index for communicating overall air-quality conditions.",
    citizenFriendlyNote: "Calculated from 24-hour pollutant measurements including PM2.5, PM10, ozone, and sulfur dioxide.",
  },
  'Universal AQI': {
    id: 'Universal AQI',
    term: 'Universal AQI',
    category: 'Air Quality & Exposure',
    shortDefinition: "A standardized air-quality index mapping multiple pollutant concentrations onto a unified 0–500 scale.",
    citizenFriendlyNote: "Allows consistent comparison across international borders, regardless of regional reporting differences.",
  },
  'Transport Alignment': {
    id: 'Transport Alignment',
    term: 'Transport Alignment',
    category: 'HazeLens Analytics',
    shortDefinition: "How closely forecast wind conditions align with potential smoke movement from a source region toward a monitored community.",
    citizenFriendlyNote: "A high alignment score indicates wind trajectory directly channels smoke toward receptor populations.",
  },
  'Wildfire Pressure': {
    id: 'Wildfire Pressure',
    term: 'Wildfire Pressure',
    category: 'HazeLens Analytics',
    shortDefinition: "A measure of active fire intensity, density, and proximity calculated from satellite thermal observations.",
    citizenFriendlyNote: "Reflects how severely a landscape is burning and the potential volume of smoke being generated.",
  },
  'Fire Persistence': {
    id: 'Fire Persistence',
    term: 'Fire Persistence',
    category: 'HazeLens Analytics',
    shortDefinition: "An assessment of meteorological conditions like dry weather, low humidity, and lack of rain that allow fires to keep burning.",
    citizenFriendlyNote: "High persistence means fires are unlikely to be extinguished naturally by weather in the near term.",
  },
  'Environmental Impact Risk': {
    id: 'Environmental Impact Risk',
    term: 'Environmental Impact Risk',
    category: 'HazeLens Analytics',
    shortDefinition: "HazeLens’ deterministic assessment combining wildfire pressure, atmospheric transport, community exposure, and fire-persistence conditions.",
    citizenFriendlyNote: "Authoritative mathematical score (0–100) that synthesizes multi-source telemetry without generative distortion.",
  },
  'Decision Window': {
    id: 'Decision Window',
    term: 'Decision Window',
    category: 'Decision Protocol',
    shortDefinition: "The critical advance timeframe (typically 6–24 hours) during which preventative decisions can be taken before conditions peak.",
    citizenFriendlyNote: "Provides operational lead time for school closures, air filtration setup, and medical preparedness.",
  },
  'Monitored Communities': {
    id: 'Monitored Communities',
    term: 'Monitored Communities',
    category: 'Decision Protocol',
    shortDefinition: "Selected communities monitored across different exposure scenarios. They are not an exhaustive ranking of all ASEAN communities.",
    citizenFriendlyNote: "Palangka Raya, Singapore, and Kuching represent near-source, transboundary, and cross-border exposure scenarios.",
  },
  'Monitored Sentinel Communities': {
    id: 'Monitored Sentinel Communities',
    term: 'Monitored Communities',
    category: 'Decision Protocol',
    shortDefinition: "Selected communities monitored across different exposure scenarios. They are not an exhaustive ranking of all ASEAN communities.",
    citizenFriendlyNote: "Palangka Raya, Singapore, and Kuching represent near-source, transboundary, and cross-border exposure scenarios.",
  },
  'Active Source Regions': {
    id: 'Active Source Regions',
    term: 'Active Source Regions',
    category: 'HazeLens Analytics',
    shortDefinition: "Areas where satellite-observed fire activity creates wildfire pressure. Source-region ranking is separate from community impact ranking.",
    citizenFriendlyNote: "Source regions show where wildfire pressure originates; monitored communities show where downstream environmental impact may matter.",
  },
};

export function getTermDefinition(term: string): TermDefinition | undefined {
  if (TERMINOLOGY_GLOSSARY[term]) {
    return TERMINOLOGY_GLOSSARY[term];
  }
  const clean = term.trim().toLowerCase();
  for (const [key, def] of Object.entries(TERMINOLOGY_GLOSSARY)) {
    if (key.toLowerCase() === clean || def.term.toLowerCase() === clean) {
      return def;
    }
  }
  return undefined;
}
