/**
 * Score gauge: a single SVG ring whose arc length and stroke color encode the
 * 0–10000 bps credit score. Color interpolates red → amber → emerald.
 */
type Props = {
  scoreBps: number; // 0 .. 10000
  size?: number;
  strokeWidth?: number;
  label?: string; // optional center label (e.g. token symbol)
};

const RED = [239, 68, 68];
const AMBER = [245, 158, 11];
const GREEN = [45, 212, 168];

function lerp(a: number[], b: number[], t: number) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}

function colorForScore(scoreBps: number): string {
  const t = Math.max(0, Math.min(10000, scoreBps)) / 10000;
  // 0 → red, 0.5 → amber, 1.0 → green
  const rgb = t < 0.5 ? lerp(RED, AMBER, t * 2) : lerp(AMBER, GREEN, (t - 0.5) * 2);
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

export function CircularGauge({ scoreBps, size = 96, strokeWidth = 8, label }: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(10000, scoreBps)) / 10000;
  const dash = pct * circumference;
  const color = colorForScore(scoreBps);
  const center = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference}`}
        transform={`rotate(-90 ${center} ${center})`}
        style={{ transition: "stroke-dasharray 600ms ease, stroke 400ms ease" }}
      />
      <text
        x={center}
        y={center + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="var(--font-mono)"
        fontSize={size * 0.18}
        fill={color}
      >
        {(scoreBps / 100).toFixed(0)}
        <tspan fontSize={size * 0.1} fill="rgba(228,228,231,0.4)">
          %
        </tspan>
      </text>
      {label && (
        <text
          x={center}
          y={center + size * 0.18}
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="var(--font-mono)"
          fontSize={size * 0.08}
          fill="rgba(228,228,231,0.45)"
          letterSpacing="0.15em"
        >
          {label.toUpperCase()}
        </text>
      )}
    </svg>
  );
}
