export function ProgressRing({
  value,
  max,
  label,
  size = 72,
  stroke = 7,
  tone = "ok",
}: {
  value: number;
  max: number;
  label: string;
  size?: number;
  stroke?: number;
  tone?: "ok" | "brand" | "orange";
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const offset = circumference * (1 - ratio);
  const toneClass =
    tone === "brand" ? "text-brand" : tone === "orange" ? "text-accent-orange" : "text-ok";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className={`${toneClass} opacity-20`}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`${toneClass} transition-[stroke-dashoffset]`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular text-fg">
        {label}
      </span>
    </div>
  );
}
