interface BrandLogoProps {
  inverse?: boolean;
  className?: string;
}

/** Vector wordmark based on the supplied EaseDial teal-and-gold identity. */
export function BrandLogo({ inverse = false, className = '' }: BrandLogoProps) {
  const wordColor = inverse ? '#ffffff' : '#086577';
  return (
    <svg className={`easedial-logo ${className}`} viewBox="0 0 278 76" role="img" aria-label="EaseDial">
      <defs>
        <linearGradient id="easedial-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#087083" />
          <stop offset="0.62" stopColor="#086577" />
          <stop offset="0.72" stopColor="#f2ad45" />
          <stop offset="1" stopColor="#ffbd5b" />
        </linearGradient>
      </defs>
      <path d="M7 43c0-18 12-31 29-31 14 0 23 9 22 21H18c1 11 8 17 19 17 8 0 14-3 19-9" fill="none" stroke="url(#easedial-mark)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M64 12v39M63 38c0-11 7-19 17-19 11 0 18 8 18 19s-7 19-18 19c-10 0-17-8-17-19Z" fill="none" stroke="url(#easedial-mark)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <text x="108" y="53" fill={wordColor} fontFamily="Inter, Arial, sans-serif" fontSize="40" fontWeight="560" letterSpacing="-2">Ease</text>
      <text x="192" y="53" fill="#f4ac46" fontFamily="Inter, Arial, sans-serif" fontSize="40" fontWeight="560" letterSpacing="-2">Dial</text>
    </svg>
  );
}
