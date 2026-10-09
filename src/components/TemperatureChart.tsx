import React, { useState } from 'react';
import { DailyForecastItem, HourlyPoint, TemperatureUnit } from '../types/weather';
import { convertTempValue, formatTemp, getWmoCondition } from '../services/openMeteo';

interface TemperatureChartProps {
  dailyItems: DailyForecastItem[];
  hourlyPoints: HourlyPoint[];
  selectedDayIndex: number;
  unit: TemperatureUnit;
  onSelectDay: (index: number) => void;
}

type ChartMode = 'hourly' | 'weekly';

export const TemperatureChart: React.FC<TemperatureChartProps> = ({
  dailyItems,
  hourlyPoints,
  selectedDayIndex,
  unit,
  onSelectDay,
}) => {
  const [chartMode, setChartMode] = useState<ChartMode>('hourly');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const selectedDay = dailyItems[selectedDayIndex] || dailyItems[0];
  const unitSymbol = unit === 'fahrenheit' ? '°F' : '°C';

  // Filter hourly points to 24 hours of selected day
  const displayHourly = hourlyPoints.slice(0, 24);

  // Dimensions for SVG
  const width = 880;
  const height = 270;
  const padLeft = 48;
  const padRight = 28;
  const padTop = 32;
  const padBottom = 46;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  if (chartMode === 'hourly' && displayHourly.length > 0) {
    const temps = displayHourly.map((p) => convertTempValue(p.temp, unit));
    const feels = displayHourly.map((p) => convertTempValue(p.feelsLike, unit));
    const allVals = [...temps, ...feels];
    const minVal = Math.floor(Math.min(...allVals) - 2);
    const maxVal = Math.ceil(Math.max(...allVals) + 2);
    const valSpan = Math.max(4, maxVal - minVal);

    const getX = (idx: number) =>
      padLeft + (idx / Math.max(1, displayHourly.length - 1)) * plotWidth;
    const getY = (val: number) =>
      padTop + plotHeight - ((val - minVal) / valSpan) * plotHeight;

    const tempCoords = temps.map((val, idx) => ({ x: getX(idx), y: getY(val), val }));
    const feelsCoords = feels.map((val, idx) => ({ x: getX(idx), y: getY(val), val }));

    const linePath = tempCoords
      .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
      .join(' ');

    const feelsPath = feelsCoords
      .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
      .join(' ');

    const areaPath = `${linePath} L ${tempCoords[tempCoords.length - 1].x.toFixed(
      1
    )} ${(padTop + plotHeight).toFixed(1)} L ${tempCoords[0].x.toFixed(1)} ${(
      padTop + plotHeight
    ).toFixed(1)} Z`;

    const gridTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
      const val = Math.round(minVal + t * valSpan);
      const y = getY(val);
      return { val, y };
    });

    const activeIdx = hoverIndex !== null && hoverIndex < displayHourly.length ? hoverIndex : null;
    const activePoint = activeIdx !== null ? displayHourly[activeIdx] : null;

    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Diurnal Thermal Curve</span>
              <span aria-hidden="true">·</span>
              <span>
                {selectedDay?.dayName} ({selectedDay?.shortDate})
              </span>
              <span aria-hidden="true">·</span>
              <span>24-Hour Resolution</span>
            </div>
            <h2 className="text-lg font-semibold text-slate-900 mt-1">
              Temperature & Apparent Feel Trajectory
            </h2>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <div className="hidden md:flex items-center gap-4 text-xs text-slate-600 mr-2">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-sky-600 inline-block" />
                <span>Air Temp ({unitSymbol})</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-slate-400 border-b border-dashed border-slate-400 inline-block" />
                <span>Feels Like</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-sky-100 border border-sky-300 inline-block" />
                <span>Precip %</span>
              </span>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setChartMode('hourly');
                  setHoverIndex(null);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  chartMode === 'hourly'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                24-Hour Curve
              </button>
              <button
                type="button"
                onClick={() => {
                  setChartMode('weekly');
                  setHoverIndex(null);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  chartMode === 'weekly'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                7-Day High / Low
              </button>
            </div>
          </div>
        </div>

        {/* Interactive readout bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 py-3 px-4 my-4 bg-slate-50 border border-slate-200/80 rounded-lg text-xs">
          {activePoint ? (
            <>
              <div className="flex items-center gap-3">
                <span className="font-mono font-semibold text-slate-900">
                  {activePoint.hourLabel}
                </span>
                <span className="text-slate-400">·</span>
                <span className="font-medium text-slate-700">
                  {getWmoCondition(activePoint.weatherCode).label}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 font-mono tabular-nums">
                <span>
                  Temp:{' '}
                  <strong className="text-sky-700">
                    {formatTemp(activePoint.temp, unit)}
                  </strong>
                </span>
                <span>
                  Feels:{' '}
                  <strong className="text-slate-800">
                    {formatTemp(activePoint.feelsLike, unit)}
                  </strong>
                </span>
                <span>
                  Precip: <strong className="text-sky-700">{activePoint.precipProb}%</strong>
                </span>
                <span>
                  Wind: <strong className="text-slate-800">{Math.round(activePoint.windSpeed)} km/h</strong>
                </span>
                <span>
                  UV: <strong className="text-slate-800">{activePoint.uvIndex.toFixed(1)}</strong>
                </span>
              </div>
            </>
          ) : (
            <>
              <span className="text-slate-600">
                Hover or tap across the chart to inspect hourly temperature, wind, and rain probability.
              </span>
              <div className="flex items-center gap-4 font-mono tabular-nums text-slate-700">
                <span>
                  Day High: <strong>{formatTemp(selectedDay.tempMax, unit)}</strong>
                </span>
                <span>
                  Day Low: <strong>{formatTemp(selectedDay.tempMin, unit)}</strong>
                </span>
                <span>
                  Peak Rain: <strong>{selectedDay.precipitationProbMax}%</strong>
                </span>
              </div>
            </>
          )}
        </div>

        {/* SVG Chart */}
        <div className="relative w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto min-w-[600px] select-none"
            role="img"
            aria-label={`24-hour temperature chart for ${selectedDay?.dayName}`}
            onMouseLeave={() => setHoverIndex(null)}
          >
            <defs>
              <linearGradient id="tempAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0284c7" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal grid lines */}
            {gridTicks.map((tick, i) => (
              <g key={i}>
                <line
                  x1={padLeft}
                  y1={tick.y}
                  x2={width - padRight}
                  y2={tick.y}
                  stroke="#e2e8f0"
                  strokeDasharray={i === 0 ? undefined : '3 3'}
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 10}
                  y={tick.y + 4}
                  textAnchor="end"
                  className="fill-slate-400 font-mono text-[11px]"
                >
                  {tick.val}°
                </text>
              </g>
            ))}

            {/* Precipitation probability bars along the bottom */}
            {displayHourly.map((pt, idx) => {
              const x = getX(idx);
              const barH = (pt.precipProb / 100) * (plotHeight * 0.35);
              const barY = padTop + plotHeight - barH;
              return (
                <rect
                  key={`precip-${idx}`}
                  x={x - 6}
                  y={barY}
                  width={12}
                  height={Math.max(0, barH)}
                  rx={2}
                  fill="#bae6fd"
                  opacity={activeIdx === idx ? 0.85 : 0.45}
                />
              );
            })}

            {/* Area under primary temperature curve */}
            <path d={areaPath} fill="url(#tempAreaGrad)" />

            {/* Apparent temperature dashed line */}
            <path
              d={feelsPath}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="1.75"
              strokeDasharray="4 4"
            />

            {/* Primary temperature curve */}
            <path
              d={linePath}
              fill="none"
              stroke="#0284c7"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Active hover crosshair */}
            {activeIdx !== null && tempCoords[activeIdx] && (
              <line
                x1={tempCoords[activeIdx].x}
                y1={padTop}
                x2={tempCoords[activeIdx].x}
                y2={padTop + plotHeight}
                stroke="#0f172a"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
            )}

            {/* Data points & labels every 3 hours */}
            {tempCoords.map((pt, idx) => {
              const isSelected = activeIdx === idx;
              const showLabel = idx % 3 === 0 || idx === tempCoords.length - 1;
              return (
                <g key={`pt-${idx}`}>
                  {(showLabel || isSelected) && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isSelected ? 5 : 3}
                      className={
                        isSelected
                          ? 'fill-sky-600 stroke-white stroke-2'
                          : 'fill-white stroke-sky-600 stroke-2'
                      }
                    />
                  )}
                  {showLabel && (
                    <>
                      <text
                        x={pt.x}
                        y={pt.y - 10}
                        textAnchor="middle"
                        className="fill-slate-700 font-mono text-[10px] font-medium"
                      >
                        {Math.round(pt.val)}°
                      </text>
                      <text
                        x={pt.x}
                        y={height - 14}
                        textAnchor="middle"
                        className="fill-slate-500 font-mono text-[11px]"
                      >
                        {displayHourly[idx].hourLabel}
                      </text>
                    </>
                  )}
                  {/* Invisible hit column for smooth hover */}
                  <rect
                    x={pt.x - plotWidth / displayHourly.length / 2}
                    y={padTop}
                    width={plotWidth / displayHourly.length}
                    height={plotHeight}
                    fill="transparent"
                    className="cursor-crosshair"
                    onMouseEnter={() => setHoverIndex(idx)}
                    onClick={() => setHoverIndex(idx)}
                  />
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    );
  }

  // 7-Day High / Low Range Chart Mode
  const maxTemps = dailyItems.map((d) => convertTempValue(d.tempMax, unit));
  const minTemps = dailyItems.map((d) => convertTempValue(d.tempMin, unit));
  const allWeekly = [...maxTemps, ...minTemps];
  const minW = Math.floor(Math.min(...allWeekly) - 3);
  const maxW = Math.ceil(Math.max(...allWeekly) + 3);
  const spanW = Math.max(5, maxW - minW);

  const getWX = (idx: number) =>
    padLeft + 36 + (idx / Math.max(1, dailyItems.length - 1)) * (plotWidth - 72);
  const getWY = (val: number) =>
    padTop + plotHeight - ((val - minW) / spanW) * plotHeight;

  const highCoords = maxTemps.map((val, idx) => ({ x: getWX(idx), y: getWY(val), val }));
  const lowCoords = minTemps.map((val, idx) => ({ x: getWX(idx), y: getWY(val), val }));

  const highPath = highCoords
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ');
  const lowPath = lowCoords
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ');

  const bandPath = `${highPath} ${[...lowCoords]
    .reverse()
    .map((pt) => `L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ')} Z`;

  const weeklyTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const val = Math.round(minW + t * spanW);
    return { val, y: getWY(val) };
  });

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Synoptic 7-Day Envelope</span>
            <span aria-hidden="true">·</span>
            <span>Daily Maxima & Minima</span>
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mt-1">
            7-Day Temperature Range & Trend
          </h2>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div className="hidden md:flex items-center gap-4 text-xs text-slate-600 mr-2">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-sky-600 inline-block" />
              <span>Daily High ({unitSymbol})</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-slate-500 inline-block" />
              <span>Daily Low ({unitSymbol})</span>
            </span>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setChartMode('hourly');
                setHoverIndex(null);
              }}
              className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 text-slate-600 hover:text-slate-900"
            >
              24-Hour Curve
            </button>
            <button
              type="button"
              onClick={() => {
                setChartMode('weekly');
                setHoverIndex(null);
              }}
              className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 bg-white text-slate-900 shadow-xs"
            >
              7-Day High / Low
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 py-3 px-4 my-4 bg-slate-50 border border-slate-200/80 rounded-lg text-xs">
        <span className="text-slate-600">
          Click any day node on the chart to inspect its 24-hour curve and specific planning guidance.
        </span>
        <div className="flex items-center gap-4 font-mono tabular-nums text-slate-700">
          <span>
            7-Day Peak: <strong>{Math.round(Math.max(...maxTemps))}{unitSymbol}</strong>
          </span>
          <span>
            7-Day Floor: <strong>{Math.round(Math.min(...minTemps))}{unitSymbol}</strong>
          </span>
        </div>
      </div>

      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto min-w-[600px] select-none"
          role="img"
          aria-label="7-day high and low temperature trend chart"
        >
          {weeklyTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={padLeft}
                y1={tick.y}
                x2={width - padRight}
                y2={tick.y}
                stroke="#e2e8f0"
                strokeDasharray={i === 0 ? undefined : '3 3'}
                strokeWidth="1"
              />
              <text
                x={padLeft - 10}
                y={tick.y + 4}
                textAnchor="end"
                className="fill-slate-400 font-mono text-[11px]"
              >
                {tick.val}°
              </text>
            </g>
          ))}

          {/* Shaded diurnal range band */}
          <path d={bandPath} fill="#0284c7" fillOpacity="0.1" />

          {/* High & Low paths */}
          <path
            d={highPath}
            fill="none"
            stroke="#0284c7"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={lowPath}
            fill="none"
            stroke="#64748b"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {dailyItems.map((day, idx) => {
            const hPt = highCoords[idx];
            const lPt = lowCoords[idx];
            const isSelected = idx === selectedDayIndex;
            return (
              <g
                key={day.date}
                className="cursor-pointer"
                onClick={() => onSelectDay(idx)}
              >
                <line
                  x1={hPt.x}
                  y1={hPt.y}
                  x2={lPt.x}
                  y2={lPt.y}
                  stroke={isSelected ? '#0284c7' : '#cbd5e1'}
                  strokeWidth={isSelected ? '3' : '1.5'}
                />
                <circle
                  cx={hPt.x}
                  cy={hPt.y}
                  r={isSelected ? 5.5 : 4}
                  className={
                    isSelected
                      ? 'fill-sky-600 stroke-white stroke-2'
                      : 'fill-white stroke-sky-600 stroke-2'
                  }
                />
                <circle
                  cx={lPt.x}
                  cy={lPt.y}
                  r={isSelected ? 5 : 3.5}
                  className={
                    isSelected
                      ? 'fill-slate-700 stroke-white stroke-2'
                      : 'fill-white stroke-slate-500 stroke-2'
                  }
                />
                <text
                  x={hPt.x}
                  y={hPt.y - 11}
                  textAnchor="middle"
                  className="fill-slate-900 font-mono text-[11px] font-semibold"
                >
                  {Math.round(hPt.val)}°
                </text>
                <text
                  x={lPt.x}
                  y={lPt.y + 18}
                  textAnchor="middle"
                  className="fill-slate-500 font-mono text-[11px]"
                >
                  {Math.round(lPt.val)}°
                </text>
                <text
                  x={hPt.x}
                  y={height - 12}
                  textAnchor="middle"
                  className={`font-sans text-[11px] ${
                    isSelected ? 'fill-sky-700 font-semibold' : 'fill-slate-600 font-medium'
                  }`}
                >
                  {day.dayName}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
