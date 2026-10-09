# Aether Weather Intelligence

Precision meteorological intelligence, real-time conditions, 7-day forecast cards, interactive temperature charts, and actionable planning recommendations powered by the keyless **Open-Meteo Geocoding & Forecast APIs**.

## Features

- **City Geocoding (`geocoding-api.open-meteo.com/v1/search`)**: Search any city worldwide to resolve latitude, longitude, elevation, and local timezone, with live disambiguation suggestions and quick-select reference stations.
- **Current Weather Telemetry (`api.open-meteo.com/v1/forecast`)**: Real-time surface temperature, apparent ("feels like") temperature, WMO standardized weather conditions, wind speed/direction/gusts, relative humidity, precipitation, barometric pressure, cloud cover, and solar cycle.
- **7-Day Forecast Cards**: Interactive daily cards with relative temperature range bars, precipitation probabilities, UV index, and peak wind speeds.
- **Interactive Temperature Chart**: Switch between a **24-Hour Diurnal Curve** (temperature, feels-like, and hourly precipitation probability) and a **7-Day High / Low** synoptic trend chart.
- **Planning Recommendations**: Automated daily guidance for wardrobe/layering, transit & precipitation, optimal outdoor activity windows, and solar UV protection.
- **Zero API Keys Required**: Uses public Open-Meteo endpoints out of the box.

## Getting Started

```bash
# Install dependencies
npm install

# Start development server (http://localhost:3000)
npm run dev

# Build for production
npm run build
```

## Deploying to Cloudflare Workers

This repository is pre-configured for **Cloudflare Workers** (`wrangler.jsonc` + `src/worker.ts` + static assets in `./dist`).

### Automatic GitHub Deployment (Cloudflare Dashboard)
- **Build command**: `npm run build`
- **Deploy command**: `npx wrangler deploy` (or `npm run deploy`)
- **Build output directory**: `dist`

### Manual CLI Deployment
```bash
npm run deploy
```
