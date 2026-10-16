import React from 'react';
import Svg, { Circle, Path, Line } from 'react-native-svg';

interface IconProps {
  size?: number;
  color?: string;
}

// ─── Individual Icons ──────────────────────────────────────

export function Sun({ size = 24, color = '#F59E0B' }: IconProps) {
  const center = size / 2;
  const radius = size * 0.22;
  const rayLength = size * 0.12;
  const rayStart = radius + size * 0.06;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={center} cy={center} r={radius} fill={color} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        const x1 = center + Math.cos(rad) * rayStart;
        const y1 = center + Math.sin(rad) * rayStart;
        const x2 = center + Math.cos(rad) * (rayStart + rayLength);
        const y2 = center + Math.sin(rad) * (rayStart + rayLength);
        return (
          <Line
            key={angle}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={color}
            strokeWidth={size * 0.06}
            strokeLinecap="round"
          />
        );
      })}
    </Svg>
  );
}

export function Moon({ size = 24, color = '#6366F1' }: IconProps) {
  const s = size;
  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Path
        d={`M${s * 0.55} ${s * 0.12}
           A ${s * 0.32} ${s * 0.32} 0 1 0 ${s * 0.55} ${s * 0.88}
           A ${s * 0.26} ${s * 0.26} 0 1 1 ${s * 0.55} ${s * 0.12}Z`}
        fill={color}
      />
    </Svg>
  );
}

export function PartlyCloudy({ size = 24, color = '#6B7280' }: IconProps) {
  const s = size;
  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Circle
        cx={s * 0.62}
        cy={s * 0.28}
        r={s * 0.16}
        fill="#F59E0B"
      />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        const cx = s * 0.62;
        const cy = s * 0.28;
        const r1 = s * 0.2;
        const r2 = s * 0.26;
        return (
          <Line
            key={angle}
            x1={cx + Math.cos(rad) * r1}
            y1={cy + Math.sin(rad) * r1}
            x2={cx + Math.cos(rad) * r2}
            y2={cy + Math.sin(rad) * r2}
            stroke="#F59E0B"
            strokeWidth={s * 0.04}
            strokeLinecap="round"
          />
        );
      })}
      <Path
        d={`M${s * 0.15} ${s * 0.68}
           A ${s * 0.14} ${s * 0.14} 0 0 1 ${s * 0.28} ${s * 0.48}
           A ${s * 0.18} ${s * 0.18} 0 0 1 ${s * 0.62} ${s * 0.42}
           A ${s * 0.14} ${s * 0.14} 0 0 1 ${s * 0.78} ${s * 0.58}
           A ${s * 0.1} ${s * 0.1} 0 0 1 ${s * 0.78} ${s * 0.72}
           L ${s * 0.15} ${s * 0.72} Z`}
        fill={color}
      />
    </Svg>
  );
}

export function PartlyCloudyNight({ size = 24, color = '#6B7280' }: IconProps) {
  const s = size;
  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Path
        d={`M${s * 0.68} ${s * 0.1}
           A ${s * 0.16} ${s * 0.16} 0 1 0 ${s * 0.68} ${s * 0.42}
           A ${s * 0.12} ${s * 0.12} 0 1 1 ${s * 0.68} ${s * 0.1}Z`}
        fill="#6366F1"
      />
      <Path
        d={`M${s * 0.15} ${s * 0.68}
           A ${s * 0.14} ${s * 0.14} 0 0 1 ${s * 0.28} ${s * 0.48}
           A ${s * 0.18} ${s * 0.18} 0 0 1 ${s * 0.62} ${s * 0.42}
           A ${s * 0.14} ${s * 0.14} 0 0 1 ${s * 0.78} ${s * 0.58}
           A ${s * 0.1} ${s * 0.1} 0 0 1 ${s * 0.78} ${s * 0.72}
           L ${s * 0.15} ${s * 0.72} Z`}
        fill={color}
      />
    </Svg>
  );
}

export function Cloudy({ size = 24, color = '#9CA3AF' }: IconProps) {
  const s = size;
  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Path
        d={`M${s * 0.18} ${s * 0.58}
           A ${s * 0.12} ${s * 0.12} 0 0 1 ${s * 0.22} ${s * 0.36}
           A ${s * 0.18} ${s * 0.18} 0 0 1 ${s * 0.56} ${s * 0.26}
           A ${s * 0.15} ${s * 0.15} 0 0 1 ${s * 0.78} ${s * 0.38}
           A ${s * 0.12} ${s * 0.12} 0 0 1 ${s * 0.82} ${s * 0.58}
           L ${s * 0.18} ${s * 0.58} Z`}
        fill={color}
        opacity={0.6}
      />
      <Path
        d={`M${s * 0.1} ${s * 0.72}
           A ${s * 0.14} ${s * 0.14} 0 0 1 ${s * 0.18} ${s * 0.48}
           A ${s * 0.2} ${s * 0.2} 0 0 1 ${s * 0.58} ${s * 0.38}
           A ${s * 0.16} ${s * 0.16} 0 0 1 ${s * 0.82} ${s * 0.52}
           A ${s * 0.12} ${s * 0.12} 0 0 1 ${s * 0.86} ${s * 0.72}
           L ${s * 0.1} ${s * 0.72} Z`}
        fill={color}
      />
    </Svg>
  );
}

export function Rain({ size = 24, color = '#3B82F6' }: IconProps) {
  const s = size;
  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Path
        d={`M${s * 0.12} ${s * 0.52}
           A ${s * 0.12} ${s * 0.12} 0 0 1 ${s * 0.2} ${s * 0.32}
           A ${s * 0.18} ${s * 0.18} 0 0 1 ${s * 0.58} ${s * 0.24}
           A ${s * 0.14} ${s * 0.14} 0 0 1 ${s * 0.8} ${s * 0.38}
           A ${s * 0.1} ${s * 0.1} 0 0 1 ${s * 0.82} ${s * 0.52}
           L ${s * 0.12} ${s * 0.52} Z`}
        fill="#9CA3AF"
      />
      <Line x1={s * 0.28} y1={s * 0.6} x2={s * 0.22} y2={s * 0.76} stroke={color} strokeWidth={s * 0.05} strokeLinecap="round" />
      <Line x1={s * 0.46} y1={s * 0.6} x2={s * 0.4} y2={s * 0.76} stroke={color} strokeWidth={s * 0.05} strokeLinecap="round" />
      <Line x1={s * 0.64} y1={s * 0.6} x2={s * 0.58} y2={s * 0.76} stroke={color} strokeWidth={s * 0.05} strokeLinecap="round" />
    </Svg>
  );
}

export function HeavyRain({ size = 24, color = '#2563EB' }: IconProps) {
  const s = size;
  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Path
        d={`M${s * 0.12} ${s * 0.48}
           A ${s * 0.12} ${s * 0.12} 0 0 1 ${s * 0.2} ${s * 0.28}
           A ${s * 0.18} ${s * 0.18} 0 0 1 ${s * 0.58} ${s * 0.2}
           A ${s * 0.14} ${s * 0.14} 0 0 1 ${s * 0.8} ${s * 0.34}
           A ${s * 0.1} ${s * 0.1} 0 0 1 ${s * 0.82} ${s * 0.48}
           L ${s * 0.12} ${s * 0.48} Z`}
        fill="#6B7280"
      />
      <Line x1={s * 0.22} y1={s * 0.56} x2={s * 0.14} y2={s * 0.76} stroke={color} strokeWidth={s * 0.06} strokeLinecap="round" />
      <Line x1={s * 0.38} y1={s * 0.56} x2={s * 0.3} y2={s * 0.76} stroke={color} strokeWidth={s * 0.06} strokeLinecap="round" />
      <Line x1={s * 0.54} y1={s * 0.56} x2={s * 0.46} y2={s * 0.76} stroke={color} strokeWidth={s * 0.06} strokeLinecap="round" />
      <Line x1={s * 0.7} y1={s * 0.56} x2={s * 0.62} y2={s * 0.76} stroke={color} strokeWidth={s * 0.06} strokeLinecap="round" />
      <Line x1={s * 0.3} y1={s * 0.78} x2={s * 0.24} y2={s * 0.9} stroke={color} strokeWidth={s * 0.05} strokeLinecap="round" />
      <Line x1={s * 0.54} y1={s * 0.78} x2={s * 0.48} y2={s * 0.9} stroke={color} strokeWidth={s * 0.05} strokeLinecap="round" />
    </Svg>
  );
}

export function Snow({ size = 24, color = '#93C5FD' }: IconProps) {
  const s = size;
  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Path
        d={`M${s * 0.12} ${s * 0.48}
           A ${s * 0.12} ${s * 0.12} 0 0 1 ${s * 0.2} ${s * 0.28}
           A ${s * 0.18} ${s * 0.18} 0 0 1 ${s * 0.58} ${s * 0.2}
           A ${s * 0.14} ${s * 0.14} 0 0 1 ${s * 0.8} ${s * 0.34}
           A ${s * 0.1} ${s * 0.1} 0 0 1 ${s * 0.82} ${s * 0.48}
           L ${s * 0.12} ${s * 0.48} Z`}
        fill="#9CA3AF"
      />
      <Circle cx={s * 0.25} cy={s * 0.62} r={s * 0.03} fill={color} />
      <Circle cx={s * 0.42} cy={s * 0.58} r={s * 0.03} fill={color} />
      <Circle cx={s * 0.6} cy={s * 0.62} r={s * 0.03} fill={color} />
      <Circle cx={s * 0.75} cy={s * 0.58} r={s * 0.03} fill={color} />
      <Circle cx={s * 0.32} cy={s * 0.74} r={s * 0.03} fill={color} />
      <Circle cx={s * 0.5} cy={s * 0.72} r={s * 0.03} fill={color} />
      <Circle cx={s * 0.68} cy={s * 0.74} r={s * 0.03} fill={color} />
      <Circle cx={s * 0.22} cy={s * 0.84} r={s * 0.03} fill={color} />
      <Circle cx={s * 0.42} cy={s * 0.86} r={s * 0.03} fill={color} />
      <Circle cx={s * 0.62} cy={s * 0.84} r={s * 0.03} fill={color} />
    </Svg>
  );
}

export function Thunderstorm({ size = 24, color = '#F59E0B' }: IconProps) {
  const s = size;
  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Path
        d={`M${s * 0.12} ${s * 0.42}
           A ${s * 0.12} ${s * 0.12} 0 0 1 ${s * 0.2} ${s * 0.22}
           A ${s * 0.18} ${s * 0.18} 0 0 1 ${s * 0.58} ${s * 0.14}
           A ${s * 0.14} ${s * 0.14} 0 0 1 ${s * 0.8} ${s * 0.28}
           A ${s * 0.1} ${s * 0.1} 0 0 1 ${s * 0.82} ${s * 0.42}
           L ${s * 0.12} ${s * 0.42} Z`}
        fill="#6B7280"
      />
      <Path
        d={`M${s * 0.48} ${s * 0.46}
           L${s * 0.36} ${s * 0.66}
           L${s * 0.48} ${s * 0.66}
           L${s * 0.4} ${s * 0.88}
           L${s * 0.62} ${s * 0.6}
           L${s * 0.5} ${s * 0.6}
           L${s * 0.58} ${s * 0.46} Z`}
        fill={color}
      />
    </Svg>
  );
}

export function Fog({ size = 24, color = '#D1D5DB' }: IconProps) {
  const s = size;
  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Line x1={s * 0.15} y1={s * 0.3} x2={s * 0.85} y2={s * 0.3} stroke={color} strokeWidth={s * 0.06} strokeLinecap="round" />
      <Line x1={s * 0.1} y1={s * 0.44} x2={s * 0.9} y2={s * 0.44} stroke={color} strokeWidth={s * 0.06} strokeLinecap="round" />
      <Line x1={s * 0.15} y1={s * 0.58} x2={s * 0.85} y2={s * 0.58} stroke={color} strokeWidth={s * 0.06} strokeLinecap="round" />
      <Line x1={s * 0.2} y1={s * 0.72} x2={s * 0.8} y2={s * 0.72} stroke={color} strokeWidth={s * 0.06} strokeLinecap="round" />
    </Svg>
  );
}

export function Wind({ size = 24, color = '#6B7280' }: IconProps) {
  const s = size;
  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Path
        d={`M${s * 0.1} ${s * 0.36} L${s * 0.62} ${s * 0.36}
           A ${s * 0.08} ${s * 0.08} 0 1 0 ${s * 0.62} ${s * 0.2}`}
        fill="none"
        stroke={color}
        strokeWidth={s * 0.05}
        strokeLinecap="round"
      />
      <Path
        d={`M${s * 0.1} ${s * 0.54} L${s * 0.76} ${s * 0.54}
           A ${s * 0.1} ${s * 0.1} 0 1 0 ${s * 0.76} ${s * 0.34}`}
        fill="none"
        stroke={color}
        strokeWidth={s * 0.05}
        strokeLinecap="round"
      />
      <Path
        d={`M${s * 0.1} ${s * 0.72} L${s * 0.52} ${s * 0.72}
           A ${s * 0.07} ${s * 0.07} 0 1 0 ${s * 0.52} ${s * 0.58}`}
        fill="none"
        stroke={color}
        strokeWidth={s * 0.05}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// ─── Icon Resolver ─────────────────────────────────────────

const ICON_COMPONENTS: Record<string, React.FC<IconProps>> = {
  sun: Sun,
  moon: Moon,
  partlyCloudy: PartlyCloudy,
  partlyCloudyNight: PartlyCloudyNight,
  cloudy: Cloudy,
  rain: Rain,
  heavyRain: HeavyRain,
  snow: Snow,
  thunderstorm: Thunderstorm,
  fog: Fog,
  wind: Wind,
};

/**
 * Resolve a yr.no symbol code to the appropriate weather icon component.
 * Optionally override night detection.
 */
export function getWeatherIcon(
  symbolCode: string | null,
  isNight?: boolean,
): React.FC<IconProps> {
  if (!symbolCode) return Cloudy;

  const code = symbolCode.toLowerCase();

  // Night variants
  if (isNight !== undefined) {
    if (code.includes('clearsky')) return isNight ? Moon : Sun;
    if (code.includes('fair') || code.includes('partlycloudy')) {
      return isNight ? PartlyCloudyNight : PartlyCloudy;
    }
  }

  // Auto-detect night from symbol code suffix
  if (code.includes('_night')) {
    if (code.includes('clearsky')) return Moon;
    if (code.includes('fair') || code.includes('partlycloudy')) return PartlyCloudyNight;
  }

  if (code.includes('_day') || code.includes('_polartwilight')) {
    if (code.includes('clearsky')) return Sun;
    if (code.includes('fair') || code.includes('partlycloudy')) return PartlyCloudy;
  }

  // Weather condition matching
  if (code.includes('thunder')) return Thunderstorm;
  if (code.includes('heavyrain') || code.includes('heavysleet')) return HeavyRain;
  if (code.includes('rain') || code.includes('sleet')) return Rain;
  if (code.includes('snow')) return Snow;
  if (code.includes('fog')) return Fog;
  if (code.includes('cloudy')) return Cloudy;
  if (code.includes('clearsky')) return Sun;
  if (code.includes('fair') || code.includes('partlycloudy')) return PartlyCloudy;

  return Cloudy;
}
