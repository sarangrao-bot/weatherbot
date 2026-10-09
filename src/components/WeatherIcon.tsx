import React from 'react';
import {
  Sun,
  Moon,
  CloudSun,
  CloudMoon,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudLightning,
} from 'lucide-react';
import { getWmoCondition } from '../services/openMeteo';

interface WeatherIconProps {
  code: number;
  isDay?: number;
  className?: string;
}

export const WeatherIcon: React.FC<WeatherIconProps> = ({
  code,
  isDay = 1,
  className = 'w-6 h-6',
}) => {
  const condition = getWmoCondition(code, isDay);

  if (code === 0) {
    return isDay ? (
      <Sun className={`${className} text-amber-500`} />
    ) : (
      <Moon className={`${className} text-sky-400`} />
    );
  }

  if (code === 1 || code === 2) {
    return isDay ? (
      <CloudSun className={`${className} text-amber-500`} />
    ) : (
      <CloudMoon className={`${className} text-sky-400`} />
    );
  }

  switch (condition.category) {
    case 'cloudy':
      return <Cloud className={`${className} text-slate-500`} />;
    case 'fog':
      return <CloudFog className={`${className} text-slate-400`} />;
    case 'drizzle':
      return <CloudDrizzle className={`${className} text-sky-500`} />;
    case 'rain':
      return <CloudRain className={`${className} text-sky-600`} />;
    case 'snow':
      return <CloudSnow className={`${className} text-cyan-500`} />;
    case 'storm':
      return <CloudLightning className={`${className} text-amber-600`} />;
    default:
      return <Sun className={`${className} text-amber-500`} />;
  }
};
