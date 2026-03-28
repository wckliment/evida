export default function EvidaLogo({
  size = 180,
  color = "#00E5FF",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size * 0.3}
      viewBox="0 0 200 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Top line */}
      <rect x="20" y="12" width="60" height="3" rx="1.5" fill={color} />

      {/* Middle line */}
      <rect x="0" y="28" width="100" height="3" rx="1.5" fill={color} />

      {/* Bottom line */}
      <rect x="20" y="44" width="60" height="3" rx="1.5" fill={color} />

      {/* Diamond */}
      <g transform="translate(105.9, 29.85) rotate(45)">
        <rect
          x="-5"
          y="-5"
          width="10"
          height="10"
          stroke={color}
          strokeWidth="2.25"
          fill="none"
        />
      </g>

      {/* Text */}
      <text
        x="120"
        y="40"
        fill={color}
        fontSize="28"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="500"
        letterSpacing="0"
      >
        EVIDA
      </text>
    </svg>
  );
}