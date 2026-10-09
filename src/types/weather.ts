export type TemperatureUnit = 'celsius' | 'fahrenheit';

export interface GeocodingLocation {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  elevation?: number;
  feature_code?: string;
  country_code?: string;
  admin1?: string;
  admin2?: string;
  timezone?: string;
  population?: number;
  country?: string;
}

export interface GeocodingResponse {
  results?: GeocodingLocation[];
  generationtime_ms?: number;
}

export interface CurrentWeatherData {
  time: string;
  interval: number;
  temperature_2m: number;
  relative_humidity_2m: number;
  apparent_temperature: number;
  is_day: number;
  precipitation: number;
  weather_code: number;
  cloud_cover: number;
  pressure_msl: number;
  surface_pressure: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  wind_gusts_10m: number;
}

export interface HourlyWeatherData {
  time: string[];
  temperature_2m: number[];
  apparent_temperature: number[];
  precipitation_probability: number[];
  weather_code: number[];
  wind_speed_10m: number[];
  uv_index: number[];
}

export interface DailyWeatherData {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  apparent_temperature_max: number[];
  apparent_temperature_min: number[];
  sunrise: string[];
  sunset: string[];
  uv_index_max: number[];
  precipitation_sum: number[];
  precipitation_probability_max: number[];
  wind_speed_10m_max: number[];
}

export interface ForecastResponse {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;
  current: CurrentWeatherData;
  hourly: HourlyWeatherData;
  daily: DailyWeatherData;
}

export interface DailyForecastItem {
  date: string;
  dayName: string;
  shortDate: string;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  feelsLikeMax: number;
  feelsLikeMin: number;
  sunrise: string;
  sunset: string;
  uvIndexMax: number;
  precipitationSum: number;
  precipitationProbMax: number;
  windSpeedMax: number;
}

export interface HourlyPoint {
  time: string;
  hourLabel: string;
  temp: number;
  feelsLike: number;
  precipProb: number;
  weatherCode: number;
  windSpeed: number;
  uvIndex: number;
}

export type AdvisorySeverity = 'nominal' | 'caution' | 'alert';

export interface PlanningRecommendation {
  id: string;
  category: string;
  title: string;
  summary: string;
  metricLabel: string;
  metricValue: string;
  severity: AdvisorySeverity;
  severityText: string;
  actionItems: string[];
}
