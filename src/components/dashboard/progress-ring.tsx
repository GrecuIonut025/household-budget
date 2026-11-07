const TONE_STROKE = {
  brand: "#a78bfa",
  green: "#34d399",
  orange: "#fbbf24",
  purple: "#8b5cf6",
} as const;

export function ProgressRing({
  value,
  max,
  label,
  size = 72,
  stroke = 7,
  tone = "green",
}: {
  value: number;
  max: number;
  label: string;
  size?: number;
  stroke?: number;
  tone?: keyof typeof TONE_STROKE;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const offset = circumference * (1 - ratio);
  const color = TONE_STROKE[tone];

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--chart-track)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset]"
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular"
        style={{ color }}
      >
        {label}
      </span>
    </div>
  );
}
