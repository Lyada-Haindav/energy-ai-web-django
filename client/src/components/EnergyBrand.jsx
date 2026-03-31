import { useId } from "react";

export function EnergyLogo({ size = 44, className = "" }) {
  const id = useId().replace(/:/g, "");
  const shellGradient = `energy-shell-${id}`;
  const glowGradient = `energy-glow-${id}`;
  const strokeGradient = `energy-stroke-${id}`;

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={shellGradient} x1="10" y1="8" x2="54" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8B5CF6" />
          <stop offset="0.48" stopColor="#4F46E5" />
          <stop offset="1" stopColor="#06B6D4" />
        </linearGradient>
        <radialGradient id={glowGradient} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(32 32) rotate(90) scale(24)">
          <stop stopColor="#67E8F9" stopOpacity="0.95" />
          <stop offset="0.42" stopColor="#4F46E5" stopOpacity="0.34" />
          <stop offset="1" stopColor="#020617" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={strokeGradient} x1="18" y1="18" x2="46" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#C4B5FD" />
          <stop offset="1" stopColor="#67E8F9" />
        </linearGradient>
      </defs>

      <rect x="6" y="6" width="52" height="52" rx="18" fill="#050816" />
      <rect x="7" y="7" width="50" height="50" rx="17" stroke={`url(#${shellGradient})`} strokeOpacity="0.65" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="18" fill={`url(#${glowGradient})`} />
      <circle cx="32" cy="32" r="13.5" stroke={`url(#${strokeGradient})`} strokeOpacity="0.46" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="7.5" stroke={`url(#${strokeGradient})`} strokeOpacity="0.22" strokeWidth="1.25" />
      <path
        d="M33.5 16L21.5 34.8H30.8L29.2 48L42.5 28.8H33.7L33.5 16Z"
        fill={`url(#${shellGradient})`}
      />
      <path
        d="M33.5 16L21.5 34.8H30.8L29.2 48L42.5 28.8H33.7L33.5 16Z"
        stroke="rgba(255,255,255,0.55)"
        strokeOpacity="0.35"
        strokeLinejoin="round"
      />
      <circle cx="47" cy="17" r="2.5" fill="#67E8F9" fillOpacity="0.9" />
      <circle cx="18" cy="46" r="2" fill="#8B5CF6" fillOpacity="0.9" />
    </svg>
  );
}

export default function EnergyBrand({
  size = 44,
  className = "",
  titleClassName = "",
  subtitleClassName = "",
  showSubtitle = true
}) {
  return (
    <div className={`flex min-w-0 items-center gap-3 ${className}`}>
      <EnergyLogo size={size} className="shrink-0 drop-shadow-[0_18px_30px_rgba(79,70,229,0.28)]" />
      <div className="min-w-0">
        <p className={`truncate font-display font-bold tracking-[-0.04em] text-[#173324] ${titleClassName}`}>Energy AI</p>
        {showSubtitle ? (
          <p className={`truncate uppercase tracking-[0.22em] text-[#6f8075] ${subtitleClassName}`}>Low-energy speed. High-energy depth.</p>
        ) : null}
      </div>
    </div>
  );
}
