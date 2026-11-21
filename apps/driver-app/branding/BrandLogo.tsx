import React from 'react';

export const BrandIcon: React.FC<{ className?: string }> = ({ className = 'w-9 h-9' }) => (
  <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://w3.org">
    <rect width="64" height="64" rx="16" fill="#1E1E1E" />
    <polygon points="25,15 32,15 29.5,30 22.5,30" fill="#F5C518" />
    <polygon points="22,34 29,34 26.5,49 19.5,49" fill="#F5C518" />
    <polygon points="35,15 42,15 39.5,30 32.5,30" fill="#FFFFFF" />
    <polygon points="32,34 39,34 36.5,49 29.5,49" fill="#FFFFFF" />
    <circle cx="43.5" cy="16.5" r="3.2" fill="#F5C518" />
  </svg>
);

export const BrandLogo: React.FC<{ size?: 'sm' | 'md' | 'lg'; showSubtitle?: boolean }> = ({
  size = 'md',
  showSubtitle = false,
}) => {
  const iconSize = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-14 h-14' : 'w-10 h-10';
  const textSize = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-lg';
  return (
    <div className="inline-flex items-center gap-2.5 select-none">
      <BrandIcon className={iconSize} />
      <div className="flex flex-col leading-none">
        <span className={`font-extrabold tracking-tight ${textSize}`}>
          <span className="text-current">SHINE </span>
          <span className="text-[#F5C518]">CAPTAIN</span>
        </span>
        {showSubtitle && (
          <span className="text-[11px] font-medium opacity-70 mt-1">Driver App • Partner</span>
        )}
      </div>
    </div>
  );
};
