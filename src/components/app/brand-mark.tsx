/** The RozFit mark: three rising steps, one for each day of steady practice. */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={`brand-mark ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id="rozfit-step" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#5fd4a2" />
          <stop offset="1" stopColor="#8b78f0" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="#0e1614" />
      <rect x="13" y="36" width="10" height="15" rx="5" fill="url(#rozfit-step)" />
      <rect x="27" y="26" width="10" height="25" rx="5" fill="url(#rozfit-step)" />
      <rect x="41" y="14" width="10" height="37" rx="5" fill="url(#rozfit-step)" />
    </svg>
  );
}
