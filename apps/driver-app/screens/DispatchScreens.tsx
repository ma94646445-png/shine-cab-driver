import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  BadgeCheck,
  Bike,
  Car,
  CheckCircle2,
  Clock,
  Compass,
  ExternalLink,
  Globe,
  KeyRound,
  Lock,
  MapPin,
  Navigation,
  Phone,
  Radio,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  User,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import { OnlineToggle } from '../components/OnlineToggle';
import { PrimaryButton, ScreenHeader, StateNotice } from '../components/UiPrimitives';
import type { VehicleCategory } from '../contracts/types';
import { INDIAN_LANGUAGES, type IndianLanguageCode } from '../i18n/translations';
import { mapsProviderAdapter } from '../services/adapters/externalAdapters';
import { driverBackendService } from '../services/driverBackendService';
import { useDriverApp } from '../state/DriverAppContext';

const LIFECYCLE_STEPS = [
  { key: 'accepted', label: 'Accepted' },
  { key: 'arrived', label: 'Arrived' },
  { key: 'otp', label: 'OTP Verified' },
  { key: 'in_progress', label: 'In Trip' },
  { key: 'completed', label: 'Settled' },
] as const;

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return [hrs, mins, secs].map((n) => String(n).padStart(2, '0')).join(':');
}

export const DashboardScreen: React.FC = () => {
  const {
    backendConfigured,
    loading,
    driverProfile,
    driverAvatarUrl,
    vehicle,
    onlineEligibility,
    onlineSince,
    activeRide,
    setActiveRide,
    lastCompletedRide,
    setLastCompletedRide,
    incomingOffer,
    setIncomingOffer,
    earningsPeriod,
    setEarningsPeriod,
    earnings,
    wallet,
    rideHistory,
    notifications,
    liveLocation,
    locationError,
    watchingGps,
    toggleWatchGps,
    requestGpsFix,
    dispatchPreferences,
    updateDispatchPreferences,
    appSettings,
    updateAppSettings,
    onboardingDraft,
    updateDraft,
    setFeedback,
    refreshDriverWorkspace,
    togglingDuty,
    toggleOnlineStatus,
    navigate,
    t,
  } = useDriverApp();

  const [inlineOtp, setInlineOtp] = useState('');
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [shiftElapsed, setShiftElapsed] = useState('00:00:00');
  const [offerSecondsLeft, setOfferSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!onlineSince) {
      setShiftElapsed('00:00:00');
      return;
    }
    const startMs = new Date(onlineSince).getTime();
    if (Number.isNaN(startMs)) {
      setShiftElapsed('00:00:00');
      return;
    }
    const update = () => {
      setShiftElapsed(formatDuration(Date.now() - startMs));
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [onlineSince]);

  useEffect(() => {
    if (!incomingOffer?.offer_expires_at) {
      setOfferSecondsLeft(null);
      return;
    }
    const expiryMs = new Date(incomingOffer.offer_expires_at).getTime();
    if (Number.isNaN(expiryMs)) {
      setOfferSecondsLeft(null);
      return;
    }
    const update = () => {
      const left = Math.max(0, Math.ceil((expiryMs - Date.now()) / 1000));
      setOfferSecondsLeft(left);
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [incomingOffer?.offer_expires_at, incomingOffer?.ride_id]);

  const unreadNotifications = notifications.filter((n) => !n.read).length;
  const activeCategory: VehicleCategory = vehicle?.category ?? onboardingDraft.vehicleCategory;
  const isOnline = Boolean(driverProfile?.is_online);
  const canGoOnline = backendConfigured && onlineEligibility.allowed;

  const recentTrips = rideHistory.slice(0, 3);
  const recentAlerts = notifications.slice(0, 3);

  const osmEmbedUrl = liveLocation
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${(liveLocation.lng - 0.014).toFixed(
        5
      )}%2C${(liveLocation.lat - 0.014).toFixed(5)}%2C${(liveLocation.lng + 0.014).toFixed(
        5
      )}%2C${(liveLocation.lat + 0.014).toFixed(
        5
      )}&layer=mapnik&marker=${liveLocation.lat.toFixed(5)}%2C${liveLocation.lng.toFixed(5)}`
    : null;

  const handleAcceptOffer = async () => {
    if (!incomingOffer || !driverProfile) {
      setFeedback({
        type: 'error',
        title: 'Backend Ride Offer Required',
        message:
          'Atomic ride acceptance requires a live backend ride offer and an approved driver session.',
        missingEnvVars: backendConfigured ? undefined : ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
      });
      return;
    }
    setActionBusy('accept');
    const res = await driverBackendService.rides.acceptRide(
      incomingOffer.ride_id,
      driverProfile.driver_id
    );
    setActionBusy(null);
    if (!res.ok) {
      setFeedback({
        type: 'error',
        title: res.error?.code === 'RIDE_ALREADY_TAKEN' ? 'Ride Already Claimed' : 'Accept Failed',
        message: res.error?.message || 'Unable to accept ride.',
      });
      return;
    }
    if (res.data?.ride) setActiveRide(res.data.ride);
    setIncomingOffer(null);
    setFeedback({
      type: 'success',
      title: 'Ride Assigned Atomically',
      message: 'Proceed to customer pickup and verify their 4-digit ride start OTP.',
    });
  };

  const handleRejectOffer = async () => {
    if (!incomingOffer || !driverProfile) return;
    setActionBusy('reject');
    await driverBackendService.rides.rejectRide(incomingOffer.ride_id, driverProfile.driver_id);
    setActionBusy(null);
    setIncomingOffer(null);
  };

  const handleMarkArrived = async () => {
    if (!activeRide || !driverProfile) return;
    setActionBusy('arrive');
    const res = await driverBackendService.rides.markArrived(
      activeRide.ride_id,
      driverProfile.driver_id
    );
    setActionBusy(null);
    if (!res.ok) {
      setFeedback({
        type: 'error',
        title: 'Arrival Update Failed',
        message: res.error?.message || 'Unable to update arrival state.',
      });
      return;
    }
    if (res.data) setActiveRide(res.data);
  };

  const handleInlineVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inlineOtp.length !== 4) {
      setFeedback({
        type: 'error',
        title: '4-Digit Ride PIN Required',
        message: 'Enter the 4-digit pickup OTP provided by the rider.',
      });
      return;
    }
    if (!backendConfigured || !activeRide || !driverProfile) {
      setFeedback({
        type: 'error',
        title: 'No Assigned Backend Ride',
        message:
          'Pickup OTP validation executes server-side via verify-pickup-otp against an assigned ride.',
        missingEnvVars: backendConfigured ? undefined : ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
      });
      return;
    }
    setActionBusy('otp');
    const res = await driverBackendService.rides.verifyPickupOtp({
      ride_id: activeRide.ride_id,
      driver_id: driverProfile.driver_id,
      otp_code: inlineOtp,
    });
    setActionBusy(null);
    if (!res.ok) {
      setFeedback({
        type: 'error',
        title: 'Invalid Pickup OTP',
        message: res.error?.message || 'OTP verification failed.',
      });
      return;
    }
    setInlineOtp('');
    if (res.data) setActiveRide(res.data);
    setFeedback({
      type: 'success',
      title: 'OTP Verified · Trip Started',
      message: 'Live trip is now in progress toward the dropoff destination.',
    });
  };

  const handleCompleteRide = async () => {
    if (!activeRide || !driverProfile) return;
    setActionBusy('complete');
    const res = await driverBackendService.rides.completeRide({
      ride_id: activeRide.ride_id,
      driver_id: driverProfile.driver_id,
      actual_distance_km: activeRide.estimated_distance_km,
      actual_duration_min: activeRide.estimated_duration_min,
    });
    setActionBusy(null);
    if (!res.ok) {
      setFeedback({
        type: 'error',
        title: 'Completion Blocked',
        message: res.error?.message || 'Unable to finalize ride.',
      });
      return;
    }
    if (res.data) setLastCompletedRide(res.data);
    setActiveRide(null);
    await refreshDriverWorkspace();
    setFeedback({
      type: 'success',
      title: 'Trip Completed & Ledger Updated',
      message: 'Net driver earnings and commission records are synced.',
    });
  };

  return (
    <div className="space-y-4">
      {/* 1. SIGNATURE OBSIDIAN & SHINE YELLOW PARTNER COCKPIT */}
      <section className="relative overflow-hidden rounded-3xl bg-[#111111] p-4 text-white shadow-sm dark:border dark:border-neutral-800 dark:bg-[#14161A]">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3.5">
            <button
              type="button"
              onClick={() => navigate('profile')}
              aria-label="Open Driver Profile Photo"
              className="shrink-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-[#FFC928]"
            >
              {driverAvatarUrl ? (
                <img
                  src={driverAvatarUrl}
                  alt={driverProfile?.full_name || 'Driver Profile'}
                  className="h-14 w-14 rounded-2xl object-cover ring-2 ring-[#FFC928]"
                />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-700 bg-[#1B1E24] text-[#FFC928]">
                  <User className="h-6 w-6" />
                </span>
              )}
            </button>

            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold tracking-wider text-[#FFC928]">
                  SHINE CAPTAIN · {activeCategory.toUpperCase()} PARTNER
                </p>
                {driverProfile?.partner_rider_id && (
                  <span className="font-mono-num inline-flex items-center gap-1 rounded-md bg-[#FFC928]/15 px-2 py-0.5 text-[11px] font-bold text-[#FFC928]">
                    <BadgeCheck className="h-3 w-3" />
                    {driverProfile.partner_rider_id}
                  </span>
                )}
              </div>
              <h1 className="font-display truncate text-xl font-extrabold tracking-tight text-white">
                {driverProfile ? `Welcome, ${driverProfile.full_name}` : t.partnerCockpit}
              </h1>
              <p className="text-xs text-neutral-400">
                {driverProfile
                  ? `${driverProfile.city} · ${
                      vehicle
                        ? `${vehicle.make} ${vehicle.model} · ${vehicle.registration_number}`
                        : 'Vehicle registration pending'
                    }`
                  : `${onboardingDraft.city ? `${onboardingDraft.city} · ` : ''}${
                      backendConfigured
                        ? 'Live dispatch & trip tracker ready'
                        : 'Live language & hardware GPS dispatch ready'
                    }`}
              </p>
            </div>
          </div>

          {/* Primary Cockpit Action Cluster */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={togglingDuty}
              onClick={() => void toggleOnlineStatus()}
              className={`inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-extrabold transition-transform active:scale-[0.98] disabled:opacity-60 ${
                isOnline
                  ? 'bg-[#FFC928] text-[#111111]'
                  : canGoOnline
                  ? 'bg-white text-[#111111] hover:bg-[#FFC928]'
                  : 'border border-neutral-700 bg-[#1B1E24] text-neutral-200 hover:border-[#FFC928]'
              }`}
            >
              {canGoOnline || isOnline ? (
                <Radio className="h-4 w-4" />
              ) : (
                <Lock className="h-4 w-4 text-[#FFC928]" />
              )}
              <span>{isOnline ? t.goOffline : canGoOnline ? t.goOnline : t.dutyLocked}</span>
            </button>

            <button
              type="button"
              onClick={() => void refreshDriverWorkspace()}
              disabled={loading}
              aria-label="Refresh workspace"
              className="flex min-h-[48px] min-w-[48px] shrink-0 items-center justify-center rounded-2xl border border-neutral-700 bg-[#1B1E24] text-white transition-colors hover:border-neutral-500"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => navigate('emergency_sos')}
              className="inline-flex min-h-[48px] shrink-0 items-center gap-1.5 rounded-2xl bg-red-600 px-3.5 text-xs font-bold text-white transition-colors hover:bg-red-700"
            >
              <ShieldAlert className="h-4 w-4" />
              SOS
            </button>
          </div>
        </div>

        {/* Shift Timer & Quick Language Selector */}
        <div className="mt-4 space-y-3 border-t border-neutral-800 pt-3.5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-neutral-400">Shift Elapsed</p>
            <p className="font-mono-num text-sm font-bold text-white">{shiftElapsed}</p>
          </div>

          <div className="flex items-center justify-between gap-2">
            <label className="flex min-h-[40px] flex-1 items-center gap-1.5 rounded-xl border border-neutral-700 bg-[#1B1E24] px-2.5 text-xs">
              <Globe className="h-3.5 w-3.5 shrink-0 text-[#FFC928]" />
              <select
                aria-label="Select Indian App Language"
                value={appSettings.appLanguage}
                onChange={(e) =>
                  updateAppSettings({ appLanguage: e.target.value as IndianLanguageCode })
                }
                className="w-full truncate bg-transparent text-xs font-semibold text-white outline-none"
              >
                {INDIAN_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code} className="bg-[#111111] text-white">
                    {lang.nativeLabel} ({lang.englishName})
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => navigate('onboarding')}
              className="min-h-[40px] shrink-0 rounded-xl border border-neutral-700 bg-[#1B1E24] px-3 text-xs font-semibold text-neutral-300 hover:border-[#FFC928] hover:text-white"
            >
              Tour &amp; City
            </button>
          </div>
        </div>
      </section>

      {/* 2. UNIFIED FINANCIAL, PAYMENT SPLIT & PERFORMANCE STRIP */}
      <section className="rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-[#14161A]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <span className="font-display text-sm font-bold">Performance, Settlement &amp; Wallet</span>
          <div className="flex items-center gap-1 rounded-lg bg-neutral-100 p-0.5 dark:bg-neutral-800">
            {(['daily', 'weekly', 'monthly'] as const).map((period) => (
              <button
                key={period}
                type="button"
                onClick={() => setEarningsPeriod(period)}
                className={`min-h-[32px] rounded-md px-2.5 text-xs font-semibold capitalize transition-colors ${
                  earningsPeriod === period
                    ? 'bg-[#111111] text-white dark:bg-[#FFC928] dark:text-[#111111]'
                    : 'text-neutral-600 hover:text-[#111111] dark:text-neutral-300'
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x divide-y divide-neutral-200 dark:divide-neutral-800">
          <button
            type="button"
            onClick={() => navigate('earnings')}
            className="p-4 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
          >
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Net Earnings</p>
            <p className="font-mono-num mt-1 text-2xl font-extrabold text-emerald-700 dark:text-emerald-400">
              {earnings ? `₹${earnings.net_earnings_inr.toFixed(0)}` : '—'}
            </p>
            <p className="font-mono-num mt-0.5 text-[11px] text-neutral-500">
              {earnings
                ? `Cash ₹${earnings.cash_collected_inr.toFixed(0)} · UPI ₹${earnings.online_payments_inr.toFixed(0)}`
                : 'Awaiting trips'}
            </p>
          </button>
          <button
            type="button"
            onClick={() => navigate('wallet')}
            className="p-4 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
          >
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Wallet Balance</p>
            <p className="font-mono-num mt-1 text-2xl font-extrabold">
              {wallet ? `₹${wallet.available_balance_inr.toFixed(0)}` : '—'}
            </p>
            <p className="font-mono-num mt-0.5 text-[11px] text-neutral-500">
              Dues: {wallet ? `₹${wallet.cash_commission_due_inr.toFixed(0)}` : '—'} · Payout →
            </p>
          </button>
          <button
            type="button"
            onClick={() => navigate('ride_history')}
            className="p-4 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
          >
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Completed Trips</p>
            <p className="font-mono-num mt-1 text-2xl font-extrabold">
              {earnings ? earnings.completed_rides : driverProfile ? driverProfile.total_rides : '—'}
            </p>
            <p className="font-mono-num mt-0.5 text-[11px] text-neutral-500">
              {earnings ? `${earnings.online_hours.toFixed(1)} hrs online` : '0 verified'}
            </p>
          </button>
          <button
            type="button"
            onClick={() => navigate('ratings')}
            className="p-4 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
          >
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Partner Rating</p>
            <p className="font-mono-num mt-1 text-2xl font-extrabold text-[#111111] dark:text-[#FFC928]">
              {driverProfile?.rating_average ? `${driverProfile.rating_average.toFixed(2)} ★` : '—'}
            </p>
            <p className="mt-0.5 text-[11px] text-neutral-500">View Customer Reviews →</p>
          </button>
        </div>
      </section>

      {/* 3. MOBILE STACKED WORKSPACE: LIVE GPS MAP + RIDE ACCEPT / OTP TERMINAL */}
      <div className="space-y-4">
        {/* Hardware GPS & Embedded Live Map Radar Surface */}
        <section className="flex flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#14161A]">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-bold">Live GPS Map &amp; Route Radar</h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Real device geolocation &amp; turn-by-turn map
                </p>
              </div>
              <Compass className="h-5 w-5 text-[#FFC928]" />
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200 bg-[#F7F8FA] dark:border-neutral-800 dark:bg-[#0D0F13]">
              {liveLocation && osmEmbedUrl ? (
                <div>
                  <iframe
                    title="Driver Live GPS Map"
                    src={osmEmbedUrl}
                    className="h-44 w-full border-0"
                  />
                  <div className="flex items-center justify-between gap-2 border-t border-neutral-200 p-3 dark:border-neutral-800">
                    <div>
                      <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                        Authentic Hardware GPS Fix
                      </p>
                      <p className="font-mono-num text-xs font-bold">
                        {liveLocation.lat.toFixed(5)}, {liveLocation.lng.toFixed(5)} · ±
                        {liveLocation.accuracy_m ?? '—'}m
                      </p>
                    </div>
                    <a
                      href={mapsProviderAdapter.openExternalTurnByTurn(
                        liveLocation.lat,
                        liveLocation.lng,
                        driverProfile?.city || onboardingDraft.city || 'My Location'
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-neutral-300 px-2.5 text-[11px] font-semibold hover:border-[#FFC928] dark:border-neutral-700"
                    >
                      Maps
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              ) : locationError ? (
                <div className="p-4">
                  <p className="text-xs font-medium text-red-600 dark:text-red-400">
                    {locationError}
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 p-4">
                  <p className="text-xs font-semibold">No GPS Fix Acquired Yet</p>
                  <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                    Tap Sync GPS to center the live map on your real device coordinates. Simulated
                    map pins are disabled.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <PrimaryButton variant="dark" className="flex-1" onClick={() => void requestGpsFix()}>
                <Navigation className="h-4 w-4" />
                Sync GPS
              </PrimaryButton>
              <PrimaryButton
                variant={watchingGps ? 'brand' : 'outline'}
                className="flex-1"
                onClick={toggleWatchGps}
              >
                {watchingGps ? 'Stop Watch' : 'Watch Live'}
              </PrimaryButton>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
              {(['bike', 'auto', 'cab'] as const).map((cat) => {
                const selected = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    disabled={Boolean(vehicle)}
                    onClick={() => updateDraft({ vehicleCategory: cat })}
                    className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border text-xs font-bold uppercase transition-colors ${
                      selected
                        ? 'border-[#111111] bg-[#FFC928] text-[#111111]'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-800 dark:bg-[#1A1D23] dark:text-neutral-300'
                    }`}
                  >
                    {cat === 'bike' ? (
                      <Bike className="h-3.5 w-3.5" />
                    ) : cat === 'auto' ? (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    ) : (
                      <Car className="h-3.5 w-3.5" />
                    )}
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Tactile Ride Accept & 4-Digit Pickup OTP Terminal */}
        <section className="flex flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#14161A]">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-3 dark:border-neutral-800">
              <div>
                <h2 className="font-display text-base font-bold">
                  Ride Accept &amp; Pickup OTP Terminal
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Atomic dispatch lock · 4-digit rider start PIN
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-500">
                {LIFECYCLE_STEPS.map((step, idx) => {
                  const reached =
                    (step.key === 'accepted' && activeRide) ||
                    (step.key === 'arrived' &&
                      activeRide &&
                      ['arrived', 'in_progress', 'completed'].includes(activeRide.status)) ||
                    (step.key === 'otp' && activeRide?.pickup_otp_verified) ||
                    (step.key === 'in_progress' && activeRide?.status === 'in_progress') ||
                    (step.key === 'completed' && Boolean(lastCompletedRide && !activeRide));
                  return (
                    <React.Fragment key={step.key}>
                      {idx > 0 && <span aria-hidden="true">·</span>}
                      <span
                        className={
                          reached
                            ? 'font-bold text-[#111111] dark:text-[#FFC928]'
                            : 'text-neutral-400'
                        }
                      >
                        {step.label}
                      </span>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {incomingOffer ? (
              <div className="mt-4 space-y-4 rounded-2xl border-2 border-[#FFC928] bg-[#FFC928]/5 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="font-mono-num block text-xs font-semibold text-neutral-500">
                      {incomingOffer.ride_id} · {incomingOffer.estimated_distance_km} km ·{' '}
                      {incomingOffer.estimated_duration_min} min ·{' '}
                      {incomingOffer.payment_mode.toUpperCase()}
                    </span>
                    {offerSecondsLeft !== null && (
                      <span className="font-mono-num inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-[#FFC928]">
                        <Clock className="h-3.5 w-3.5" />
                        Expires in {offerSecondsLeft}s
                      </span>
                    )}
                  </div>
                  <span className="font-mono-num text-2xl font-extrabold">
                    ₹{incomingOffer.estimated_fare_inr.toFixed(0)}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="text-xs text-neutral-500">Pickup: </span>
                    <span className="font-semibold">{incomingOffer.pickup_address}</span>
                  </p>
                  <p>
                    <span className="text-xs text-neutral-500">Dropoff: </span>
                    <span className="font-semibold">{incomingOffer.dropoff_address}</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  <PrimaryButton
                    variant="brand"
                    className="flex-1"
                    disabled={actionBusy === 'accept'}
                    onClick={() => void handleAcceptOffer()}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {actionBusy === 'accept' ? 'Accepting…' : 'Accept Ride Atomically'}
                  </PrimaryButton>
                  <PrimaryButton
                    variant="outline"
                    disabled={actionBusy === 'reject'}
                    onClick={() => void handleRejectOffer()}
                  >
                    <XCircle className="h-4 w-4" />
                    Decline
                  </PrimaryButton>
                </div>
              </div>
            ) : activeRide ? (
              <div className="mt-4 space-y-4">
                <div className="flex items-start justify-between gap-3 rounded-2xl bg-[#F7F8FA] p-4 dark:bg-[#1A1D23]">
                  <div className="space-y-1">
                    <p className="font-mono-num text-xs text-neutral-500">
                      {activeRide.ride_id} · {activeRide.status.toUpperCase()} ·{' '}
                      {activeRide.estimated_distance_km} km · {activeRide.estimated_duration_min} min ·{' '}
                      {activeRide.payment_mode.toUpperCase()}
                    </p>
                    <p className="text-sm font-bold">
                      {activeRide.pickup_otp_verified
                        ? `Dropoff: ${activeRide.dropoff_address}`
                        : `Pickup: ${activeRide.pickup_address}`}
                    </p>
                    {activeRide.customer && (
                      <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-neutral-600 dark:text-neutral-300">
                        <span className="font-semibold">
                          Rider: {activeRide.customer.display_name}
                        </span>
                        {activeRide.customer.masked_phone && (
                          <a
                            href={`tel:${activeRide.customer.masked_phone}`}
                            className="inline-flex items-center gap-1 font-semibold text-[#111111] underline dark:text-[#FFC928]"
                          >
                            <Phone className="h-3 w-3" />
                            Call Rider
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => navigate('customer_details')}
                          className="inline-flex items-center gap-1 font-semibold underline"
                        >
                          <UserCheck className="h-3 w-3" />
                          Rider Info
                        </button>
                      </div>
                    )}
                  </div>
                  <span className="font-mono-num text-xl font-extrabold">
                    ₹{activeRide.estimated_fare_inr.toFixed(0)}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <a
                    href={mapsProviderAdapter.openExternalTurnByTurn(
                      activeRide.pickup_otp_verified ? activeRide.dropoff_lat : activeRide.pickup_lat,
                      activeRide.pickup_otp_verified ? activeRide.dropoff_lng : activeRide.pickup_lng,
                      activeRide.pickup_otp_verified
                        ? activeRide.dropoff_address
                        : activeRide.pickup_address
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-300 px-4 text-xs font-semibold dark:border-neutral-700"
                  >
                    Turn-by-Turn Maps
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  {!activeRide.pickup_otp_verified && activeRide.status !== 'arrived' && (
                    <PrimaryButton
                      variant="dark"
                      disabled={actionBusy === 'arrive'}
                      onClick={() => void handleMarkArrived()}
                    >
                      Mark Arrived
                    </PrimaryButton>
                  )}
                  {activeRide.status === 'in_progress' && activeRide.pickup_otp_verified && (
                    <PrimaryButton
                      variant="brand"
                      disabled={actionBusy === 'complete'}
                      onClick={() => void handleCompleteRide()}
                    >
                      Complete &amp; Settle Fare
                    </PrimaryButton>
                  )}
                  <PrimaryButton variant="danger" onClick={() => navigate('emergency_sos')}>
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Trip SOS
                  </PrimaryButton>
                </div>
              </div>
            ) : lastCompletedRide ? (
              <div className="mt-4 flex flex-col justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      Last Trip Completed · {lastCompletedRide.payment_mode.toUpperCase()}
                    </p>
                    <p className="mt-0.5 text-sm font-bold">
                      {lastCompletedRide.pickup_address} → {lastCompletedRide.dropoff_address}
                    </p>
                    <p className="font-mono-num mt-0.5 text-xs text-neutral-600 dark:text-neutral-300">
                      Fare ₹{(lastCompletedRide.final_fare_inr ?? lastCompletedRide.estimated_fare_inr).toFixed(0)} ·
                      Net ₹{(lastCompletedRide.driver_net_inr ?? lastCompletedRide.estimated_fare_inr).toFixed(0)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLastCompletedRide(null)}
                    aria-label="Dismiss completed trip summary"
                    className="flex min-h-[36px] min-w-[36px] shrink-0 items-center justify-center rounded-xl text-neutral-500 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <PrimaryButton variant="outline" onClick={() => navigate('ride_completion')}>
                  Fare Summary
                </PrimaryButton>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-[#F7F8FA] p-4 dark:border-neutral-700 dark:bg-[#0D0F13]">
                <p className="text-sm font-semibold">
                  {driverProfile?.is_online
                    ? `Listening for ${activeCategory.toUpperCase()} rides`
                    : 'No Active Ride Assigned'}
                </p>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  {backendConfigured
                    ? 'Live ride offers arrive via Supabase Realtime when your account is approved and Online.'
                    : 'Connect Supabase (VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY) to receive live customer rides and verify rider OTPs.'}
                </p>
              </div>
            )}
          </div>

          {/* Inline 4-Digit Pickup OTP Input Bar */}
          <form
            onSubmit={handleInlineVerifyOtp}
            className="mt-4 flex flex-col gap-2.5 border-t border-neutral-200 pt-4 dark:border-neutral-800"
          >
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-neutral-300 bg-[#F7F8FA] px-3 dark:border-neutral-700 dark:bg-[#1A1D23]">
              <KeyRound className="h-4 w-4 shrink-0 text-[#FFC928]" />
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                disabled={Boolean(activeRide?.pickup_otp_verified)}
                placeholder="4-digit Rider Pickup OTP"
                value={inlineOtp}
                onChange={(e) => setInlineOtp(e.target.value.replace(/\D/g, ''))}
                className="font-mono-num min-h-[46px] w-full bg-transparent text-sm font-bold tracking-[0.25em] outline-none"
              />
            </div>
            <PrimaryButton
              type="submit"
              variant="brand"
              className="w-full"
              disabled={actionBusy === 'otp' || Boolean(activeRide?.pickup_otp_verified)}
            >
              {activeRide?.pickup_otp_verified ? 'OTP Verified' : 'Verify OTP & Start'}
            </PrimaryButton>
          </form>
        </section>
      </div>

      {/* 4. RECENT TRIPS + VEHICLE DOCS & ALERT INBOX */}
      <div className="space-y-4">
        {/* Recent Trips Preview */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#14161A]">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-3 dark:border-neutral-800">
            <div>
              <h2 className="font-display text-base font-bold">Recent Rides Ledger</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Latest completed &amp; settled customer trips
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('ride_history')}
              className="inline-flex min-h-[36px] items-center gap-1 text-xs font-bold text-[#111111] hover:underline dark:text-[#FFC928]"
            >
              View All
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {recentTrips.length === 0 ? (
            <div className="py-6 text-center">
              <Car className="mx-auto h-6 w-6 text-neutral-400" />
              <p className="mt-2 text-xs font-semibold">No Completed Trips Yet</p>
              <p className="mt-0.5 text-[11px] text-neutral-500">
                Settled customer rides from the shared database will list here automatically.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {recentTrips.map((trip) => (
                <div key={trip.ride_id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold">
                      {trip.pickup_address} → {trip.dropoff_address}
                    </p>
                    <p className="font-mono-num mt-0.5 text-[11px] text-neutral-500">
                      {Number.isNaN(Date.parse(trip.created_at))
                        ? 'Recent'
                        : new Date(trip.created_at).toLocaleDateString()}{' '}
                      · {trip.payment_mode.toUpperCase()}
                    </p>
                  </div>
                  <span className="font-mono-num shrink-0 text-sm font-extrabold text-emerald-700 dark:text-emerald-400">
                    ₹{(trip.driver_net_inr ?? trip.final_fare_inr ?? trip.estimated_fare_inr).toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Live Alerts & Notifications Preview */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#14161A]">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-3 dark:border-neutral-800">
            <div>
              <h2 className="font-display text-base font-bold">Live Alerts &amp; Notices</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Dispatch alerts, trip notices &amp; payout updates
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('notifications')}
              className="inline-flex min-h-[36px] items-center gap-1 text-xs font-bold text-[#111111] hover:underline dark:text-[#FFC928]"
            >
              Inbox ({unreadNotifications})
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-2 divide-y divide-neutral-200 dark:divide-neutral-800">
            {recentAlerts.length === 0 ? (
              <p className="py-3 text-xs text-neutral-500">
                No system notifications yet. Ride dispatch and payout notices appear here.
              </p>
            ) : (
              recentAlerts.map((n) => (
                <button
                  key={n.notification_id}
                  type="button"
                  onClick={() => navigate('notifications')}
                  className="flex w-full items-start justify-between gap-2 py-2.5 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold">{n.title}</p>
                    <p className="truncate text-[11px] text-neutral-500">{n.body}</p>
                  </div>
                  {!n.read && (
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#FFC928]" />
                  )}
                </button>
              ))
            )}
          </div>
        </section>
      </div>

      {/* 5. DISPATCH PREFERENCES BAR */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#14161A]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm font-bold">
            <SlidersHorizontal className="h-4 w-4 text-[#FFC928]" />
            <span>Dispatch Rules</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
            <label className="flex min-h-[36px] cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={dispatchPreferences.acceptCashRides}
                onChange={(e) => updateDispatchPreferences({ acceptCashRides: e.target.checked })}
                className="h-4 w-4 accent-[#FFC928]"
              />
              <span>Accept Cash Rides</span>
            </label>
            <label className="flex min-h-[36px] cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={dispatchPreferences.autoAcceptEligible}
                onChange={(e) =>
                  updateDispatchPreferences({ autoAcceptEligible: e.target.checked })
                }
                className="h-4 w-4 accent-[#FFC928]"
              />
              <span>Auto-Accept Eligible</span>
            </label>
            <label className="flex min-h-[36px] cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={dispatchPreferences.homewardFilterEnabled}
                onChange={(e) =>
                  updateDispatchPreferences({ homewardFilterEnabled: e.target.checked })
                }
                className="h-4 w-4 accent-[#FFC928]"
              />
              <span>Homeward Filter</span>
            </label>
          </div>
        </div>

        {dispatchPreferences.homewardFilterEnabled && (
          <input
            type="text"
            placeholder="Enter preferred return destination or hub"
            value={dispatchPreferences.homewardDestination}
            onChange={(e) => updateDispatchPreferences({ homewardDestination: e.target.value })}
            className="mt-3 min-h-[42px] w-full rounded-xl border border-neutral-300 bg-[#F7F8FA] px-3.5 text-xs outline-none focus:border-[#FFC928] dark:border-neutral-700 dark:bg-[#1A1D23]"
          />
        )}
      </section>

    </div>
  );
};

export const OnlineModeScreen: React.FC = () => {
  const { driverProfile, vehicle, onlineEligibility, liveLocation, requestGpsFix, navigate } =
    useDriverApp();

  return (
    <div className="space-y-6">
      <ScreenHeader
        title="Online / Offline Duty Mode"
        subtitle="Controlled strictly by backend verification and real GPS readiness"
      />

      <OnlineToggle />

      <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-[#14161A]">
        <div className="flex items-start gap-3">
          {onlineEligibility.allowed ? (
            <ShieldCheck className="mt-0.5 h-6 w-6 text-emerald-600" />
          ) : (
            <Lock className="mt-0.5 h-6 w-6 text-neutral-500" />
          )}
          <div className="space-y-2">
            <h2 className="font-display text-base font-bold">
              {driverProfile?.is_online
                ? `Listening for ${vehicle?.category.toUpperCase() ?? 'Partner'} Offers`
                : 'Dispatch Standby'}
            </h2>
            {!onlineEligibility.allowed ? (
              <ul className="list-disc space-y-1 pl-4 text-sm text-neutral-600 dark:text-neutral-400">
                {onlineEligibility.blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Eligible for real-time dispatch matching in {driverProfile?.city}.
              </p>
            )}
            <div className="flex flex-wrap gap-3 pt-2">
              <PrimaryButton variant="outline" onClick={() => void requestGpsFix()}>
                {liveLocation ? 'Refresh GPS Coordinates' : 'Verify Device GPS'}
              </PrimaryButton>
              <PrimaryButton variant="dark" onClick={() => navigate('incoming_ride')}>
                Open Ride Offer Listener
              </PrimaryButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const IncomingRideScreen: React.FC = () => {
  const { backendConfigured, driverProfile, incomingOffer, setIncomingOffer, navigate } =
    useDriverApp();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [declining, setDeclining] = useState(false);

  useEffect(() => {
    if (!incomingOffer?.offer_expires_at) {
      setSecondsLeft(null);
      return;
    }
    const expiryMs = new Date(incomingOffer.offer_expires_at).getTime();
    if (Number.isNaN(expiryMs)) {
      setSecondsLeft(null);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((expiryMs - Date.now()) / 1000));
      setSecondsLeft(left);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [incomingOffer?.offer_expires_at, incomingOffer?.ride_id]);

  const handleDeclineQuick = async () => {
    setDeclining(true);
    try {
      if (incomingOffer && driverProfile) {
        await driverBackendService.rides.rejectRide(incomingOffer.ride_id, driverProfile.driver_id);
      }
      setIncomingOffer(null);
      navigate('dashboard');
    } finally {
      setDeclining(false);
    }
  };

  return (
    <div className="space-y-6">
      <ScreenHeader
        title="Incoming Ride Request"
        subtitle="Real-time dispatch stream via Supabase Realtime"
      />

      {!backendConfigured ? (
        <StateNotice
          variant="unconfigured"
          title="Realtime Ride Dispatch Requires Backend"
          description="Incoming ride requests are pushed exclusively from the shared SHINE CAB Customer App through Supabase Realtime. No fake ride requests are generated."
          missingEnvVars={['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']}
        />
      ) : !incomingOffer ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-[#14161A]">
          <Radio className="mx-auto h-8 w-8 text-neutral-400" />
          <h2 className="mt-3 font-display text-lg font-bold">No Active Ride Offers</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-neutral-500 dark:text-neutral-400">
            {driverProfile?.is_online
              ? 'You are online and subscribed to offers matching your verified vehicle category.'
              : 'Go Online after admin approval to receive real customer ride requests.'}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-[#FFC928] bg-white p-5 dark:bg-[#14161A]">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="font-mono-num block text-xs font-semibold text-neutral-500">
                Ride {incomingOffer.ride_id}
              </span>
              {secondsLeft !== null && (
                <span className="font-mono-num mt-0.5 inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-[#FFC928]">
                  <Clock className="h-3.5 w-3.5" />
                  Offer expires in {secondsLeft}s
                </span>
              )}
            </div>
            <span className="font-mono-num text-2xl font-extrabold">
              ₹{incomingOffer.estimated_fare_inr.toFixed(0)}
            </span>
          </div>
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <p className="text-xs text-neutral-500">Pickup</p>
              <p className="font-semibold">{incomingOffer.pickup_address}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Dropoff</p>
              <p className="font-semibold">{incomingOffer.dropoff_address}</p>
            </div>
            <p className="font-mono-num text-xs text-neutral-500">
              {incomingOffer.estimated_distance_km} km · {incomingOffer.estimated_duration_min} min ·{' '}
              {incomingOffer.payment_mode.toUpperCase()}
            </p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <PrimaryButton
              variant="brand"
              className="flex-1"
              onClick={() => navigate('ride_accept_decision')}
            >
              Accept / Decide
            </PrimaryButton>
            <PrimaryButton variant="outline" disabled={declining} onClick={() => void handleDeclineQuick()}>
              <XCircle className="h-4 w-4" />
              {declining ? 'Declining…' : 'Decline'}
            </PrimaryButton>
          </div>
        </div>
      )}
    </div>
  );
};

export const RideAcceptDecisionScreen: React.FC = () => {
  const {
    backendConfigured,
    driverProfile,
    incomingOffer,
    setIncomingOffer,
    setActiveRide,
    setFeedback,
    navigate,
  } = useDriverApp();
  const [submitting, setSubmitting] = useState(false);

  const handleAccept = async () => {
    if (!incomingOffer || !driverProfile) {
      setFeedback({
        type: 'error',
        title: 'No Verified Offer',
        message: 'Atomic ride acceptance requires a real backend ride offer and authenticated approved driver.',
      });
      return;
    }
    setSubmitting(true);
    const res = await driverBackendService.rides.acceptRide(
      incomingOffer.ride_id,
      driverProfile.driver_id
    );
    setSubmitting(false);
    if (!res.ok) {
      setFeedback({
        type: 'error',
        title:
          res.error?.code === 'RIDE_ALREADY_TAKEN'
            ? 'Ride Already Claimed'
            : 'Acceptance Failed',
        message: res.error?.message || 'Unable to accept ride.',
      });
      return;
    }
    if (res.data?.ride) {
      setActiveRide(res.data.ride);
    }
    setIncomingOffer(null);
    navigate('pickup_navigation');
  };

  const handleReject = async () => {
    if (!incomingOffer || !driverProfile) {
      navigate('dashboard');
      return;
    }
    setSubmitting(true);
    await driverBackendService.rides.rejectRide(incomingOffer.ride_id, driverProfile.driver_id);
    setSubmitting(false);
    setIncomingOffer(null);
    navigate('dashboard');
  };

  return (
    <div className="space-y-6">
      <ScreenHeader
        title="Ride Accept / Reject"
        subtitle="Atomic server lock prevents multiple drivers claiming the same ride"
      />

      {!backendConfigured || !incomingOffer ? (
        <StateNotice
          variant={backendConfigured ? 'empty' : 'unconfigured'}
          title={backendConfigured ? 'No Pending Offer Selected' : 'Atomic Dispatch Endpoint Unconfigured'}
          description="Only real backend ride offers can be accepted via the accept-ride Edge Function (SQL accept_ride_atomic RPC)."
          missingEnvVars={backendConfigured ? undefined : ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']}
        />
      ) : (
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-[#14161A]">
          <p className="text-sm font-semibold">
            Confirm atomic acceptance for Ride {incomingOffer.ride_id}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            First valid driver confirmation wins; competing requests receive HTTP 409 Conflict.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <PrimaryButton variant="brand" disabled={submitting} onClick={() => void handleAccept()}>
              <CheckCircle2 className="h-4 w-4" />
              {submitting ? 'Claiming Ride…' : 'Accept Ride Atomically'}
            </PrimaryButton>
            <PrimaryButton variant="outline" disabled={submitting} onClick={() => void handleReject()}>
              <XCircle className="h-4 w-4" />
              Decline Offer
            </PrimaryButton>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-[#14161A] dark:text-neutral-400">
        <div className="flex items-start gap-2.5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
          <p>
            Contract guarantee: Acceptance updates both Customer App and Driver App simultaneously
            with shared driver_id, vehicle_id, and ride_id.
          </p>
        </div>
      </div>
    </div>
  );
};
