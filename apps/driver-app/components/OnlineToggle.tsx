import React from 'react';
import { Lock, Power } from 'lucide-react';
import { useDriverApp } from '../state/DriverAppContext';

export const OnlineToggle: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { backendConfigured, driverProfile, onlineEligibility, togglingDuty, toggleOnlineStatus } =
    useDriverApp();

  const isOnline = Boolean(driverProfile?.is_online);
  const canGoOnline = backendConfigured && onlineEligibility.allowed;

  return (
    <button
      type="button"
      disabled={togglingDuty}
      onClick={() => void toggleOnlineStatus()}
      aria-pressed={isOnline}
      className={`group flex min-h-[52px] items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition-all active:scale-[0.99] ${
        isOnline
          ? 'border-[#111111] bg-[#111111] text-white dark:border-[#FFC928] dark:bg-[#FFC928] dark:text-[#111111]'
          : canGoOnline
          ? 'border-neutral-300 bg-white text-[#111111] hover:border-[#111111] dark:border-neutral-700 dark:bg-[#14161A] dark:text-white'
          : 'border-neutral-200 bg-neutral-100 text-neutral-700 dark:border-neutral-800 dark:bg-[#14161A] dark:text-neutral-300'
      } ${compact ? '' : 'w-full'}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            isOnline
              ? 'bg-[#FFC928] text-[#111111] dark:bg-[#111111] dark:text-[#FFC928]'
              : 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
          }`}
        >
          {canGoOnline || isOnline ? <Power className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display text-base font-bold whitespace-nowrap">
              {isOnline ? 'Online · Accepting Rides' : 'Offline Duty'}
            </span>
          </div>
          {!compact && (
            <p
              className={`truncate text-xs ${
                isOnline
                  ? 'text-neutral-300 dark:text-neutral-800'
                  : 'text-neutral-500 dark:text-neutral-400'
              }`}
            >
              {!backendConfigured
                ? 'Requires backend connection & admin approval'
                : !onlineEligibility.allowed
                ? 'Locked until profile, KYC, and vehicle are approved'
                : isOnline
                ? 'Tap to pause ride offers'
                : 'Tap to go online and receive ride requests'}
            </p>
          )}
        </div>
      </div>

      <span
        className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${
          isOnline
            ? 'bg-[#FFC928] text-[#111111] dark:bg-[#111111] dark:text-[#FFC928]'
            : 'bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200'
        }`}
      >
        {isOnline ? 'GO OFFLINE' : canGoOnline ? 'GO ONLINE' : 'LOCKED'}
      </span>
    </button>
  );
};
