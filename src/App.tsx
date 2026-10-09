/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  AlertTriangle,
  Compass,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  X,
} from 'lucide-react';
import {
  DailyForecastItem,
  ForecastResponse,
  GeocodingLocation,
  PlanningRecommendation,
  TemperatureUnit,
} from './types/weather';
import {
  WeatherApiError,
  buildDailyForecastItems,
  fetchWeatherForecast,
  formatTemp,
  formatTimeShort,
  generatePlanningRecommendations,
  getCardinalDirection,
  getHourlyPointsForDay,
  getWmoCondition,
  searchCities,
} from './services/openMeteo';
import { WeatherIcon } from './components/WeatherIcon';
import { TemperatureChart } from './components/TemperatureChart';

const PRESET_CITIES: { label: string; query: string }[] = [
  { label: 'San Francisco', query: 'San Francisco' },
  { label: 'Tokyo', query: 'Tokyo' },
  { label: 'Zurich', query: 'Zurich' },
  { label: 'Reykjavik', query: 'Reykjavik' },
  { label: 'London', query: 'London' },
  { label: 'Singapore', query: 'Singapore' },
];

const DEFAULT_LOCATION: GeocodingLocation = {
  id: 5391959,
  name: 'San Francisco',
  latitude: 37.77493,
  longitude: -122.41942,
  elevation: 16,
  country: 'United States',
  country_code: 'US',
  admin1: 'California',
  timezone: 'America/Los_Angeles',
};

export default function App() {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [suggestions, setSuggestions] = useState<GeocodingLocation[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [isSearchingSuggestions, setIsSearchingSuggestions] = useState<boolean>(false);

  const [activeLocation, setActiveLocation] = useState<GeocodingLocation>(DEFAULT_LOCATION);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<{
    title: string;
    message: string;
    code: string;
    failedQuery?: string;
  } | null>(null);

  const [unit, setUnit] = useState<TemperatureUnit>('celsius');
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);

  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close suggestions dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load initial default city on mount
  useEffect(() => {
    loadWeatherForLocation(DEFAULT_LOCATION);
  }, []);

  // Debounced autocomplete geocoding preview while typing
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setIsSearchingSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingSuggestions(true);
      try {
        const results = await searchCities(trimmed, 5);
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearchingSuggestions(false);
      }
    }, 260);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  async function loadWeatherForLocation(location: GeocodingLocation) {
    setLoading(true);
    setError(null);
    setShowSuggestions(false);
    try {
      const data = await fetchWeatherForecast(location.latitude, location.longitude);
      setActiveLocation(location);
      setForecast(data);
      setSelectedDayIndex(0);
    } catch (err) {
      if (err instanceof WeatherApiError) {
        setError({
          title: 'Forecast Telemetry Unavailable',
          message: err.message,
          code: err.code,
        });
      } else {
        setError({
          title: 'Forecast Request Failed',
          message: 'An unexpected error occurred while retrieving data from Open-Meteo.',
          code: 'API_ERROR',
        });
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCitySearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setError({
        title: 'City Name Required',
        message: 'Please enter a valid city name before searching.',
        code: 'EMPTY_QUERY',
      });
      return;
    }

    setLoading(true);
    setError(null);
    setShowSuggestions(false);

    try {
      const locations = await searchCities(trimmed, 5);
      const topMatch = locations[0];
      const forecastData = await fetchWeatherForecast(topMatch.latitude, topMatch.longitude);
      setActiveLocation(topMatch);
      setForecast(forecastData);
      setSelectedDayIndex(0);
    } catch (err) {
      if (err instanceof WeatherApiError) {
        setError({
          title:
            err.code === 'NOT_FOUND'
              ? 'City Not Found in Geocoding Index'
              : 'Weather Service Error',
          message: err.message,
          code: err.code,
          failedQuery: trimmed,
        });
      } else {
        setError({
          title: 'Unable to Complete Search',
          message: `Could not resolve coordinates or weather data for "${trimmed}".`,
          code: 'API_ERROR',
          failedQuery: trimmed,
        });
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleQuickCitySelect(cityQuery: string) {
    setSearchQuery(cityQuery);
    setShowSuggestions(false);
    setLoading(true);
    setError(null);
    try {
      const locations = await searchCities(cityQuery, 1);
      const match = locations[0];
      const forecastData = await fetchWeatherForecast(match.latitude, match.longitude);
      setActiveLocation(match);
      setForecast(forecastData);
      setSelectedDayIndex(0);
    } catch (err) {
      setError({
        title: 'Unable to Load City',
        message:
          err instanceof Error
            ? err.message
            : `Failed to fetch weather for ${cityQuery}.`,
        code: 'API_ERROR',
      });
    } finally {
      setLoading(false);
    }
  }

  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setError({
        title: 'Geolocation Not Supported',
        message:
          'Your browser does not support automatic location detection. Please search by city name instead.',
        code: 'API_ERROR',
      });
      return;
    }

    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(4));
        const lon = Number(pos.coords.longitude.toFixed(4));
        const customLoc: GeocodingLocation = {
          id: Date.now(),
          name: 'Current Coordinates',
          latitude: lat,
          longitude: lon,
          country: 'Local Station',
          admin1: `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`,
        };
        await loadWeatherForLocation(customLoc);
      },
      () => {
        setLoading(false);
        setError({
          title: 'Location Permission Declined',
          message:
            'Browser geolocation access was blocked or timed out. Search for any city using the search bar below.',
          code: 'API_ERROR',
        });
      },
      { timeout: 8000 }
    );
  }

  const dailyItems: DailyForecastItem[] = forecast ? buildDailyForecastItems(forecast) : [];
  const selectedDay = dailyItems[selectedDayIndex] || dailyItems[0];
  const hourlyPoints =
    forecast && selectedDay ? getHourlyPointsForDay(forecast, selectedDay.date) : [];
  const recommendations: PlanningRecommendation[] = forecast
    ? generatePlanningRecommendations(forecast, selectedDayIndex, unit)
    : [];

  const weekMinTemp =
    dailyItems.length > 0 ? Math.min(...dailyItems.map((d) => d.tempMin)) : 0;
  const weekMaxTemp =
    dailyItems.length > 0 ? Math.max(...dailyItems.map((d) => d.tempMax)) : 25;
  const weekTempSpan = Math.max(1, weekMaxTemp - weekMinTemp);

  const currentCondition = forecast
    ? getWmoCondition(forecast.current.weather_code, forecast.current.is_day)
    : null;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200">
        <div className="max-w-[1280px] mx-auto flex items-center justify-between gap-8 px-6 py-3.5">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#top"
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            Aether Meteorology
          </a>

          {/* Zone 2: 4 concise single-line navigation links */}
          <nav
            aria-label="Primary sections"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
          >
            <a
              href="#current-conditions"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Current Conditions
            </a>
            <a
              href="#forecast-7day"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              7-Day Forecast
            </a>
            <a
              href="#temperature-chart"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Temperature Chart
            </a>
            <a
              href="#planning-recommendations"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Planning Guide
            </a>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={handleUseMyLocation}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Use My Location
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Container */}
      <main id="top" className="flex-1 max-w-[1280px] w-full mx-auto px-6 py-8 space-y-8">
        {/* Search & Geocoding Command Bar */}
        <section
          aria-label="City search and unit controls"
          className="bg-white border border-slate-200 rounded-xl p-6"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Open-Meteo Geocoding & Synoptic Model</span>
                <span aria-hidden="true">·</span>
                <span>Zero API Key Telemetry</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-1">
                Weather Intelligence & 7-Day Operational Forecast
              </h1>
            </div>

            {/* Search Input + Unit Toggle */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 max-w-2xl">
              <div ref={searchContainerRef} className="relative flex-1">
                <form onSubmit={handleCitySearchSubmit} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onFocus={() => setShowSuggestions(true)}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setShowSuggestions(true);
                      }}
                      placeholder="Search any city (e.g., Tokyo, Paris, Seattle, Nairobi)..."
                      aria-label="Search city name"
                      className="w-full pl-10 pr-9 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-sky-600 focus:ring-2 focus:ring-sky-600/15 transition-all"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setSuggestions([]);
                        }}
                        aria-label="Clear search query"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {loading ? 'Resolving...' : 'Search City'}
                  </button>
                </form>

                {/* Autocomplete Geocoding Dropdown */}
                {showSuggestions &&
                  (suggestions.length > 0 || isSearchingSuggestions) &&
                  searchQuery.trim().length >= 2 && (
                    <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-lg shadow-lg z-40 overflow-hidden">
                      <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                        <span>Geocoding Matches</span>
                        <span className="font-mono">Open-Meteo v1/search</span>
                      </div>
                      {isSearchingSuggestions && suggestions.length === 0 ? (
                        <div className="px-4 py-3 text-xs text-slate-500">
                          Looking up coordinates for &ldquo;{searchQuery.trim()}&rdquo;...
                        </div>
                      ) : (
                        <ul className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                          {suggestions.map((loc) => (
                            <li key={loc.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSearchQuery(loc.name);
                                  loadWeatherForLocation(loc);
                                }}
                                className="w-full px-4 py-2.5 text-left hover:bg-slate-50 flex items-center justify-between gap-4 transition-colors cursor-pointer"
                              >
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-slate-900 truncate">
                                    {loc.name}
                                    {loc.admin1 ? `, ${loc.admin1}` : ''}
                                  </div>
                                  <div className="text-xs text-slate-500 truncate">
                                    {loc.country || loc.country_code || 'Global Station'}
                                  </div>
                                </div>
                                <div className="text-right font-mono text-xs text-slate-500 shrink-0 tabular-nums">
                                  <div>
                                    {loc.latitude.toFixed(2)}°, {loc.longitude.toFixed(2)}°
                                  </div>
                                  {loc.elevation !== undefined && (
                                    <div className="text-[11px] text-slate-400">
                                      {Math.round(loc.elevation)}m elev
                                    </div>
                                  )}
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
              </div>

              {/* Interactive Temperature Unit Switcher */}
              <div
                role="group"
                aria-label="Temperature unit"
                className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start sm:self-auto shrink-0"
              >
                <button
                  type="button"
                  onClick={() => setUnit('celsius')}
                  className={`px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    unit === 'celsius'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  °C Metric
                </button>
                <button
                  type="button"
                  onClick={() => setUnit('fahrenheit')}
                  className={`px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    unit === 'fahrenheit'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  °F Imperial
                </button>
              </div>
            </div>
          </div>

          {/* Quick Reference Cities Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 mt-5 pt-4 border-t border-slate-100 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-500 mr-1">Reference Stations:</span>
              {PRESET_CITIES.map((city) => {
                const isCurrent =
                  activeLocation.name.toLowerCase() === city.label.toLowerCase();
                return (
                  <button
                    key={city.label}
                    type="button"
                    onClick={() => handleQuickCitySelect(city.query)}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isCurrent
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {city.label}
                  </button>
                );
              })}
            </div>

            {forecast && (
              <div className="flex items-center gap-2 text-slate-500 font-mono tabular-nums">
                <span>
                  Coords: {forecast.latitude.toFixed(3)}°N, {forecast.longitude.toFixed(3)}°E
                </span>
                <span aria-hidden="true">·</span>
                <span>Elevation: {Math.round(forecast.elevation)}m</span>
                <span aria-hidden="true">·</span>
                <span>TZ: {forecast.timezone_abbreviation}</span>
              </div>
            )}
          </div>
        </section>

        {/* Explicit Error Banner when City Not Found or API Fails */}
        {error && (
          <section
            role="alert"
            aria-live="assertive"
            className="bg-red-50/90 border border-red-200 rounded-xl p-5 text-red-950"
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono text-red-700">
                    <span>ERROR_CODE: {error.code}</span>
                    {error.failedQuery && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>QUERY: &ldquo;{error.failedQuery}&rdquo;</span>
                      </>
                    )}
                  </div>
                  <h2 className="text-base font-semibold text-red-950 mt-0.5">
                    {error.title}
                  </h2>
                  <p className="text-sm text-red-800 mt-1 leading-relaxed">
                    {error.message}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-start">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    loadWeatherForLocation(activeLocation);
                  }}
                  className="px-3.5 py-2 text-xs font-semibold bg-white border border-red-300 text-red-900 rounded-lg hover:bg-red-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Restore {activeLocation.name}
                </button>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="px-3 py-2 text-xs font-medium text-red-700 hover:text-red-950 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Loading Skeleton State */}
        {loading && !forecast && (
          <section className="bg-white border border-slate-200 rounded-xl p-8 space-y-6 animate-pulse">
            <div className="h-6 w-56 bg-slate-200 rounded" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="h-44 bg-slate-100 rounded-lg" />
              <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="h-20 bg-slate-100 rounded-lg" />
                <div className="h-20 bg-slate-100 rounded-lg" />
                <div className="h-20 bg-slate-100 rounded-lg" />
                <div className="h-20 bg-slate-100 rounded-lg" />
                <div className="h-20 bg-slate-100 rounded-lg" />
                <div className="h-20 bg-slate-100 rounded-lg" />
              </div>
            </div>
          </section>
        )}

        {/* Current Conditions & Atmospheric Telemetry */}
        {forecast && currentCondition && (
          <section
            id="current-conditions"
            aria-label="Current weather conditions"
            className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8"
          >
            {/* Header metadata bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-200">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>Current Surface Observation</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {activeLocation.admin1 ? `${activeLocation.admin1}, ` : ''}
                    {activeLocation.country || activeLocation.country_code || 'Global'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    Updated {formatTimeShort(forecast.current.time)} ({forecast.timezone})
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
                  {activeLocation.name}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => loadWeatherForLocation(activeLocation)}
                disabled={loading}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh Telemetry</span>
              </button>
            </div>

            {/* Split Grid: Primary Temperature Focal Anchor + 6-Cell Telemetry Matrix */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-6 items-stretch">
              {/* Left Focal Anchor (5 cols) */}
              <div className="lg:col-span-5 flex flex-col justify-between pr-0 lg:pr-6 lg:border-r lg:border-slate-200">
                <div>
                  <div className="flex items-center gap-4">
                    <WeatherIcon
                      code={forecast.current.weather_code}
                      isDay={forecast.current.is_day}
                      className="w-14 h-14 shrink-0"
                    />
                    <div>
                      <div className="text-5xl sm:text-6xl font-bold tracking-tight font-mono tabular-nums text-slate-900">
                        {formatTemp(forecast.current.temperature_2m, unit)}
                      </div>
                      <div className="text-base font-semibold text-slate-800 mt-1">
                        {currentCondition.label}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 mt-3 leading-relaxed">
                    {currentCondition.description}. Perceived apparent temperature is{' '}
                    <strong className="font-mono text-slate-900">
                      {formatTemp(forecast.current.apparent_temperature, unit)}
                    </strong>
                    .
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4 pt-6 mt-6 border-t border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-500 block">Today High</span>
                    <span className="font-mono text-base font-semibold text-slate-900 tabular-nums mt-0.5 block">
                      {formatTemp(dailyItems[0]?.tempMax ?? 0, unit)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Today Low</span>
                    <span className="font-mono text-base font-semibold text-slate-900 tabular-nums mt-0.5 block">
                      {formatTemp(dailyItems[0]?.tempMin ?? 0, unit)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Solar Cycle</span>
                    <span className="font-mono text-xs font-medium text-slate-800 tabular-nums mt-1 block">
                      {formatTimeShort(dailyItems[0]?.sunrise)} –{' '}
                      {formatTimeShort(dailyItems[0]?.sunset)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right 6-Metric Atmospheric Matrix (7 cols) */}
              <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-6">
                <div className="pb-4 border-b border-slate-100">
                  <span className="text-xs text-slate-500 block">Wind Velocity & Vector</span>
                  <div className="font-mono text-xl font-semibold text-slate-900 tabular-nums mt-1">
                    {Math.round(forecast.current.wind_speed_10m)} km/h{' '}
                    <span className="text-sm font-normal text-slate-600">
                      {getCardinalDirection(forecast.current.wind_direction_10m)}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 font-mono tabular-nums mt-1 block">
                    Gusts to {Math.round(forecast.current.wind_gusts_10m)} km/h (
                    {forecast.current.wind_direction_10m}°)
                  </span>
                </div>

                <div className="pb-4 border-b border-slate-100">
                  <span className="text-xs text-slate-500 block">Relative Humidity</span>
                  <div className="font-mono text-xl font-semibold text-slate-900 tabular-nums mt-1">
                    {forecast.current.relative_humidity_2m}%
                  </div>
                  <span className="text-xs text-slate-500 mt-1 block">
                    {forecast.current.relative_humidity_2m > 75
                      ? 'High atmospheric moisture'
                      : forecast.current.relative_humidity_2m < 30
                      ? 'Dry air mass'
                      : 'Balanced comfort humidity'}
                  </span>
                </div>

                <div className="pb-4 border-b border-slate-100">
                  <span className="text-xs text-slate-500 block">Current Precipitation</span>
                  <div className="font-mono text-xl font-semibold text-slate-900 tabular-nums mt-1">
                    {forecast.current.precipitation.toFixed(1)} mm
                  </div>
                  <span className="text-xs text-slate-500 font-mono tabular-nums mt-1 block">
                    Today rain chance: {dailyItems[0]?.precipitationProbMax ?? 0}%
                  </span>
                </div>

                <div className="pb-4 sm:pb-0 border-b sm:border-b-0 border-slate-100">
                  <span className="text-xs text-slate-500 block">Barometric Pressure</span>
                  <div className="font-mono text-xl font-semibold text-slate-900 tabular-nums mt-1">
                    {Math.round(forecast.current.pressure_msl)} hPa
                  </div>
                  <span className="text-xs text-slate-500 font-mono tabular-nums mt-1 block">
                    Surface: {Math.round(forecast.current.surface_pressure)} hPa
                  </span>
                </div>

                <div className="pb-4 sm:pb-0 border-b sm:border-b-0 border-slate-100">
                  <span className="text-xs text-slate-500 block">Cloud Canopy Cover</span>
                  <div className="font-mono text-xl font-semibold text-slate-900 tabular-nums mt-1">
                    {forecast.current.cloud_cover}%
                  </div>
                  <span className="text-xs text-slate-500 mt-1 block">
                    {forecast.current.cloud_cover < 20
                      ? 'Clear sky dome'
                      : forecast.current.cloud_cover < 70
                      ? 'Scattered cloud deck'
                      : 'Dense overcast layer'}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-slate-500 block">Peak Daily UV Index</span>
                  <div className="font-mono text-xl font-semibold text-slate-900 tabular-nums mt-1">
                    {(dailyItems[0]?.uvIndexMax ?? 0).toFixed(1)}
                  </div>
                  <span className="text-xs text-slate-500 mt-1 block">
                    {(dailyItems[0]?.uvIndexMax ?? 0) >= 6
                      ? 'High solar protection needed'
                      : (dailyItems[0]?.uvIndexMax ?? 0) >= 3
                      ? 'Moderate midday UV'
                      : 'Low UV exposure risk'}
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 7-Day Forecast Cards */}
        {forecast && dailyItems.length > 0 && (
          <section id="forecast-7day" aria-label="7-Day Weather Forecast" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>7-Day Synoptic Horizon</span>
                  <span aria-hidden="true">·</span>
                  <span>Select any day to inspect its hourly curve & planning brief</span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                  7-Day Daily Forecast
                </h2>
              </div>
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                Active Day: {selectedDay?.dayName} ({selectedDay?.shortDate})
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
              {dailyItems.map((day, idx) => {
                const isSelected = idx === selectedDayIndex;
                const cond = getWmoCondition(day.weatherCode, 1);

                // Range bar geometry relative to the 7-day min/max
                const leftPct = Math.max(
                  0,
                  Math.min(100, ((day.tempMin - weekMinTemp) / weekTempSpan) * 100)
                );
                const widthPct = Math.max(
                  8,
                  Math.min(
                    100 - leftPct,
                    ((day.tempMax - day.tempMin) / weekTempSpan) * 100
                  )
                );

                return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => setSelectedDayIndex(idx)}
                    className={`text-left rounded-xl p-4 transition-all flex flex-col justify-between cursor-pointer border ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white text-slate-900 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">{day.dayName}</span>
                        <span
                          className={`text-xs font-mono tabular-nums ${
                            isSelected ? 'text-slate-300' : 'text-slate-500'
                          }`}
                        >
                          {day.shortDate}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 my-3.5">
                        <WeatherIcon
                          code={day.weatherCode}
                          isDay={1}
                          className="w-7 h-7 shrink-0"
                        />
                        <div className="min-w-0">
                          <div
                            className={`text-xs font-medium truncate ${
                              isSelected ? 'text-slate-100' : 'text-slate-800'
                            }`}
                          >
                            {cond.shortLabel}
                          </div>
                          <div
                            className={`text-[11px] font-mono tabular-nums ${
                              isSelected ? 'text-sky-300' : 'text-sky-700'
                            }`}
                          >
                            {day.precipitationProbMax}% precip
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100/15">
                      <div className="flex items-center justify-between text-xs font-mono tabular-nums mb-1.5">
                        <span className={isSelected ? 'text-slate-300' : 'text-slate-500'}>
                          {formatTemp(day.tempMin, unit, false)}
                        </span>
                        <span className="font-semibold">
                          {formatTemp(day.tempMax, unit, false)}
                        </span>
                      </div>

                      {/* Relative temperature bar */}
                      <div
                        className={`w-full h-1.5 rounded-full overflow-hidden relative ${
                          isSelected ? 'bg-slate-700' : 'bg-slate-100'
                        }`}
                      >
                        <div
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                          }}
                          className={`h-full rounded-full absolute ${
                            isSelected ? 'bg-sky-400' : 'bg-sky-600'
                          }`}
                        />
                      </div>

                      <div
                        className={`flex items-center justify-between text-[11px] font-mono tabular-nums mt-2.5 ${
                          isSelected ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        <span>UV {day.uvIndexMax.toFixed(0)}</span>
                        <span>{Math.round(day.windSpeedMax)} km/h</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Interactive Temperature Chart */}
        {forecast && dailyItems.length > 0 && (
          <section id="temperature-chart" aria-label="Temperature chart">
            <TemperatureChart
              dailyItems={dailyItems}
              hourlyPoints={hourlyPoints}
              selectedDayIndex={selectedDayIndex}
              unit={unit}
              onSelectDay={setSelectedDayIndex}
            />
          </section>
        )}

        {/* Simple Planning Recommendations */}
        {forecast && recommendations.length > 0 && (
          <section
            id="planning-recommendations"
            aria-label="Planning recommendations"
            className="space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Actionable Decision Support</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Computed for {activeLocation.name} on {selectedDay?.dayName} (
                    {selectedDay?.shortDate})
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                  Daily Planning Recommendations
                </h2>
              </div>

              {selectedDayIndex !== 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedDayIndex(0)}
                  className="text-xs font-medium text-sky-700 hover:text-sky-900 underline underline-offset-4 self-start sm:self-auto cursor-pointer"
                >
                  Return to Today&apos;s Brief
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recommendations.map((rec) => {
                const isAlert = rec.severity === 'alert';
                const isCaution = rec.severity === 'caution';

                return (
                  <article
                    key={rec.id}
                    className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between"
                  >
                    <div>
                      {/* Unboxed metadata header with explicit severity icon + text (never color alone) */}
                      <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-100 text-xs">
                        <div className="flex items-center gap-2 text-slate-500">
                          <span className="font-medium text-slate-700">{rec.category}</span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={`inline-flex items-center gap-1 font-medium ${
                              isAlert
                                ? 'text-red-700'
                                : isCaution
                                ? 'text-amber-700'
                                : 'text-emerald-700'
                            }`}
                          >
                            {isAlert ? (
                              <AlertTriangle className="w-3.5 h-3.5" />
                            ) : isCaution ? (
                              <AlertCircle className="w-3.5 h-3.5" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            <span>{rec.severityText}</span>
                          </span>
                        </div>

                        <div className="font-mono tabular-nums text-slate-600">
                          <span className="text-slate-400">{rec.metricLabel}: </span>
                          <strong className="text-slate-900">{rec.metricValue}</strong>
                        </div>
                      </div>

                      <h3 className="text-base font-semibold text-slate-900 mt-4">
                        {rec.title}
                      </h3>
                      <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                        {rec.summary}
                      </p>
                    </div>

                    <ul className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                      {rec.actionItems.map((item, i) => (
                        <li
                          key={i}
                          className="text-xs text-slate-700 flex items-start gap-2"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5 text-sky-600 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-[1280px] mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-slate-400" />
            <span>Aether Weather Intelligence</span>
            <span aria-hidden="true">·</span>
            <span>Powered by Open-Meteo Geocoding & Forecast APIs</span>
          </div>
          <div className="font-mono tabular-nums">
            <span>WMO Standardized Weather Codes · Keyless Public API</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
