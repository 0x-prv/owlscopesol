type RiskLevel = "Low" | "Medium" | "High" | "Unknown" | string | null;

type RiskGaugeProps = {
  score: number | null;
  level: RiskLevel;
  confidence: number | null;
  size?: number;
};

const LEVEL_COLOR_VAR: Record<string, string> = {
  Low: "var(--risk-low)",
  Medium: "var(--risk-medium)",
  High: "var(--risk-high)",
};

const LEVEL_BG_VAR: Record<string, string> = {
  Low: "var(--risk-low-bg)",
  Medium: "var(--risk-medium-bg)",
  High: "var(--risk-high-bg)",
};

export default function RiskGauge({
  score,
  level,
  confidence,
  size = 176,
}: RiskGaugeProps) {
  const strokeWidth = size * 0.09;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const clampedScore =
    score !== null && Number.isFinite(score)
      ? Math.max(0, Math.min(100, score))
      : null;

  const normalizedLevel = level && LEVEL_COLOR_VAR[level] ? level : "Unknown";
  const strokeColor = LEVEL_COLOR_VAR[normalizedLevel] ?? "var(--risk-unknown)";
  const bgColor = LEVEL_BG_VAR[normalizedLevel] ?? "var(--risk-unknown-bg)";

  const dashOffset =
    clampedScore !== null
      ? circumference * (1 - clampedScore / 100)
      : circumference * 0.25; // sliver of a ring for "unknown"

  // Lower confidence -> more transparent arc. Floor at 0.35 so it's
  // never fully invisible, even at very low confidence.
  const confidenceOpacity =
    confidence !== null && Number.isFinite(confidence)
      ? 0.35 + (Math.max(0, Math.min(100, confidence)) / 100) * 0.65
      : 0.35;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Risk level ${normalizedLevel}, score ${
        clampedScore !== null ? clampedScore : "unavailable"
      } out of 100, ${
        confidence !== null ? `${confidence}% confidence` : "confidence unavailable"
      }`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          opacity={confidenceOpacity}
          style={{ transition: "stroke-dashoffset 0.6s ease, opacity 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span
          className="font-mono font-semibold leading-none"
          style={{ fontSize: size * 0.22, color: strokeColor }}
        >
          {clampedScore !== null ? Math.round(clampedScore) : "—"}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-medium font-sans"
          style={{ backgroundColor: bgColor, color: strokeColor }}
        >
          {normalizedLevel}
        </span>
        {confidence !== null ? (
          <span className="mt-1 text-[10px] text-muted font-mono">
            {Math.round(confidence)}% confidence
          </span>
        ) : null}
      </div>
    </div>
  );
}