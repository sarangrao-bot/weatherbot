import {
  DailyForecastItem,
  ForecastResponse,
  GeocodingLocation,
  GeocodingResponse,
  HourlyPoint,
  PlanningRecommendation,
  TemperatureUnit,
} from '../types/weather';

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

export class WeatherApiError extends Error {
  public code: 'NOT_FOUND' | 'NETWORK_ERROR' | 'API_ERROR' | 'EMPTY_QUERY';
  public query?: string;

  constructor(
    message: string,
    code: 'NOT_FOUND' | 'NETWORK_ERROR' | 'API_ERROR' | 'EMPTY_QUERY',
    query?: string
  ) {
    super(message);
    this.name = 'WeatherApiError';
    this.code = code;
    this.query = query;
  }
}

export async function searchCities(query: string, count = 6): Promise<GeocodingLocation[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new WeatherApiError('Please enter a city or region name to search.', 'EMPTY_QUERY');
  }

  const url = `${GEOCODING_URL}?name=${encodeURIComponent(trimmed)}&count=${count}&language=en&format=json`;
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new WeatherApiError(
      'Unable to reach the Open-Meteo Geocoding service. Check your network connection and try again.',
      'NETWORK_ERROR',
      trimmed
    );
  }

  if (!response.ok) {
    throw new WeatherApiError(
      `Geocoding lookup failed with HTTP status ${response.status}.`,
      'API_ERROR',
      trimmed
    );
  }

  const data: GeocodingResponse = await response.json();
  if (!data.results || data.results.length === 0) {
    throw new WeatherApiError(
      `No matching city found for "${trimmed}". Check the spelling or try searching for a nearby major city.`,
      'NOT_FOUND',
      trimmed
    );
  }

  return data.results;
}

export async function fetchWeatherForecast(
  latitude: number,
  longitude: number
): Promise<ForecastResponse> {
  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    current: [
      'temperature_2m',
      'relative_humidity_2m',
      'apparent_temperature',
      'is_day',
      'precipitation',
      'weather_code',
      'cloud_cover',
      'pressure_msl',
      'surface_pressure',
      'wind_speed_10m',
      'wind_direction_10m',
      'wind_gusts_10m',
    ].join(','),
    hourly: [
      'temperature_2m',
      'apparent_temperature',
      'precipitation_probability',
      'weather_code',
      'wind_speed_10m',
      'uv_index',
    ].join(','),
    daily: [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'apparent_temperature_max',
      'apparent_temperature_min',
      'sunrise',
      'sunset',
      'uv_index_max',
      'precipitation_sum',
      'precipitation_probability_max',
      'wind_speed_10m_max',
    ].join(','),
    timezone: 'auto',
    forecast_days: '7',
  });

  const url = `${FORECAST_URL}?${params.toString()}`;
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new WeatherApiError(
      'Network error while fetching forecast telemetry from Open-Meteo. Please try again.',
      'NETWORK_ERROR'
    );
  }

  if (!response.ok) {
    throw new WeatherApiError(
      `Open-Meteo Forecast API returned status ${response.status}. Unable to load weather telemetry.`,
      'API_ERROR'
    );
  }

  const data: ForecastResponse = await response.json();
  if (!data.current || !data.daily || !data.daily.time) {
    throw new WeatherApiError(
      'Received an incomplete forecast payload from Open-Meteo.',
      'API_ERROR'
    );
  }

  return data;
}

export function formatTemp(celsius: number, unit: TemperatureUnit, includeUnit = true): string {
  const val = unit === 'fahrenheit' ? (celsius * 9) / 5 + 32 : celsius;
  const rounded = Math.round(val);
  if (!includeUnit) return `${rounded}°`;
  return `${rounded}°${unit === 'fahrenheit' ? 'F' : 'C'}`;
}

export function convertTempValue(celsius: number, unit: TemperatureUnit): number {
  const val = unit === 'fahrenheit' ? (celsius * 9) / 5 + 32 : celsius;
  return Math.round(val * 10) / 10;
}

export function getCardinalDirection(degrees: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(((degrees %= 360) < 0 ? degrees + 360 : degrees) / 45) % 8;
  return directions[index];
}

export interface WmoConditionInfo {
  label: string;
  shortLabel: string;
  description: string;
  category: 'clear' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm';
}

export function getWmoCondition(code: number, isDay = 1): WmoConditionInfo {
  switch (code) {
    case 0:
      return {
        label: isDay ? 'Clear Sky' : 'Clear Night',
        shortLabel: 'Clear',
        description: 'Unobstructed sky with high solar visibility',
        category: 'clear',
      };
    case 1:
      return {
        label: isDay ? 'Mainly Clear' : 'Mostly Clear',
        shortLabel: 'Mostly Clear',
        description: 'Predominantly clear conditions with scattered high clouds',
        category: 'clear',
      };
    case 2:
      return {
        label: 'Partly Cloudy',
        shortLabel: 'Partly Cloudy',
        description: 'Balanced mix of direct sunlight and passing cloud cover',
        category: 'cloudy',
      };
    case 3:
      return {
        label: 'Overcast',
        shortLabel: 'Overcast',
        description: 'Continuous cloud canopy across the sky dome',
        category: 'cloudy',
      };
    case 45:
    case 48:
      return {
        label: code === 48 ? 'Depositing Rime Fog' : 'Dense Fog',
        shortLabel: 'Fog',
        description: 'Reduced horizontal visibility due to suspended moisture',
        category: 'fog',
      };
    case 51:
    case 53:
    case 55:
      return {
        label: code === 51 ? 'Light Drizzle' : code === 53 ? 'Moderate Drizzle' : 'Dense Drizzle',
        shortLabel: 'Drizzle',
        description: 'Fine, low-intensity moisture precipitation',
        category: 'drizzle',
      };
    case 56:
    case 57:
      return {
        label: 'Freezing Drizzle',
        shortLabel: 'Freezing Drizzle',
        description: 'Supercooled drizzle freezing on surface contact',
        category: 'snow',
      };
    case 61:
    case 63:
    case 65:
      return {
        label: code === 61 ? 'Light Rain' : code === 63 ? 'Moderate Rain' : 'Heavy Rain',
        shortLabel: code === 65 ? 'Heavy Rain' : 'Rain',
        description: 'Active liquid precipitation across the region',
        category: 'rain',
      };
    case 66:
    case 67:
      return {
        label: 'Freezing Rain',
        shortLabel: 'Freezing Rain',
        description: 'Rain glaze risk on cold road and walkway surfaces',
        category: 'snow',
      };
    case 71:
    case 73:
    case 75:
    case 77:
      return {
        label:
          code === 71
            ? 'Light Snowfall'
            : code === 73
            ? 'Moderate Snowfall'
            : code === 75
            ? 'Heavy Snowfall'
            : 'Snow Grains',
        shortLabel: 'Snow',
        description: 'Frozen crystalline precipitation accumulating on surfaces',
        category: 'snow',
      };
    case 80:
    case 81:
    case 82:
      return {
        label:
          code === 80
            ? 'Scattered Rain Showers'
            : code === 81
            ? 'Moderate Rain Showers'
            : 'Violent Rain Showers',
        shortLabel: 'Showers',
        description: 'Passing convective rain showers with variable intensity',
        category: 'rain',
      };
    case 85:
    case 86:
      return {
        label: code === 85 ? 'Light Snow Showers' : 'Heavy Snow Showers',
        shortLabel: 'Snow Showers',
        description: 'Intermittent bursts of convective snowfall',
        category: 'snow',
      };
    case 95:
    case 96:
    case 99:
      return {
        label: code === 95 ? 'Thunderstorm' : 'Thunderstorm with Hail',
        shortLabel: 'Storm',
        description: 'Active electrical storm activity and strong convective gusts',
        category: 'storm',
      };
    default:
      return {
        label: 'Variable Conditions',
        shortLabel: 'Variable',
        description: 'Standard atmospheric conditions',
        category: 'cloudy',
      };
  }
}

export function buildDailyForecastItems(forecast: ForecastResponse): DailyForecastItem[] {
  const { daily } = forecast;
  return daily.time.map((dateStr, idx) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    const dayName =
      idx === 0
        ? 'Today'
        : idx === 1
        ? 'Tomorrow'
        : localDate.toLocaleDateString('en-US', { weekday: 'short' });
    const shortDate = localDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });

    return {
      date: dateStr,
      dayName,
      shortDate,
      weatherCode: daily.weather_code[idx] ?? 0,
      tempMax: daily.temperature_2m_max[idx] ?? 0,
      tempMin: daily.temperature_2m_min[idx] ?? 0,
      feelsLikeMax: daily.apparent_temperature_max[idx] ?? 0,
      feelsLikeMin: daily.apparent_temperature_min[idx] ?? 0,
      sunrise: daily.sunrise[idx] ?? '',
      sunset: daily.sunset[idx] ?? '',
      uvIndexMax: daily.uv_index_max[idx] ?? 0,
      precipitationSum: daily.precipitation_sum[idx] ?? 0,
      precipitationProbMax: daily.precipitation_probability_max[idx] ?? 0,
      windSpeedMax: daily.wind_speed_10m_max[idx] ?? 0,
    };
  });
}

export function getHourlyPointsForDay(
  forecast: ForecastResponse,
  dayDate: string
): HourlyPoint[] {
  const { hourly } = forecast;
  const points: HourlyPoint[] = [];

  for (let i = 0; i < hourly.time.length; i++) {
    const t = hourly.time[i];
    if (t.startsWith(dayDate)) {
      const hourPart = t.split('T')[1] || '00:00';
      const hourNum = parseInt(hourPart.split(':')[0], 10);
      const ampm = hourNum === 0 ? '12a' : hourNum < 12 ? `${hourNum}a` : hourNum === 12 ? '12p' : `${hourNum - 12}p`;

      points.push({
        time: t,
        hourLabel: ampm,
        temp: hourly.temperature_2m[i] ?? 0,
        feelsLike: hourly.apparent_temperature[i] ?? 0,
        precipProb: hourly.precipitation_probability[i] ?? 0,
        weatherCode: hourly.weather_code[i] ?? 0,
        windSpeed: hourly.wind_speed_10m[i] ?? 0,
        uvIndex: hourly.uv_index[i] ?? 0,
      });
    }
  }

  return points;
}

export function generatePlanningRecommendations(
  forecast: ForecastResponse,
  selectedDayIndex: number,
  unit: TemperatureUnit
): PlanningRecommendation[] {
  const dailyItems = buildDailyForecastItems(forecast);
  const targetDay = dailyItems[selectedDayIndex] || dailyItems[0];
  const isToday = selectedDayIndex === 0;
  const current = forecast.current;

  const refTemp = isToday ? current.temperature_2m : (targetDay.tempMax + targetDay.tempMin) / 2;
  const refFeels = isToday ? current.apparent_temperature : targetDay.feelsLikeMax;
  const tempSwing = targetDay.tempMax - targetDay.tempMin;
  const maxPrecipProb = targetDay.precipitationProbMax;
  const precipSum = targetDay.precipitationSum;
  const maxWind = isToday ? Math.max(current.wind_speed_10m, targetDay.windSpeedMax) : targetDay.windSpeedMax;
  const maxUv = targetDay.uvIndexMax;

  // 1. Wardrobe & Thermal Strategy
  let wardrobeTitle = 'Light Breathable Layering';
  let wardrobeSummary =
    'Mild thermal profile throughout the day. Standard indoor-outdoor attire is comfortable.';
  let wardrobeSeverity: 'nominal' | 'caution' | 'alert' = 'nominal';
  let wardrobeSeverityText = 'Comfortable Range';
  const wardrobeActions: string[] = [];

  if (targetDay.tempMin < 2 || refFeels < 3) {
    wardrobeTitle = 'Insulated Cold-Weather Outer Shell';
    wardrobeSummary = `Sub-5°C thermal floor (${formatTemp(targetDay.tempMin, unit)} low). Wind chill reduces perceived warmth significantly.`;
    wardrobeSeverity = targetDay.tempMin < -4 ? 'alert' : 'caution';
    wardrobeSeverityText = targetDay.tempMin < -4 ? 'Freeze Advisory' : 'Cold Stress';
    wardrobeActions.push('Wear a thermal base layer and windproof insulated jacket');
    wardrobeActions.push('Protect extremities with gloves and a warm knit cap during morning/evening hours');
  } else if (targetDay.tempMax > 30 || refFeels > 31) {
    wardrobeTitle = 'Heat-Reflective Breathable Fabrics';
    wardrobeSummary = `Peak temperatures reach ${formatTemp(targetDay.tempMax, unit)} (feels like ${formatTemp(targetDay.feelsLikeMax, unit)}). Prioritize active cooling and hydration.`;
    wardrobeSeverity = targetDay.tempMax > 35 ? 'alert' : 'caution';
    wardrobeSeverityText = targetDay.tempMax > 35 ? 'High Heat Load' : 'Warm Conditions';
    wardrobeActions.push('Choose loose-fitting linen or moisture-wicking technical fabrics');
    wardrobeActions.push('Carry 500ml+ water for trips exceeding 45 minutes');
  } else if (tempSwing >= 10) {
    wardrobeTitle = 'Modular 2-Layer Transition System';
    wardrobeSummary = `Wide diurnal temperature swing of ${Math.round(unit === 'fahrenheit' ? (tempSwing * 9) / 5 : tempSwing)}° between morning low (${formatTemp(targetDay.tempMin, unit)}) and afternoon peak (${formatTemp(targetDay.tempMax, unit)}).`;
    wardrobeSeverity = 'nominal';
    wardrobeSeverityText = 'Wide Swing';
    wardrobeActions.push('Pair a removable mid-layer (fleece or overshirt) with a breathable T-shirt');
    wardrobeActions.push('Plan for cooler temperatures rapidly returning after sunset');
  } else {
    wardrobeActions.push(`Optimal comfort between ${formatTemp(targetDay.tempMin, unit)} and ${formatTemp(targetDay.tempMax, unit)}`);
    wardrobeActions.push('A light sweater or windbreaker is sufficient for evening breezes');
  }

  // 2. Precipitation & Commute Readiness
  let commuteTitle = 'Dry Roadways & Clear Transit';
  let commuteSummary = `Low precipitation probability (${maxPrecipProb}%). Surface travel and pedestrian commutes face minimal weather disruption.`;
  let commuteSeverity: 'nominal' | 'caution' | 'alert' = 'nominal';
  let commuteSeverityText = 'Clear Transit';
  const commuteActions: string[] = [];

  if (maxPrecipProb >= 65 || precipSum >= 8) {
    commuteTitle = 'Wet-Weather Gear & Buffer Time Required';
    commuteSummary = `High probability of precipitation (${maxPrecipProb}%) with ${precipSum.toFixed(1)} mm projected accumulation. Expect slower surface traffic.`;
    commuteSeverity = precipSum >= 15 || maxWind > 45 ? 'alert' : 'caution';
    commuteSeverityText = commuteSeverity === 'alert' ? 'Heavy Precip Alert' : 'Rain Likely';
    commuteActions.push('Pack a waterproof shell or wind-resistant umbrella before departing');
    commuteActions.push('Add 15–20 minutes buffer to road commutes due to wet braking distances');
  } else if (maxPrecipProb >= 35) {
    commuteTitle = 'Packable Rain Protection Recommended';
    commuteSummary = `Passing shower potential (${maxPrecipProb}% peak chance, ${precipSum.toFixed(1)} mm total). Conditions may shift mid-day.`;
    commuteSeverity = 'caution';
    commuteSeverityText = 'Shower Risk';
    commuteActions.push('Keep a compact umbrella or water-repellent jacket accessible');
    commuteActions.push('Check hourly radar timing before scheduling outdoor bike or walking transit');
  } else {
    commuteActions.push('Favorable conditions for cycling, walking, and public transit connections');
    commuteActions.push(`Peak wind speeds remain manageable near ${Math.round(maxWind)} km/h`);
  }

  // 3. Outdoor Activity & Optimal Window
  const dayHourly = getHourlyPointsForDay(forecast, targetDay.date);
  const daylightHours = dayHourly.filter((_, idx) => idx >= 7 && idx <= 19);
  let bestHour = daylightHours[0];
  if (daylightHours.length > 0) {
    bestHour = daylightHours.reduce((best, curr) => {
      const scoreCurr =
        curr.precipProb * 1.5 +
        Math.abs(curr.temp - 20) * 2.2 +
        Math.max(0, curr.windSpeed - 20) * 1.2;
      const scoreBest =
        best.precipProb * 1.5 +
        Math.abs(best.temp - 20) * 2.2 +
        Math.max(0, best.windSpeed - 20) * 1.2;
      return scoreCurr < scoreBest ? curr : best;
    }, daylightHours[0]);
  }

  let outdoorTitle = bestHour
    ? `Optimal Outdoor Window Around ${bestHour.hourLabel}`
    : 'Favorable Daytime Activity Window';
  let outdoorSummary = bestHour
    ? `Best thermal and wind balance occurs near ${bestHour.hourLabel} (${formatTemp(bestHour.temp, unit)}, ${bestHour.precipProb}% rain risk, ${Math.round(bestHour.windSpeed)} km/h wind).`
    : 'Steady conditions across daylight hours for outdoor recreation and errands.';
  let outdoorSeverity: 'nominal' | 'caution' | 'alert' = 'nominal';
  let outdoorSeverityText = 'Optimal Window';
  const outdoorActions: string[] = [];

  if (maxWind >= 40 || maxPrecipProb >= 75) {
    outdoorTitle = 'Shift High-Exertion Training Indoors';
    outdoorSummary = `Elevated wind gusts (${Math.round(maxWind)} km/h) or wet conditions (${maxPrecipProb}% rain chance) degrade outdoor training quality.`;
    outdoorSeverity = maxWind >= 55 ? 'alert' : 'caution';
    outdoorSeverityText = maxWind >= 55 ? 'High Wind Warning' : 'Limited Outdoor Window';
    outdoorActions.push(
      bestHour
        ? `If going outside, restrict exposure to the ${bestHour.hourLabel} window`
        : 'Prefer indoor gym or covered facilities today'
    );
    outdoorActions.push('Avoid exposed ridgelines, coastal paths, or cycling in crosswinds');
  } else {
    outdoorActions.push(
      bestHour
        ? `Schedule runs, walks, or outdoor dining near ${bestHour.hourLabel} (${formatTemp(bestHour.temp, unit)})`
        : 'Daytime temperatures support outdoor exercise'
    );
    outdoorActions.push(
      `Daylight spans from ${formatTimeShort(targetDay.sunrise)} to ${formatTimeShort(targetDay.sunset)}`
    );
  }

  // 4. Solar UV & Weekly Outlook
  const bestWeekDay = dailyItems.reduce((best, curr) => {
    const scoreCurr = curr.precipitationProbMax * 1.5 + Math.abs(curr.tempMax - 22) * 2 + curr.windSpeedMax * 0.5;
    const scoreBest = best.precipitationProbMax * 1.5 + Math.abs(best.tempMax - 22) * 2 + best.windSpeedMax * 0.5;
    return scoreCurr < scoreBest ? curr : best;
  }, dailyItems[0]);

  let uvTitle =
    maxUv >= 6
      ? 'High Solar UV Protection Required'
      : maxUv >= 3
      ? 'Moderate UV Index & Weekly Planning'
      : 'Low UV Exposure & 7-Day Outlook';
  let uvSummary =
    maxUv >= 6
      ? `Peak UV index reaches ${maxUv.toFixed(1)}. Unprotected skin can experience solar stress during midday hours.`
      : `Peak UV index is ${maxUv.toFixed(1)}. Best overall day in the 7-day window is ${bestWeekDay.dayName} (${bestWeekDay.shortDate}).`;
  let uvSeverity: 'nominal' | 'caution' | 'alert' =
    maxUv >= 8 ? 'alert' : maxUv >= 6 ? 'caution' : 'nominal';
  let uvSeverityText =
    maxUv >= 8 ? 'Very High UV' : maxUv >= 6 ? 'High UV' : 'Low Solar Risk';
  const uvActions: string[] = [];

  if (maxUv >= 3) {
    uvActions.push('Apply broad-spectrum SPF 30+ sunscreen between 11:00 AM and 3:00 PM');
    uvActions.push('Wear UV-filtering sunglasses for prolonged outdoor blocks');
  } else {
    uvActions.push('Minimal solar UV hazard; no special sun protection needed today');
  }
  uvActions.push(
    `Best day this week for outdoor plans: ${bestWeekDay.dayName} (${formatTemp(bestWeekDay.tempMax, unit)} high, ${bestWeekDay.precipitationProbMax}% rain chance)`
  );

  return [
    {
      id: 'wardrobe',
      category: 'Thermal & Wardrobe',
      title: wardrobeTitle,
      summary: wardrobeSummary,
      metricLabel: 'High / Low Range',
      metricValue: `${formatTemp(targetDay.tempMax, unit)} / ${formatTemp(targetDay.tempMin, unit)}`,
      severity: wardrobeSeverity,
      severityText: wardrobeSeverityText,
      actionItems: wardrobeActions,
    },
    {
      id: 'commute',
      category: 'Transit & Precipitation',
      title: commuteTitle,
      summary: commuteSummary,
      metricLabel: 'Precip Probability',
      metricValue: `${maxPrecipProb}% (${precipSum.toFixed(1)} mm)`,
      severity: commuteSeverity,
      severityText: commuteSeverityText,
      actionItems: commuteActions,
    },
    {
      id: 'outdoor',
      category: 'Activity Timing',
      title: outdoorTitle,
      summary: outdoorSummary,
      metricLabel: 'Peak Wind Speed',
      metricValue: `${Math.round(maxWind)} km/h`,
      severity: outdoorSeverity,
      severityText: outdoorSeverityText,
      actionItems: outdoorActions,
    },
    {
      id: 'uv-weekly',
      category: 'Solar & 7-Day Strategy',
      title: uvTitle,
      summary: uvSummary,
      metricLabel: 'Max UV Index',
      metricValue: `UV ${maxUv.toFixed(1)}`,
      severity: uvSeverity,
      severityText: uvSeverityText,
      actionItems: uvActions,
    },
  ];
}

export function formatTimeShort(isoTime: string): string {
  if (!isoTime || !isoTime.includes('T')) return '--:--';
  const timePart = isoTime.split('T')[1];
  const [hStr, mStr] = timePart.split(':');
  const h = parseInt(hStr, 10);
  if (isNaN(h)) return timePart;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr} ${suffix}`;
}
