# HazeLens ASEAN

### Environmental Decision Intelligence for Southeast Asia

**From environmental signals to early action.**

> **HazeLens calculates. Gemini interprets.**

HazeLens ASEAN is an environmental decision-intelligence application designed to connect near-real-time wildfire, weather, air-quality, geospatial, and forecast signals into a transparent workflow for early situational awareness across Southeast Asia.

Rather than functioning as another hotspot or air-quality dashboard, HazeLens helps users understand:

> **Where is pressure originating?**  
> **Can it move toward communities?**  
> **Who are we monitoring?**  
> **Who needs attention?**  
> **What should users watch next?**

---

# Live Application

## HazeLens ASEAN on Google Cloud Run

https://hazelens-asean-526896189680.asia-southeast1.run.app

Deployment region:

`asia-southeast1`

---

# 1. The Problem

Transboundary haze is not a single-signal problem.

A satellite hotspot map can show where thermal anomalies exist, but that alone does not answer the operational questions decision makers need:

- Where is the strongest current wildfire pressure originating?
- Are atmospheric conditions compatible with movement toward populated areas?
- Which monitored communities may experience the greatest environmental impact?
- Is the situation improving, stable, or deteriorating?
- When should conditions be reassessed?
- Which observations support the assessment?
- How can AI help explain the situation without inventing or altering numerical risk?

Relevant information is usually fragmented across:

- satellite active-fire observations,
- weather conditions,
- air-quality measurements,
- forecasts,
- source-to-community geography,
- environmental indices,
- and different data providers.

The result is an **interpretation gap between raw environmental data and actionable situational awareness**.

HazeLens ASEAN was built to reduce that gap.

---

# 2. The Solution

HazeLens ASEAN converts fragmented environmental signals into a structured decision-intelligence workflow.

The core decision chain is:

**SOURCE → TRANSPORT → EXPOSURE → IMPACT → ACTION**

The application answers five questions.

## 1. Where is pressure originating?

### Active Source Regions

NASA FIRMS active-fire detections are grouped into source regions to identify where current wildfire pressure is strongest.

---

## 2. Can it move toward communities?

### Atmospheric Transport Alignment

HazeLens compares:

- source-to-community geometry,
- wind direction,
- transport direction,
- angular compatibility,
- and relevant weather conditions.

This creates a deterministic directional indicator of whether atmospheric conditions are compatible with movement toward a monitored community.

It is intentionally **not presented as a full atmospheric dispersion model**.

---

## 3. Who are we monitoring?

### Monitored Communities

The current prototype monitors three deliberately selected communities representing different exposure scenarios:

- **Palangka Raya, Indonesia** - Near-source exposure
- **Singapore** - Transboundary receptor
- **Kuching, Malaysia** - Cross-border receptor

These are selected monitoring scenarios.

They are **not an exhaustive ranking of all ASEAN cities or communities**.

---

## 4. Who needs attention?

### Environmental Impact Risk

HazeLens calculates a deterministic Environmental Impact Risk score for each monitored community.

The score is derived from four components:

- Wildfire Pressure
- Atmospheric Transport Alignment
- Community Exposure
- Fire Persistence

Gemini does not calculate or alter these numerical scores.

---

## 5. What should users watch next?

### Decision Window + Gemini Environmental Intelligence

HazeLens identifies what should be reassessed over the next decision window.

Gemini then interprets the structured evidence and produces:

- an evidence-grounded decision brief,
- contextual explanations,
- recommended awareness,
- confidence and limitations,
- and interactive Ask HazeLens responses.

---

# 3. Why HazeLens Is More Than a Dashboard

Traditional environmental dashboards primarily answer:

> **What is happening now?**

HazeLens is designed to go further:

> **What does the evidence mean, who may need attention, why, and what should we monitor next?**

The application combines:

- wildfire source-pressure detection,
- monitored-community assessment,
- atmospheric transport reasoning,
- current environmental conditions,
- forecast conditions,
- deterministic risk scoring,
- change intelligence,
- data provenance,
- geospatial visualization,
- and Gemini-powered interpretation.

The objective is not to replace environmental authorities.

The objective is to provide a transparent **decision-intelligence layer between environmental data and human action**.

---

# 4. Core User Journey

HazeLens ASEAN is organized into four main application views.

---

## Situation

The Situation view provides the regional environmental picture.

Users can inspect:

- Regional Environmental Situation
- strongest wildfire source regions
- NASA FIRMS active-fire detections
- monitored communities
- transport vectors
- what changed since the previous assessment
- current decision window
- regional evidence map

The screen deliberately separates:

**where wildfire pressure originates**

from:

**where downstream community impact may matter**

---

## Communities

The Communities view compares the monitored receptor communities.

Each community includes:

- Environmental Impact Risk
- deterministic numerical score
- confidence level
- 6-hour outlook
- 24-hour outlook
- primary risk driver
- exposure scenario
- recommended monitoring action
- evidence access

Communities are ordered by risk severity.

If two communities have the same severity level, they are ordered alphabetically.

---

## AI Brief

The AI Brief view provides:

### Gemini Environmental Intelligence

Gemini synthesizes the structured HazeLens snapshot into an evidence-grounded decision brief.

The brief is organized into:

- **WHAT IS HAPPENING**
- **WHAT CHANGED**
- **WHO NEEDS ATTENTION**
- **NEXT 6-24 HOURS**
- **RECOMMENDED AWARENESS**
- **CONFIDENCE & LIMITATIONS**

The same screen also provides:

### Ask HazeLens

Users can ask questions about the evidence behind the current assessment.

Examples include:

- Why is Palangka Raya at HIGH risk?
- Which source region is driving wildfire pressure?
- What changed since the previous assessment?
- What could cause the situation to improve?
- What should communities monitor during the next six hours?
- What evidence supports this recommendation?

---

## Evidence

The Evidence view exposes the provenance and reasoning boundary behind the assessment.

It separates data and outputs into four canonical provenance categories:

- **CURRENT SOURCE DATA**
- **FORECAST**
- **CALCULATED BY HAZELENS**
- **AI INTERPRETATION**

This allows users to distinguish:

- external environmental data,
- upstream forecasts,
- deterministic HazeLens calculations,
- and Gemini-generated interpretation.

---

# 5. Environmental Data Sources

Data provenance is a core design principle of HazeLens ASEAN.

---

# NASA FIRMS

Primary wildfire source:

**NASA FIRMS Active-Fire Detections**

Dataset:

`VIIRS_NOAA21_NRT`

Citizen-facing terminology:

**NOAA-21 VIIRS · Near Real-Time · Rolling 24h**

---

## NASA FIRMS

NASA FIRMS is NASA's satellite-based system for near-real-time active-fire and thermal-anomaly information.

---

## NOAA-21

NOAA-21 is an environmental satellite carrying the VIIRS Earth-observation sensor.

---

## VIIRS

VIIRS is a satellite sensor capable of detecting thermal anomalies associated with active burning.

---

## Active-Fire Detection

An active-fire detection represents a satellite-observed thermal anomaly that may indicate active burning.

An individual detection does **not necessarily represent a separate or unique wildfire**.

HazeLens therefore uses the terms:

- **active-fire detections**
- **satellite fire observations**

instead of treating each detection as a unique fire.

---

## FRP

**Fire Radiative Power**

FRP is an indicator of the heat energy emitted by a detected fire.

HazeLens uses detection density and FRP characteristics as part of the assessment of wildfire source pressure.

---

# 6. True Rolling 24-Hour Fire Window

HazeLens does not assume that a one-day FIRMS response automatically represents the previous rolling 24 hours.

The ingestion process:

1. requests recent NOAA-21 VIIRS observations,
2. reconstructs acquisition timestamps from `acq_date` and `acq_time`,
3. normalizes timestamps to UTC,
4. retains only observations inside the previous rolling 24 hours,
5. replaces the active dataset atomically during refresh.

This avoids:

- stale observations,
- duplicate accumulation,
- repeated records across refreshes,
- and misleading headline counts.

---

# 7. Air Quality

Preferred primary source:

**Google Air Quality API**

When available, it provides environmental information such as:

- PM2.5
- PM10
- Universal AQI
- supported local AQ indices
- pollutant concentrations
- forecast air-quality information

HazeLens preserves the identity of the actual air-quality index returned by the source.

For example:

**Google Universal AQI**

is not treated as equivalent to:

- US AQI,
- PSI,
- ISPU,
- or another local index.

HazeLens does not relabel one AQI methodology as another.

---

# 8. Air-Quality Fallback Integrity

When the preferred environmental source is unavailable, HazeLens can use an explicit fallback source.

Fallback data is always labeled:

`[FALLBACK SOURCE]`

For example:

`US AQI [FALLBACK SOURCE]`

A fallback US AQI value is never labeled as Google Universal AQI.

The application also avoids interpreting a raw PM2.5 concentration as though it were itself an official AQI score.

---

# 9. Weather

Preferred primary source:

**Google Weather API**

It can provide environmental variables needed by HazeLens, including:

- wind direction,
- wind speed,
- relative humidity,
- precipitation,
- forecast wind,
- forecast precipitation.

These weather signals are used in the deterministic HazeLens calculations.

---

# 10. Environmental Fallback Strategy

The application is designed to degrade transparently rather than fail silently.

Fallback environmental sources may include:

- **Copernicus CAMS via Open-Meteo**
- **Open-Meteo meteorological data**
- **ECMWF-derived forecast information via Open-Meteo**

Fallback data is explicitly identified with:

`[FALLBACK SOURCE]`

HazeLens does not intentionally present fallback data as though it came from the preferred Google environmental source.

---

# 11. Google Maps

HazeLens uses:

**Google Maps JavaScript API**

The map provides geospatial visualization for:

- active-fire detections,
- source clusters,
- monitored communities,
- transport vectors,
- regional geographic context.

Google Maps is a visualization layer.

It is **not treated as an environmental risk-data source**.

---

# 12. Source Regions vs Monitored Communities

One of the most important design principles in HazeLens is the separation of:

## Source Pressure

> **Where is wildfire pressure originating?**

from:

## Community Impact

> **Where may environmental impact matter?**

A source region can contain a very large number of active-fire detections without automatically becoming the community with the highest Environmental Impact Risk.

This distinction prevents HazeLens from confusing:

**fire intensity**

with:

**community exposure risk**

For example, a major source region in South Sumatra may generate very high wildfire pressure while Palangka Raya may still require greater community attention because of local environmental exposure.

---

# 13. Why Palangka Raya, Singapore and Kuching?

The three current communities represent different environmental exposure scenarios.

---

## Palangka Raya

**Near-Source**

Palangka Raya represents a monitored community located close to important fire-prone regions in Central Kalimantan.

This allows HazeLens to demonstrate near-source exposure reasoning.

---

## Singapore

**Transboundary**

Singapore represents a downstream urban receptor separated from major source regions by international boundaries and maritime geography.

This allows the application to demonstrate transboundary haze reasoning.

---

## Kuching

**Cross-Border**

Kuching represents a Malaysian receptor near the Kalimantan-Sarawak border.

This supports cross-border atmospheric transport scenarios.

---

These three locations are monitored scenarios, not claims that they are always the three most affected locations in Southeast Asia.

Future implementations can expand the monitored-community registry dynamically.

---

# 14. Deterministic HazeLens Risk Engine

The numerical Environmental Impact Risk is calculated by HazeLens.

It is not generated by Gemini.

The current deterministic model uses four weighted components:

| Component | Weight |
|---|---:|
| Wildfire Pressure | 30% |
| Atmospheric Transport Alignment | 25% |
| Community Exposure | 30% |
| Fire Persistence | 15% |

These components are combined into the current:

**Environmental Impact Risk**

for each monitored community.

---

# 15. Wildfire Pressure

Wildfire Pressure represents the intensity of relevant fire activity.

Signals can include:

- active-fire detection density,
- source proximity,
- FRP characteristics,
- source-region concentration,
- source activity persistence.

Wildfire Pressure is calculated by HazeLens.

It is not an AI-generated value.

---

# 16. Atmospheric Transport Alignment

Atmospheric Transport Alignment measures the directional compatibility between wildfire source regions and monitored communities.

The calculation can consider:

- source-to-community bearing,
- current wind direction,
- transport direction,
- angular difference,
- wind conditions.

Important modelling boundary:

> **Atmospheric Transport Alignment indicates directional compatibility between source-to-community geometry and weather conditions. It is not a full atmospheric dispersion model.**

This is intentionally stated in the application to avoid overstating model capability.

---

# 17. Community Exposure

Community Exposure represents the environmental conditions affecting a monitored receptor community.

Signals can include:

- PM2.5,
- PM10,
- valid air-quality indices,
- current environmental conditions.

Community Exposure remains part of the deterministic HazeLens model.

---

# 18. Fire Persistence

Fire Persistence represents the likelihood that current wildfire pressure may continue given:

- current source activity,
- rainfall,
- weather conditions,
- relevant forecast signals.

It remains a deterministic HazeLens indicator rather than a Gemini-generated value.

---

# 19. Environmental Impact Risk

Environmental Impact Risk combines the four deterministic components:

**Wildfire Pressure**

+

**Atmospheric Transport Alignment**

+

**Community Exposure**

+

**Fire Persistence**

The score is then mapped to the application's current risk tier.

Gemini receives this result as evidence.

Gemini does not recompute it.

---

# 20. Decision Window

The Decision Window indicates when the situation should be reassessed.

It is part of the HazeLens deterministic decision workflow.

The objective is not merely to show a static current-state score, but to answer:

> **When should users look again?**

---

# 21. What Changed

HazeLens supports change intelligence between assessment cycles.

The initial session establishes a baseline.

After subsequent environmental refreshes, the application can compare the current assessment against the previous snapshot.

This helps users identify:

- changing wildfire pressure,
- changing community exposure,
- changing atmospheric conditions,
- changes in outlook,
- changes in monitored-community priority.

---

# 22. Gemini Environmental Intelligence

Gemini provides the interpretation layer.

The central architecture principle is:

> **HazeLens calculates. Gemini interprets.**

Gemini receives a compact structured snapshot containing relevant evidence such as:

- regional situation,
- top source regions,
- monitored communities,
- deterministic risk scores,
- component risk drivers,
- current environmental evidence,
- transport alignment,
- fire persistence,
- 6-hour outlook,
- 24-hour outlook,
- What Changed signals,
- decision window,
- confidence,
- provenance metadata.

Gemini is instructed not to alter authoritative HazeLens numerical values.

---

# 23. Gemini Decision Brief

The Decision Brief converts structured environmental evidence into a concise human-readable synthesis.

The brief contains six sections:

## WHAT IS HAPPENING

Current regional environmental situation.

## WHAT CHANGED

Changes from the previous HazeLens assessment.

## WHO NEEDS ATTENTION

Which monitored community currently requires the greatest attention.

## NEXT 6-24 HOURS

Forward-looking environmental awareness.

## RECOMMENDED AWARENESS

Practical monitoring considerations grounded in available evidence.

## CONFIDENCE & LIMITATIONS

Important data, model, and interpretation limitations.

---

# 24. Ask HazeLens

Ask HazeLens allows users to interrogate the evidence behind the current assessment.

Example questions include:

> Why is Palangka Raya at HIGH risk?

> Which source region is driving wildfire pressure?

> What changed since the previous assessment?

> What could cause the situation to improve?

> What should communities monitor during the next six hours?

> What evidence supports this recommendation?

Responses are grounded in the structured HazeLens evidence supplied to Gemini.

When the evidence is insufficient, Gemini is expected to say so rather than invent an answer.

---

# 25. Gemini Reliability Boundary

The production Gemini workflow includes:

- server-side Gemini API access,
- compact structured evidence payload,
- JSON response contract validation,
- duplicate-request prevention,
- visible processing status,
- manual cancellation,
- controlled provider-error handling,
- strict request timeout.

The current Decision Brief request lifecycle uses an approximately:

**30-second maximum**

If Gemini is unavailable or exceeds the response limit, the deterministic HazeLens assessment remains available.

This is intentional.

AI availability should not determine whether users can access the underlying environmental assessment.

---

# 26. Responsible AI Boundary

Gemini is used for:

- explanation,
- synthesis,
- contextualization,
- recommended awareness,
- question answering.

Gemini is not the authority for:

- numerical risk scores,
- deterministic component scores,
- source-region calculations,
- transport-alignment calculations,
- monitored-community ranking logic.

The application explicitly communicates this boundary:

> **Gemini explains and synthesizes the evidence. HazeLens deterministic logic calculates the numerical risk score.**

---

# 27. Evidence Provenance Model

Every significant value belongs to one of four provenance categories.

---

## CURRENT SOURCE DATA

Environmental data supplied by upstream data providers.

Examples include:

- NASA FIRMS active-fire detections
- current PM2.5
- current PM10
- current air-quality index
- current weather
- current wind conditions

---

## FORECAST

Future environmental information supplied by upstream forecast services.

Examples include:

- forecast air quality
- precipitation forecast
- future wind conditions
- forecast meteorological variables

---

## CALCULATED BY HAZELENS

Deterministic application calculations.

Examples include:

- Wildfire Pressure
- Atmospheric Transport Alignment
- Community Exposure
- Fire Persistence
- Environmental Impact Risk
- Decision Window
- monitored-community prioritization

---

## AI INTERPRETATION

Natural-language interpretation created by Gemini.

Examples include:

- Decision Brief
- recommended awareness
- contextual explanation
- Ask HazeLens responses

---

# 28. Evidence Integrity

HazeLens is designed to preserve the distinction between:

- data,
- calculation,
- forecast,
- interpretation.

This is particularly important in environmental decision support.

Users should be able to understand:

> What came from a source?

> What was forecast?

> What was calculated by HazeLens?

> What was interpreted by Gemini?

The Evidence screen makes this boundary visible.

---

# 29. High-Level Architecture

```text
┌────────────────────────────────────────────────────────────┐
│                    ENVIRONMENTAL SOURCES                   │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  NASA FIRMS                 Google Environmental APIs      │
│  NOAA-21 VIIRS NRT          Air Quality + Weather          │
│                                                            │
└──────────────────────────────┬─────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────┐
│          ENVIRONMENTAL INGESTION & PROVENANCE              │
│                                                            │
│  • Rolling 24h fire filtering                              │
│  • Environmental-source validation                         │
│  • Fallback-source identification                          │
│  • UTC timestamps                                          │
│  • Snapshot generation                                     │
└──────────────────────────────┬─────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────┐
│             HAZELENS DETERMINISTIC ENGINE                  │
│                                                            │
│  • Wildfire Pressure                                       │
│  • Atmospheric Transport Alignment                         │
│  • Community Exposure                                      │
│  • Fire Persistence                                        │
│  • Environmental Impact Risk                               │
│  • Decision Window                                         │
└──────────────────────────────┬─────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────┐
│              COMPACT EVIDENCE SNAPSHOT                     │
└─────────────────┬─────────────────────────┬────────────────┘
                  │                         │
                  ▼                         ▼
┌───────────────────────────┐    ┌───────────────────────────┐
│ GEMINI ENVIRONMENTAL      │    │ GOOGLE MAPS              │
│ INTELLIGENCE              │    │                           │
│                           │    │ • Active-fire detections  │
│ • Decision Brief          │    │ • Source regions         │
│ • Evidence explanation    │    │ • Communities            │
│ • Ask HazeLens            │    │ • Transport vectors      │
└───────────────┬───────────┘    └─────────────┬─────────────┘
                │                              │
                └──────────────┬───────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────┐
│                     HAZELENS ASEAN                         │
│                                                            │
│  Situation | Communities | AI Brief | Evidence             │
└──────────────────────────────┬─────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────┐
│                    GOOGLE CLOUD RUN                        │
│                                                            │
│                    asia-southeast1                         │
└────────────────────────────────────────────────────────────┘

```

---

# 30. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite |
| Backend | Node.js, TypeScript |
| AI | Gemini API |
| Wildfire Intelligence | NASA FIRMS, NOAA-21 VIIRS NRT |
| Air Quality | Google Air Quality API |
| Weather | Google Weather API |
| Mapping | Google Maps JavaScript API |
| Deployment | Google Cloud Run |
| Deployment Region | `asia-southeast1` |

---

# 31. Google Cloud Integration

HazeLens ASEAN uses Google technologies across environmental intelligence, geospatial visualization, generative AI, and production deployment.

### Gemini API

Used for:

- evidence-grounded environmental synthesis,
- structured Decision Brief generation,
- contextual explanation,
- Ask HazeLens conversational intelligence.

### Google Air Quality API

Preferred primary source for current air-quality information.

### Google Weather API

Preferred primary source for meteorological conditions and relevant forecasts.

### Google Maps JavaScript API

Provides the regional geospatial evidence view for active-fire detections, source regions, monitored communities, and transport vectors.

### Google Cloud Run

Hosts the deployed HazeLens ASEAN application.

**Production application:**

https://hazelens-asean-526896189680.asia-southeast1.run.app

---

# 32. Environment Configuration

HazeLens requires API credentials that must be supplied through environment variables.

```env
GEMINI_API_KEY=
GOOGLE_ENVIRONMENT_API_KEY=
GOOGLE_MAPS_BROWSER_KEY=
NASA_FIRMS_MAP_KEY=
```

Copy:

```text
.env.example
```

to:

```text
.env
```

and provide your own credentials.

> Never commit real API keys or the `.env` file to source control.

---

# 33. Running Locally

Clone the repository:

```bash
git clone https://github.com/IrwanP/hazelens-asean.git
cd hazelens-asean
```

Install dependencies:

```bash
npm install
```

or, if using Bun:

```bash
bun install
```

Provide the required environment variables and run the development command defined in `package.json`.

Typically:

```bash
npm run dev
```

or:

```bash
bun run dev
```

---

# 34. Repository Structure

```text
hazelens-asean/
│
├── src/
│   ├── components/
│   ├── context/
│   ├── data/
│   ├── services/
│   ├── utils/
│   ├── App.tsx
│   └── index.css
│
├── .env.example
├── .gitignore
├── bun.lock
├── index.html
├── metadata.json
├── package.json
├── README.md
├── server.ts
├── tsconfig.json
└── vite.config.ts
```

---

# 35. Security and Secret Handling

Sensitive credentials are not intended to be stored in this repository.

The application expects runtime secrets for:

- Gemini API
- Google environmental APIs
- Google Maps
- NASA FIRMS

The repository should never contain:

- `.env`
- production API keys
- private credentials
- service-account secrets
- authentication tokens

The Google Maps browser key should be appropriately restricted for its client-side use.

---

# 36. Demo Flow for Judges

A short evaluation path demonstrates the complete HazeLens decision workflow.

### 1. Situation

Review:

- Regional Environmental Situation
- What Changed
- Active Source Regions
- Regional Evidence Map

Observe the distinction between **source pressure** and **community impact**.

### 2. Communities

Compare:

- Palangka Raya
- Singapore
- Kuching

Review each community's:

- deterministic Environmental Impact Risk,
- current driver,
- 6-hour outlook,
- 24-hour outlook.

### 3. AI Brief

Generate the **Gemini Environmental Intelligence** Decision Brief.

Observe how Gemini synthesizes the existing HazeLens evidence without recalculating the numerical risk scores.

### 4. Ask HazeLens

Example:

> **Why is Palangka Raya at HIGH risk?**

Gemini explains the evidence behind the assessment while HazeLens remains authoritative for the deterministic score.

### 5. Evidence

Inspect the four provenance categories:

- CURRENT SOURCE DATA
- FORECAST
- CALCULATED BY HAZELENS
- AI INTERPRETATION

This demonstrates the application's evidence and accountability boundary.

---

# 37. Current Scope and Limitations

The current prototype focuses on wildfire and haze decision intelligence across selected parts of Southeast Asia.

The current monitored communities are:

- Palangka Raya
- Singapore
- Kuching

These communities represent different exposure scenarios and are **not an exhaustive ranking of all ASEAN communities**.

HazeLens does not claim to provide:

- a full atmospheric dispersion simulation,
- medical diagnosis,
- evacuation authority,
- official emergency instructions,
- unique wildfire counts from individual FIRMS detections.

Atmospheric Transport Alignment is a directional compatibility indicator, not a full physical dispersion model.

---

# 38. Safety and Human Decision Boundary

HazeLens supports situational awareness and early-action decision support.

It does not replace environmental, health, or emergency authorities.

> **Follow official local authority guidance for health, emergency and evacuation decisions.**

---

# 39. Submission Links

### Live Product

https://hazelens-asean-526896189680.asia-southeast1.run.app

### GitHub Repository

https://github.com/IrwanP/hazelens-asean

### Demo Video

`ADD FINAL 3-MINUTE YOUTUBE DEMO LINK HERE`

---

# 40. The HazeLens Story

HazeLens ASEAN can be understood through five questions:

> **Where is pressure originating?**  
> → Active Source Regions

> **Can it move toward communities?**  
> → Atmospheric Transport Alignment

> **Who are we monitoring?**  
> → Monitored Communities

> **Who needs attention?**  
> → Environmental Impact Risk

> **What should users watch next?**  
> → Decision Window + Gemini Environmental Intelligence

The result is a transparent workflow from:

**SOURCE → TRANSPORT → EXPOSURE → IMPACT → ACTION**

---

# Closing

Environmental intelligence should answer more than:

> **Where are the fires?**

It should help users understand:

> **Where is the pressure coming from?**

> **Can it move?**

> **Who might be affected?**

> **Why does the risk matter?**

> **What should we watch next?**

That is the purpose of **HazeLens ASEAN**.

## From environmental signals to early action.