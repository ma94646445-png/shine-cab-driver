import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  Car,
  Compass,
  IndianRupee,
  LayoutGrid,
  Moon,
  Search,
  ShieldAlert,
  Star,
  Sun,
  User,
  X,
} from 'lucide-react';
import { BrandIcon, BrandLogo } from '../branding/BrandLogo';
import type { ScreenId } from '../contracts/types';
import { useDriverApp } from '../state/DriverAppContext';
import { SCREEN_DIRECTORY, SCREEN_TITLES } from './screenDirectory';
import { FeedbackToast } from './UiPrimitives';

const BOTTOM_TAB_META: {
  id: ScreenId;
  key: 'navHome' | 'navEarnings' | 'navRides' | 'navRatings';
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'dashboard', key: 'navHome', icon: Compass },
  { id: 'earnings', key: 'navEarnings', icon: IndianRupee },
  { id: 'ride_history', key: 'navRides', icon: Car },
  { id: 'ratings', key: 'navRatings', icon: Star },
];

const GROUPS: Array<(typeof SCREEN_DIRECTORY)[number]['group']> = [
  'Auth & Onboarding',
  'KYC & Vehicle',
  'Duty & Dispatch',
  'Active Trip',
  'Earnings & History',
  'Account & Safety',
];

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    currentScreen,
    canGoBack,
    navigate,
    goBack,
    theme,
    toggleTheme,
    driverProfile,
    driverAvatarUrl,
    directoryOpen,
    setDirectoryOpen,
    notifications,
    t,
  } = useDriverApp();

  const [directorySearch, setDirectorySearch] = useState('');
  const unreadCount = notifications.filter((n) => !n.read).length;
  const filteredDirectory = useMemo(() => {
    const q = directorySearch.trim().toLowerCase();
    if (!q) return SCREEN_DIRECTORY;
    return SCREEN_DIRECTORY.filter(
      (s) => s.label.toLowerCase().includes(q) || s.group.toLowerCase().includes(q)
    );
  }, [directorySearch]);
  const isFullBleedAuth = currentScreen === 'splash' || currentScreen === 'onboarding';
  const showBack = canGoBack || currentScreen !== 'dashboard';
  const driverInitials = driverProfile?.full_name
    ? driverProfile.full_name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : null;

  if (isFullBleedAuth) {
    return (
      <div className="min-h-dvh w-full bg-[#090A0D] sm:flex sm:items-stretch sm:justify-center sm:py-3">
        <div className="flex min-h-dvh w-full flex-col bg-[#111111] text-white sm:mx-auto sm:min-h-[calc(100dvh-1.5rem)] sm:max-w-[430px] sm:overflow-hidden sm:rounded-[30px] sm:border sm:border-neutral-800 sm:shadow-2xl">
          {children}
          <FeedbackToast />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh w-full bg-[#E8ECF2] text-[#111111] dark:bg-[#050608] dark:text-[#F5F5F7] sm:flex sm:items-stretch sm:justify-center sm:py-3">
      {/* Mobile Phone App Viewport Container */}
      <div className="relative flex min-h-dvh w-full flex-col bg-[#F6F7F9] dark:bg-[#0A0B0D] sm:mx-auto sm:min-h-[calc(100dvh-1.5rem)] sm:max-w-[430px] sm:overflow-x-clip sm:rounded-[30px] sm:border sm:border-neutral-300/80 sm:shadow-2xl dark:sm:border-neutral-800">
        {/* Sticky Native Mobile App Header */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 bg-white/95 px-3 backdrop-blur-md dark:border-neutral-800 dark:bg-[#111317]/95 sm:rounded-t-[30px]">
          <div className="flex min-w-0 items-center gap-1.5">
            {showBack ? (
              <>
                <button
                  type="button"
                  onClick={goBack}
                  aria-label="Go back"
                  className="flex min-h-[44px] min-w-[40px] shrink-0 items-center justify-center rounded-2xl text-neutral-700 active:scale-95 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate('dashboard')}
                  className="flex min-w-0 items-center gap-2 text-left"
                >
                  <BrandIcon size={26} className="shrink-0" />
                  <div className="min-w-0 leading-tight">
                    <p className="truncate font-display text-[9px] font-extrabold tracking-widest text-amber-600 dark:text-[#FFC928]">
                      SHINE CAPTAIN
                    </p>
                    <p className="truncate font-display text-xs font-bold text-[#111111] dark:text-white">
                      {SCREEN_TITLES[currentScreen]}
                    </p>
                  </div>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => navigate('dashboard')}
                className="shrink-0 pl-1 text-left"
              >
                <BrandLogo size="sm" />
              </button>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => navigate('notifications')}
              aria-label="Notifications"
              className="relative flex min-h-[42px] min-w-[42px] items-center justify-center rounded-2xl text-neutral-700 active:scale-95 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="font-mono-num absolute top-1.5 right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#FFC928] px-1 text-[10px] font-bold text-[#111111]">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => navigate('emergency_sos')}
              aria-label="Emergency SOS"
              className="flex min-h-[42px] min-w-[42px] items-center justify-center rounded-2xl text-red-600 active:scale-95 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <ShieldAlert className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle color theme"
              className="flex min-h-[42px] min-w-[42px] items-center justify-center rounded-2xl text-neutral-700 active:scale-95 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => setDirectoryOpen(true)}
              aria-label="Open all screens directory"
              className="flex min-h-[42px] min-w-[42px] items-center justify-center rounded-2xl text-neutral-700 active:scale-95 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => navigate('profile')}
              aria-label="Driver Profile & Photo"
              className="flex min-h-[42px] min-w-[42px] items-center justify-center rounded-2xl active:scale-95"
            >
              {driverAvatarUrl ? (
                <img
                  src={driverAvatarUrl}
                  alt={driverProfile?.full_name || 'Driver photo'}
                  className={`h-8 w-8 rounded-full object-cover ring-2 ${
                    currentScreen === 'profile'
                      ? 'ring-[#111111] dark:ring-[#FFC928]'
                      : 'ring-[#FFC928]'
                  }`}
                />
              ) : (
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-extrabold ${
                    currentScreen === 'profile'
                      ? 'bg-[#FFC928] text-[#111111]'
                      : 'bg-[#111111] text-[#FFC928] dark:bg-neutral-800'
                  }`}
                >
                  {driverInitials || <User className="h-4 w-4" />}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Scrollable Mobile App Screen Canvas */}
        <main className="flex-1 px-3.5 pt-3.5 pb-6">
          {children}
          <footer className="mt-6 flex justify-center border-t border-neutral-200/70 pt-4 dark:border-neutral-800/80">
            <BrandLogo size="xs" showTagline className="opacity-85" />
          </footer>
        </main>

        {/* Sticky Native Mobile Bottom Tab Bar */}
        <nav
          aria-label="Driver Bottom Navigation"
          className="sticky bottom-0 z-30 grid h-[64px] shrink-0 grid-cols-4 border-t border-neutral-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md dark:border-neutral-800 dark:bg-[#111317]/95 sm:rounded-b-[30px]"
        >
          {BOTTOM_TAB_META.map((tab) => {
            const Icon = tab.icon;
            const active = currentScreen === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => navigate(tab.id)}
                className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-all active:scale-95 ${
                  active
                    ? 'text-[#111111] dark:text-[#FFC928]'
                    : 'text-neutral-500 dark:text-neutral-400'
                }`}
              >
                <span
                  className={`flex h-7 w-12 items-center justify-center rounded-2xl transition-colors ${
                    active ? 'bg-[#FFC928] text-[#111111]' : ''
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="whitespace-nowrap">{t[tab.key]}</span>
              </button>
            );
          })}
        </nav>

        {/* Mobile Bottom Sheet: Full 28-Screen Directory */}
        {directoryOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-xs">
            <div className="max-h-[85vh] w-full max-w-[430px] overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-[#14161A]">
              <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-neutral-300 dark:bg-neutral-700" />
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-bold">Driver Screens Directory</h2>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    28 mobile screens · SHINE CAPTAIN
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDirectoryOpen(false)}
                  aria-label="Close directory"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="relative mb-4">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  value={directorySearch}
                  onChange={(e) => setDirectorySearch(e.target.value)}
                  placeholder="Search any of 28 driver screens…"
                  aria-label="Search driver screens"
                  className="min-h-[44px] w-full rounded-2xl border border-neutral-200 bg-neutral-50 pr-3.5 pl-10 text-xs font-medium text-[#111111] outline-none placeholder:text-neutral-400 focus:border-[#FFC928] dark:border-neutral-800 dark:bg-[#1A1D23] dark:text-white"
                />
              </div>

              <div className="space-y-5 pb-6">
                {GROUPS.map((group) => {
                  const items = filteredDirectory.filter((s) => s.group === group);
                  if (items.length === 0) return null;
                  return (
                    <div key={group} className="space-y-2">
                      <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                        {group}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {items.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setDirectorySearch('');
                              navigate(item.id);
                            }}
                            className={`min-h-[44px] rounded-2xl border px-3 py-2 text-left text-xs font-medium transition-colors ${
                              currentScreen === item.id
                                ? 'border-[#FFC928] bg-[#FFC928] font-semibold text-[#111111]'
                                : 'border-neutral-200 bg-neutral-50 text-neutral-800 dark:border-neutral-800 dark:bg-[#1A1D23] dark:text-neutral-200'
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {filteredDirectory.length === 0 && (
                  <p className="py-6 text-center text-xs text-neutral-500">
                    No matching screen found for &ldquo;{directorySearch}&rdquo;.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <FeedbackToast />
      </div>
    </div>
  );
};
