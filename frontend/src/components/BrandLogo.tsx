import easedialLogo from '../assets/easedial-logo.png';

interface BrandLogoProps {
  inverse?: boolean;
  className?: string;
}

/** The exact EaseDial artwork supplied by the customer. */
export function BrandLogo({ inverse = false, className = '' }: BrandLogoProps) {
  return (
    <img
      className={`easedial-logo${inverse ? ' easedial-logo-on-dark' : ''} ${className}`.trim()}
      src={easedialLogo}
      alt="EaseDial"
    />
  );
}
