import React from 'react';

export interface BrandLogoProps {
  variant?: 'light' | 'dark' | 'auto';
  iconOnly?: boolean;
  showTagline?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP = {
  xs: { icon: 26, title: 'text-xs', badge: 'text-[9px] px-1 py-0.5', sub: 'text-[9px]' },
  sm: { icon: 32, title: 'text-base', badge: 'text-[10px] px-1.5 py-0.5', sub: 'text-[10px]' },
  md: { icon: 42, title: 'text-lg', badge: 'text-[10px] px-1.5 py-0.5', sub: 'text-[11px]' },
  lg: { icon: 68, title: 'text-2xl', badge: 'text-[11px] px-2 py-0.5', sub: 'text-xs' },
};

export const BrandIcon: React.FC<{ size?: number; inverted?: boolean; className?: string }> = ({
  size = 40,
  inverted = false,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 128 128"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="SHINE CAPTAIN Logo Emblem"
    className={className}
  >
    <rect width="128" height="128" rx="28" fill={inverted ? '#FFC928' : '#111111'} />
    <rect
      x="5"
      y="5"
      width="118"
      height="118"
      rx="23"
      stroke={inverted ? '#111111' : '#FFC928'}
      strokeOpacity={inverted ? '0.24' : '0.36'}
      strokeWidth="2.5"
    />
    {/* Shine Rays */}
    <path
      d="M64 15V23M38 24L43 30M90 24L85 30"
      stroke={inverted ? '#111111' : '#FFC928'}
      strokeWidth="5"
      strokeLinecap="round"
    />
    {/* Captain Winged Chevron Crown */}
    <path
      d="M36 47L64 29L92 47"
      stroke={inverted ? '#111111' : '#FFFFFF'}
      strokeWidth="7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Mobility Wheel Ring */}
    <circle cx="64" cy="74" r="31" stroke={inverted ? '#111111' : '#FFC928'} strokeWidth="9.5" />
    <path
      d="M36 70H92"
      stroke={inverted ? '#111111' : '#FFC928'}
      strokeWidth="8"
      strokeLinecap="round"
    />
    <path
      d="M64 73V103"
      stroke={inverted ? '#111111' : '#FFC928'}
      strokeWidth="8"
      strokeLinecap="round"
    />
    {/* Center Captain Hub */}
    <circle
      cx="64"
      cy="70"
      r="9.5"
      fill={inverted ? '#FFC928' : '#111111'}
      stroke={inverted ? '#111111' : '#FFFFFF'}
      strokeWidth="4"
    />
  </svg>
);

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'auto',
  iconOnly = false,
  showTagline = false,
  size = 'md',
  className = '',
}) => {
  const cfg = SIZE_MAP[size];
  const isDark = variant === 'dark';
  const textClass =
    variant === 'auto'
      ? 'text-[#111111] dark:text-white'
      : isDark
      ? 'text-white'
      : 'text-[#111111]';
  const mutedClass =
    variant === 'auto'
      ? 'text-neutral-500 dark:text-neutral-400'
      : isDark
      ? 'text-neutral-400'
      : 'text-neutral-500';

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <BrandIcon size={cfg.icon} inverted={isDark} className="shrink-0" />
      {!iconOnly && (
        <div className="flex flex-col leading-none">
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className={`font-display font-extrabold tracking-tight ${cfg.title} ${textClass}`}>
              SHINE
            </span>
            <span
              className={`rounded bg-[#FFC928] font-display font-extrabold tracking-widest text-[#111111] ${cfg.badge}`}
            >
              CAPTAIN
            </span>
          </div>
          {showTagline && (
            <span className={`mt-1 font-medium tracking-[0.18em] ${cfg.sub} ${mutedClass}`}>
              DRIVE • EARN • GROW
            </span>
          )}
        </div>
      )}
    </div>
  );
};
