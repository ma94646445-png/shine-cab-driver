import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bike,
  Car,
  CheckCircle2,
  Compass,
  ExternalLink,
  FileUp,
  Globe,
  Lock,
  LogIn,
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Trash2,
  User,
  UserPlus,
} from 'lucide-react';
import bikeDriverImg from '../../../src/assets/images/real_bike_driver_shine_1795249498860.jpg';
import autoDriverImg from '../../../src/assets/images/real_auto_driver_1795249484808.jpg';
import cabDriverImg from '../../../src/assets/images/real_cab_driver_1795249484707.jpg';
import { BrandLogo } from '../branding/BrandLogo';
import { LiveLeafletMap } from '../components/LiveLeafletMap';
import { PhotoActionButtons } from '../components/PhotoCaptureControl';
import { PrimaryButton, ScreenHeader, StateNotice } from '../components/UiPrimitives';
import type { DocumentType } from '../contracts/types';
import {
  validateAdultDob,
  validateEmail,
  validateIndianPhone,
  validateVehicleRegNumber,
  validateVehicleYear,
} from '../contracts/validators';
import { INDIAN_LANGUAGES } from '../i18n/translations';
import { mapsProviderAdapter } from '../services/adapters/externalAdapters';
import { driverBackendService } from '../services/driverBackendService';
import { useDriverApp } from '../state/DriverAppContext';
import { ALL_KYC_DOCUMENTS } from './KycOnboardingScreens';

const TOP_INDIAN_CITIES = [
  'Delhi NCR',
  'Mumbai',
  'Bengaluru',
  'Hyderabad',
  'Chennai',
  'Kolkata',
  'Pune',
  'Ahmedabad',
  'Jaipur',
  'Lucknow',
  'Patna',
  'Chandigarh',
];

export const SplashScreen: React.FC = () => {
  const { navigate, t } = useDriverApp();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      navigate('onboarding');
    }, 2400);
    return () => window.clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="relative flex min-h-full flex-1 flex-col justify-between bg-[#1E1E1E] px-4 py-5 text-white">
      {/* Top-Left Skip Icon & Button -> Direct Redirect to Driver Home */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('dashboard')}
          aria-label="Skip to Home"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-neutral-800 bg-[#262626] px-3.5 py-2 text-xs font-bold text-white transition-colors hover:border-[#F5C518] hover:text-[#F5C518]"
        >
          <SkipForward className="h-4 w-4 text-[#F5C518]" />
          <span>{t.skip}</span>
        </button>

        <span className="font-mono-num text-[11px] font-semibold tracking-widest text-neutral-400">
          01 / 07
        </span>
      </div>

      <div className="mx-auto flex w-full flex-1 flex-col items-center justify-center py-6 text-center">
        <BrandLogo variant="dark" size="lg" showTagline className="justify-center" />
        <h1 className="mt-7 font-display text-2xl font-extrabold tracking-tight text-balance text-white">
          {t.splashTitle}
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-neutral-300">
          {t.splashSubtitle}
        </p>

        <div className="mt-7 grid w-full grid-cols-3 gap-2.5 text-left">
          <div className="rounded-2xl border border-neutral-800 bg-[#252525] p-3">
            <Bike className="h-5 w-5 text-[#F5C518]" />
            <p className="mt-2 text-xs font-bold text-white">Bike</p>
            <p className="text-[11px] text-neutral-400">Fast hops</p>
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-[#252525] p-3">
            <ShieldCheck className="h-5 w-5 text-[#F5C518]" />
            <p className="mt-2 text-xs font-bold text-white">Auto</p>
            <p className="text-[11px] text-neutral-400">Daily trips</p>
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-[#252525] p-3">
            <Car className="h-5 w-5 text-[#F5C518]" />
            <p className="mt-2 text-xs font-bold text-white">Cab</p>
            <p className="text-[11px] text-neutral-400">Sedan &amp; SUV</p>
          </div>
        </div>

        <div className="mt-7 flex w-full flex-col gap-2.5">
          <PrimaryButton
            variant="brand"
            className="w-full"
            onClick={() => navigate('onboarding')}
          >
            <span>{t.continueBtn}</span>
            <ArrowRight className="h-4 w-4" />
          </PrimaryButton>
          <PrimaryButton
            variant="outline"
            className="w-full border-neutral-700 bg-transparent text-white hover:bg-neutral-800"
            onClick={() => navigate('login_otp')}
          >
            <LogIn className="h-4 w-4" />
            <span>{t.loginBtn}</span>
          </PrimaryButton>
        </div>
      </div>

      <p className="text-center text-xs tracking-[0.18em] text-neutral-400">
        SHINE CAPTAIN · DRIVER APP • PARTNER
      </p>
    </div>
  );
};

export const OnboardingScreen: React.FC = () => {
  const {
    navigate,
    t,
    appSettings,
    updateAppSettings,
    onboardingDraft,
    updateDraft,
    liveLocation,
    locationError,
    watchingGps,
    toggleWatchGps,
    requestGpsFix,
    refreshDriverWorkspace,
    setFeedback,
  } = useDriverApp();

  const [step, setStep] = useState(0); // 0: Bike, 1: Auto, 2: Cab, 3: Language & City, 4: Map & Auto GPS, 5: Login & Sign Up
  const [failedSlides, setFailedSlides] = useState<Record<number, boolean>>({});
  const [slidePaused, setSlidePaused] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const totalSteps = 6;
  const isVehicleCarousel = step <= 2;

  useEffect(() => {
    if (!isVehicleCarousel || slidePaused) return;
    const timer = window.setInterval(() => {
      setStep((prev) => (prev < 2 ? prev + 1 : 0));
    }, 3500);
    return () => window.clearInterval(timer);
  }, [isVehicleCarousel, slidePaused, step]);

  const vehicleSlides = [
    {
      label: 'Bike',
      badge: '01 · BIKE TAXI PARTNER',
      title: t.bikeTitle,
      body: t.bikeBody,
      image: bikeDriverImg,
      alt: 'Real Indian bike taxi driver partner smiling on a black and yellow motorbike',
      highlights: ['Instant Bike Ride Dispatch', 'Direct UPI & Cash Fares', '24×7 SOS Protection'],
      Icon: Bike,
    },
    {
      label: 'Auto',
      badge: '02 · AUTO RICKSHAW PARTNER',
      title: t.autoTitle,
      body: t.autoBody,
      image: autoDriverImg,
      alt: 'Real Indian auto-rickshaw driver standing beside a yellow and black CNG auto',
      highlights: ['Metro & Market Hub Demand', '4-Digit Customer Pickup OTP', 'Clear Trip Accounting'],
      Icon: ShieldCheck,
    },
    {
      label: 'Cab',
      badge: '03 · CAB PARTNER (SEDAN & SUV)',
      title: t.cabTitle,
      body: t.cabBody,
      image: cabDriverImg,
      alt: 'Real Indian commercial taxi driver standing next to a white sedan cab',
      highlights: ['City & Airport Transfers', 'Free OpenStreetMap + OSRM Routing', 'Verified Bank Settlements'],
      Icon: Car,
    },
  ];

  const activeLanguageMeta =
    INDIAN_LANGUAGES.find((l) => l.code === appSettings.appLanguage) || INDIAN_LANGUAGES[0];

  const handleGoogleSignIn = async () => {
    setGoogleBusy(true);
    const res = await driverBackendService.auth.signInWithGoogle();
    setGoogleBusy(false);
    if (!res.ok) {
      setFeedback({
        type: 'error',
        title: 'Google Sign-In Failed',
        message: res.error?.message || 'Unable to sign in with Google.',
      });
      return;
    }
    await refreshDriverWorkspace();
    const profileCheck = await driverBackendService.driver.getProfile();
    if (profileCheck.ok && profileCheck.data?.profile_completed && profileCheck.data?.admin_approved) {
      navigate('dashboard');
      return;
    }
    navigate('registration');
  };

  return (
    <div className="flex min-h-full flex-1 flex-col justify-between bg-[#1E1E1E] px-4 py-4 text-white">
      {/* Universal SHINE CAPTAIN Logo Bar on All Onboarding Pages */}
      <div className="mb-3 flex items-center justify-between border-b border-neutral-800 pb-2.5">
        <BrandLogo variant="dark" size="xs" showTagline />
        <span className="font-mono-num text-[11px] font-bold text-neutral-400">
          0{step + 2} / 07
        </span>
      </div>

      {/* Top Bar: Vehicle Tabs on Slides 1-3 (No Skip button); Skip + Back on Steps 4-6 */}
      <div className="flex w-full items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {!isVehicleCarousel ? (
            <>
              <button
                type="button"
                onClick={() => navigate('dashboard')}
                aria-label="Skip onboarding and open Home"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-neutral-800 bg-[#262626] px-3.5 py-2 text-xs font-bold text-white transition-colors hover:border-[#F5C518] hover:text-[#F5C518]"
              >
                <SkipForward className="h-4 w-4 text-[#F5C518]" />
                <span>{t.skip}</span>
              </button>
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                aria-label="Previous onboarding page"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl border border-neutral-800 bg-[#262626] text-neutral-300 hover:border-neutral-600 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-1 rounded-2xl border border-neutral-800 bg-[#262626] p-1">
              {vehicleSlides.map((slide, idx) => (
                <button
                  key={slide.label}
                  type="button"
                  onClick={() => setStep(idx)}
                  className={`min-h-[36px] rounded-xl px-3 text-xs font-bold whitespace-nowrap transition-colors ${
                    step === idx
                      ? 'bg-[#F5C518] text-[#1E1E1E]'
                      : 'text-neutral-300 hover:text-white'
                  }`}
                >
                  {slide.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalSteps }).map((_, idx) => (
            <button
              key={idx}
              type="button"
              aria-label={`Go to onboarding page ${idx + 1}`}
              onClick={() => setStep(idx)}
              className={`h-2 rounded-full transition-all ${
                idx === step ? 'w-7 bg-[#F5C518]' : 'w-2 bg-neutral-700 hover:bg-neutral-500'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Main Content Card */}
      <div className="my-4 w-full flex-1">
        {/* Steps 0..2: Auto-Slide Real Photo Carousel for Bike, Auto & Cab */}
        {isVehicleCarousel && (
          <div
            onMouseEnter={() => setSlidePaused(true)}
            onMouseLeave={() => setSlidePaused(false)}
            onTouchStart={() => setSlidePaused(true)}
            onTouchEnd={() => setSlidePaused(false)}
            onTouchCancel={() => setSlidePaused(false)}
            className="overflow-hidden rounded-3xl border border-neutral-800 bg-[#252525]"
          >
            <div className="overflow-hidden">
              <div
                className="flex transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{ transform: `translateX(-${step * 100}%)` }}
              >
                {vehicleSlides.map((slide, idx) => {
                  const SlideIcon = slide.Icon;
                  const imageFailed = failedSlides[idx];
                  return (
                    <div key={slide.badge} className="w-full shrink-0">
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#161616]">
                        {!imageFailed ? (
                          <img
                            src={slide.image}
                            alt={slide.alt}
                            referrerPolicy="no-referrer"
                            onError={() =>
                              setFailedSlides((prev) => ({ ...prev, [idx]: true }))
                            }
                            className="h-full w-full object-cover object-center"
                          />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#252525] via-[#1E1E1E] to-[#141414] p-6 text-center">
                            <SlideIcon className="h-12 w-12 text-[#F5C518]" />
                            <p className="mt-3 text-sm font-bold text-white">{slide.title}</p>
                          </div>
                        )}
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#252525] via-[#252525]/50 to-transparent" />
                      </div>

                      <div className="space-y-3.5 p-4 pt-2">
                        <div className="flex items-center justify-between gap-2 text-xs text-neutral-400">
                          <span className="font-bold tracking-wider text-[#F5C518]">
                            {slide.badge}
                          </span>
                          <span className="font-mono-num text-[11px] font-semibold">
                            Auto-Slide {idx + 1}/3
                          </span>
                        </div>
                        <h1 className="font-display text-xl font-extrabold tracking-tight text-balance text-white">
                          {slide.title}
                        </h1>
                        <p className="text-xs leading-relaxed text-neutral-300">
                          {slide.body}
                        </p>
                        <div className="grid grid-cols-1 gap-2 pt-1">
                          {slide.highlights.map((item) => (
                            <div
                              key={item}
                              className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-[#1B1B1B] px-3 py-2 text-xs font-semibold text-neutral-200"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#F5C518]" />
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: All Indian Languages + Location Select */}
        {step === 3 && (
          <div className="space-y-4 rounded-3xl border border-neutral-800 bg-[#252525] p-4">
            <div className="flex items-start justify-between gap-3 border-b border-neutral-800 pb-4">
              <div>
                <p className="text-xs font-bold tracking-wider text-[#F5C518]">
                  04 · LANGUAGE &amp; OPERATING LOCATION
                </p>
                <h1 className="font-display mt-1 text-2xl font-extrabold text-white">
                  {t.langLocationTitle}
                </h1>
                <p className="mt-1 text-xs text-neutral-400">{t.langLocationSubtitle}</p>
              </div>
              <Globe className="h-6 w-6 shrink-0 text-[#F5C518]" />
            </div>

            <div>
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-300">
                  All Indian Languages (Live App Translation)
                </span>
                <span className="text-xs font-bold text-[#F5C518]">
                  Active: {activeLanguageMeta.nativeLabel}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {INDIAN_LANGUAGES.map((lang) => {
                  const selected = appSettings.appLanguage === lang.code;
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => updateAppSettings({ appLanguage: lang.code })}
                      className={`flex min-h-[54px] flex-col items-start justify-center rounded-2xl border px-3 py-2 text-left transition-colors ${
                        selected
                          ? 'border-[#F5C518] bg-[#F5C518] text-[#1E1E1E]'
                          : 'border-neutral-800 bg-[#1B1B1B] text-white hover:border-neutral-600'
                      }`}
                    >
                      <span className="text-sm font-extrabold">{lang.nativeLabel}</span>
                      <span
                        className={`text-[10px] font-medium ${
                          selected ? 'text-[#1E1E1E]/80' : 'text-neutral-400'
                        }`}
                      >
                        {lang.englishName} · {lang.regionHint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3 border-t border-neutral-800 pt-4">
              <label htmlFor="onboarding-city" className="block text-xs font-bold text-neutral-300">
                {t.selectCityLabel}
              </label>
              <div className="flex flex-wrap gap-2">
                {TOP_INDIAN_CITIES.map((city) => {
                  const activeCity = onboardingDraft.city.toLowerCase() === city.toLowerCase();
                  return (
                    <button
                      key={city}
                      type="button"
                      onClick={() => updateDraft({ city })}
                      className={`min-h-[38px] rounded-xl border px-3 text-xs font-semibold transition-colors ${
                        activeCity
                          ? 'border-[#F5C518] bg-[#F5C518] text-[#1E1E1E]'
                          : 'border-neutral-800 bg-[#1B1B1B] text-neutral-300 hover:border-neutral-600'
                      }`}
                    >
                      {city}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-neutral-800 bg-[#1B1B1B] px-3.5">
                <MapPin className="h-4 w-4 shrink-0 text-[#F5C518]" />
                <input
                  id="onboarding-city"
                  type="text"
                  placeholder="Or type your Indian city / district name"
                  value={onboardingDraft.city}
                  onChange={(e) => updateDraft({ city: e.target.value })}
                  className="min-h-[46px] w-full bg-transparent text-sm text-white placeholder-neutral-500 outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Live Free OpenStreetMap (Leaflet) + Auto GPS Speedometer */}
        {step === 4 && (
          <div className="space-y-4 rounded-3xl border border-neutral-800 bg-[#252525] p-4">
            <div className="flex items-start justify-between gap-3 border-b border-neutral-800 pb-4">
              <div>
                <p className="text-xs font-bold tracking-wider text-[#F5C518]">
                  05 · LIVE OPENSTREETMAP &amp; GPS SPEEDOMETER
                </p>
                <h1 className="font-display mt-1 text-2xl font-extrabold text-white">
                  {t.mapTitle}
                </h1>
                <p className="mt-1 text-xs text-neutral-400">{t.mapSubtitle}</p>
              </div>
              <Compass className="h-6 w-6 shrink-0 text-[#F5C518]" />
            </div>

            <LiveLeafletMap
              driverLocation={liveLocation}
              showSpeedometer
              heightClass="h-56"
              onCenterGps={() => void requestGpsFix()}
            />

            {liveLocation && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-800 bg-[#1B1B1B] px-4 py-3">
                <div>
                  <p className="text-[11px] font-bold text-emerald-400">
                    GPS Location &amp; Speedometer Active
                  </p>
                  <p className="font-mono-num text-xs font-semibold text-white">
                    {liveLocation.lat.toFixed(5)}, {liveLocation.lng.toFixed(5)} ·{' '}
                    {Math.round(liveLocation.speed_kmh ?? 0)} km/h
                  </p>
                </div>
                <a
                  href={mapsProviderAdapter.openExternalTurnByTurn(
                    liveLocation.lat,
                    liveLocation.lng,
                    onboardingDraft.city || 'My Location'
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-neutral-700 px-3 text-xs font-semibold text-white hover:border-[#F5C518]"
                >
                  Open in Maps
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            )}

            {locationError && (
              <p className="rounded-xl border border-red-800/60 bg-red-950/30 px-3 py-2 text-xs text-red-300">
                {locationError}
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              <PrimaryButton
                variant="brand"
                className="flex-1"
                onClick={() => void requestGpsFix()}
              >
                <Navigation className="h-4 w-4" />
                <span>{t.autoDetectGpsBtn}</span>
              </PrimaryButton>
              <PrimaryButton
                variant={watchingGps ? 'dark' : 'outline'}
                className="border-neutral-700 bg-[#1B1B1B] text-white hover:border-[#F5C518]"
                onClick={toggleWatchGps}
              >
                {watchingGps ? 'Live GPS Tracking ON' : 'Enable Live GPS Stream'}
              </PrimaryButton>
            </div>
          </div>
        )}

        {/* Step 5: Partner Account Gateway (Google Sign-In + Mobile OTP + KYC Signup) */}
        {step === 5 && (
          <div className="space-y-5 rounded-3xl border border-neutral-800 bg-[#252525] p-4">
            <div className="flex flex-col items-center text-center">
              <BrandLogo variant="dark" size="md" showTagline />
              <p className="mt-4 text-xs font-bold tracking-wider text-[#F5C518]">
                06 · PARTNER ACCOUNT ACCESS
              </p>
              <h1 className="font-display mt-1 text-xl font-extrabold text-white">
                {t.authTitle}
              </h1>
              <p className="mt-2 text-xs leading-relaxed text-neutral-300">
                {t.authSubtitle}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 rounded-2xl border border-neutral-800 bg-[#1B1B1B] p-3.5">
              <div>
                <p className="text-[11px] text-neutral-400">Language</p>
                <p className="mt-0.5 text-sm font-bold text-[#F5C518]">
                  {activeLanguageMeta.nativeLabel}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-neutral-400">Operating City</p>
                <p className="mt-0.5 text-sm font-bold text-white">
                  {onboardingDraft.city || 'Not selected yet'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-neutral-400">GPS Coordinate Fix</p>
                <p className="font-mono-num mt-0.5 text-sm font-bold text-emerald-400">
                  {liveLocation
                    ? `${liveLocation.lat.toFixed(3)}, ${liveLocation.lng.toFixed(3)}`
                    : 'Optional / Later'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              <PrimaryButton
                variant="brand"
                disabled={googleBusy}
                className="min-h-[52px] w-full text-sm"
                onClick={() => void handleGoogleSignIn()}
              >
                <Sparkles className="h-4 w-4" />
                <span>{googleBusy ? 'Connecting Google…' : 'Continue with Google (Instant)'}</span>
              </PrimaryButton>
              <PrimaryButton
                variant="outline"
                className="min-h-[48px] w-full border-neutral-700 bg-[#1B1B1B] text-sm text-white hover:border-[#F5C518]"
                onClick={() => navigate('login_otp')}
              >
                <LogIn className="h-4 w-4 text-[#F5C518]" />
                <span>{t.loginBtn} (Mobile OTP)</span>
              </PrimaryButton>
              <PrimaryButton
                variant="outline"
                className="min-h-[48px] w-full border-[#F5C518] bg-[#1B1B1B] text-sm text-[#F5C518] hover:bg-[#F5C518] hover:text-[#1E1E1E]"
                onClick={() => navigate('registration')}
              >
                <UserPlus className="h-4 w-4" />
                <span>{t.signupBtn}</span>
              </PrimaryButton>
            </div>

            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => navigate('dashboard')}
                className="inline-flex min-h-[44px] items-center gap-2 text-xs font-semibold text-neutral-400 transition-colors hover:text-[#F5C518]"
              >
                <SkipForward className="h-4 w-4" />
                <span>
                  {t.skip} → {t.navHome}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Onboarding Navigation Bar */}
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 pb-1">
        {isVehicleCarousel ? (
          <PrimaryButton
            variant="brand"
            className="min-h-[48px] w-full"
            onClick={() => setStep((s) => s + 1)}
          >
            <span>{t.next}</span>
            <ArrowRight className="h-4 w-4" />
          </PrimaryButton>
        ) : (
          <>
            <PrimaryButton
              variant="outline"
              className="border-neutral-700 bg-transparent text-white hover:bg-neutral-800"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t.back}</span>
            </PrimaryButton>

            {step < totalSteps - 1 ? (
              <PrimaryButton variant="brand" onClick={() => setStep((s) => s + 1)}>
                <span>{t.next}</span>
                <ArrowRight className="h-4 w-4" />
              </PrimaryButton>
            ) : (
              <PrimaryButton variant="brand" onClick={() => navigate('login_otp')}>
                <LogIn className="h-4 w-4" />
                <span>{t.loginBtn}</span>
              </PrimaryButton>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export const LoginOtpScreen: React.FC = () => {
  const {
    backendConfigured,
    onboardingDraft,
    updateDraft,
    setFeedback,
    refreshDriverWorkspace,
    navigate,
    t,
  } = useDriverApp();
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

  useEffect(() => {
    if (!otpSent || resendSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setResendSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [otpSent, resendSeconds]);

  const phoneValidation = validateIndianPhone(onboardingDraft.phone);

  const handleGoogleSignIn = async () => {
    setGoogleBusy(true);
    const res = await driverBackendService.auth.signInWithGoogle();
    setGoogleBusy(false);
    if (!res.ok) {
      setFeedback({
        type: 'error',
        title: 'Google Sign-In Failed',
        message: res.error?.message || 'Unable to authenticate with Google.',
      });
      return;
    }
    await refreshDriverWorkspace();
    const profileCheck = await driverBackendService.driver.getProfile();
    if (profileCheck.ok && profileCheck.data?.profile_completed && profileCheck.data?.admin_approved) {
      navigate('dashboard');
      return;
    }
    setFeedback({
      type: 'success',
      title: 'Signed In to SHINE CAPTAIN',
      message: 'Complete or verify your Captain KYC & vehicle details to go online.',
    });
    navigate('registration');
  };

  const dispatchOtp = async () => {
    if (!phoneValidation.valid) {
      setFeedback({
        type: 'error',
        title: 'Invalid Mobile Number',
        message: 'Enter a valid 10-digit Indian mobile number starting with 6–9.',
      });
      return;
    }
    setBusy(true);
    const res = await driverBackendService.auth.sendOtp(onboardingDraft.phone);
    setBusy(false);
    if (!res.ok) {
      setFeedback({
        type: 'error',
        title: 'OTP Dispatch Failed',
        message: res.error?.message || 'Unable to send OTP.',
      });
      return;
    }
    setOtpSent(true);
    setResendSeconds(res.data?.expiresInSeconds ?? 120);
    setFeedback({
      type: 'success',
      title: 'OTP Dispatched',
      message: `A 6-digit verification code was sent to ${phoneValidation.normalized}.`,
    });
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    await dispatchOtp();
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.trim().length !== 6) {
      setFeedback({
        type: 'error',
        title: '6-Digit OTP Required',
        message: 'Enter the complete 6-digit verification code sent to your mobile number.',
      });
      return;
    }
    setBusy(true);
    const res = await driverBackendService.auth.verifyOtp(onboardingDraft.phone, otpCode);
    setBusy(false);
    if (!res.ok) {
      setFeedback({
        type: 'error',
        title: 'Verification Failed',
        message: res.error?.message || 'Unable to verify OTP.',
      });
      return;
    }
    await refreshDriverWorkspace();
    const profileCheck = await driverBackendService.driver.getProfile();
    if (profileCheck.ok && profileCheck.data?.profile_completed && profileCheck.data?.admin_approved) {
      navigate('dashboard');
      return;
    }
    navigate('registration');
  };

  return (
    <div className="space-y-5">
      {/* Top-Left Skip Icon & Button -> Home + Signup Cross-Link */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate('dashboard')}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3.5 text-xs font-bold text-[#1E1E1E] transition-colors hover:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1B1E24] dark:text-white"
        >
          <SkipForward className="h-4 w-4 text-[#F5C518]" />
          <span>
            {t.skip} → {t.navHome}
          </span>
        </button>

        <button
          type="button"
          onClick={() => navigate('registration')}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#F5C518] px-3.5 text-xs font-bold text-[#1E1E1E]"
        >
          <UserPlus className="h-4 w-4" />
          <span>{t.signupBtn}</span>
        </button>
      </div>

      <ScreenHeader
        title="Captain Partner Sign-In"
        subtitle="Instant Firebase Google Sign-In or verified Mobile SMS OTP"
      />

      {!backendConfigured && (
        <StateNotice
          variant="unconfigured"
          title="Firebase Auth Configuration Missing"
          description="Verify firebase-applet-config.json so Google Sign-In and Phone OTP connect cleanly."
        />
      )}

      {/* Instant Firebase Google Sign-In Card */}
      <section className="rounded-2xl bg-[#1E1E1E] p-4 text-white dark:border dark:border-neutral-800 dark:bg-[#14161A]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold tracking-wider text-[#F5C518]">
              RECOMMENDED · 1-TAP FIREBASE AUTH
            </p>
            <h2 className="font-display mt-1 text-base font-extrabold">
              Instant Captain Sign-In with Google
            </h2>
            <p className="mt-1 text-xs text-neutral-300">
              Syncs your Driver Profile, KYC Uploads, Live Rides &amp; Wallet directly to Cloud Firestore.
            </p>
          </div>
          <Sparkles className="h-5 w-5 shrink-0 text-[#F5C518]" />
        </div>
        <PrimaryButton
          type="button"
          variant="brand"
          disabled={googleBusy}
          className="mt-4 w-full"
          onClick={() => void handleGoogleSignIn()}
        >
          <LogIn className="h-4 w-4" />
          {googleBusy ? 'Signing in with Google…' : 'Continue with Google'}
        </PrimaryButton>
      </section>

      {/* Mobile Number SMS OTP Card */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#14161A]">
        <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp} className="max-w-md space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="driver-phone" className="block text-sm font-semibold">
              Or Sign In via Mobile Number OTP
            </label>
            <div className="flex items-center rounded-xl border border-neutral-300 bg-neutral-50 px-3 dark:border-neutral-700 dark:bg-[#1A1D23]">
              <Phone className="h-4 w-4 text-neutral-500" />
              <span className="font-mono-num px-2 text-sm font-semibold text-neutral-600 dark:text-neutral-300">
                +91
              </span>
              <input
                id="driver-phone"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                disabled={otpSent}
                placeholder="9876543210"
                value={onboardingDraft.phone}
                onChange={(e) =>
                  updateDraft({ phone: e.target.value.replace(/\D/g, '').slice(0, 10) })
                }
                className="font-mono-num min-h-[48px] w-full bg-transparent text-sm outline-none disabled:opacity-60"
              />
            </div>
          </div>

          {otpSent && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="driver-otp" className="block text-sm font-semibold">
                  6-Digit SMS OTP
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setOtpSent(false);
                    setOtpCode('');
                    setResendSeconds(0);
                  }}
                  className="text-xs font-semibold text-[#1E1E1E] underline dark:text-[#F5C518]"
                >
                  Change Number
                </button>
              </div>
              <input
                id="driver-otp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="Enter 6-digit code"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                className="font-mono-num min-h-[48px] w-full rounded-xl border border-neutral-300 bg-neutral-50 px-4 text-base tracking-[0.3em] outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
              />
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono-num text-neutral-500 dark:text-neutral-400">
                  {resendSeconds > 0
                    ? `Resend available in ${resendSeconds}s`
                    : 'Didn’t receive SMS code?'}
                </span>
                <button
                  type="button"
                  disabled={resendSeconds > 0 || busy}
                  onClick={() => void dispatchOtp()}
                  className="inline-flex items-center gap-1 font-bold text-[#1E1E1E] disabled:opacity-40 dark:text-[#F5C518]"
                >
                  <RefreshCw className="h-3 w-3" />
                  Resend OTP
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <PrimaryButton type="submit" variant="dark" disabled={busy}>
              {busy ? 'Processing…' : otpSent ? 'Verify & Sign In' : 'Send Login OTP'}
            </PrimaryButton>
            <PrimaryButton
              type="button"
              variant="outline"
              onClick={() => navigate('registration')}
            >
              {t.signupBtn}
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
};

export const RegistrationScreen: React.FC = () => {
  const {
    backendConfigured,
    driverProfile,
    documents,
    onboardingDraft,
    updateDraft,
    avatarPreviewUrl,
    driverAvatarUrl,
    uploadingAvatar,
    uploadOrSetProfilePhoto,
    clearProfilePhoto,
    stagedDocFiles,
    stageDocumentFile,
    setFeedback,
    refreshDriverWorkspace,
    navigate,
    t,
  } = useDriverApp();

  const [submittingAll, setSubmittingAll] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const handleGoogleQuickAuth = async () => {
    setGoogleBusy(true);
    const res = await driverBackendService.auth.signInWithGoogle();
    setGoogleBusy(false);
    if (!res.ok) {
      setFeedback({
        type: 'error',
        title: 'Google Sign-In Failed',
        message: res.error?.message || 'Unable to sign in.',
      });
      return;
    }
    await refreshDriverWorkspace();
    setFeedback({
      type: 'success',
      title: 'Firebase Session Connected',
      message: 'Your camera & document uploads now sync directly to Super Admin KYC.',
    });
  };

  const attachDocument = async (docType: DocumentType, file: File) => {
    stageDocumentFile(docType, file);
    if (docType === 'driver_selfie' && file.type.startsWith('image/')) {
      await uploadOrSetProfilePhoto(file);
    }
    if (backendConfigured && driverProfile) {
      const res = await driverBackendService.kyc.uploadDocument(driverProfile.driver_id, docType, file);
      if (!res.ok) {
        setFeedback({
          type: 'error',
          title: 'Document Sync Failed',
          message: res.error?.message || 'Unable to compress & save file to Firestore.',
        });
        return;
      }
      setFeedback({
        type: 'success',
        title: 'Document Compressed & Saved',
        message: `${file.name} uploaded to Firestore for Super Admin approval.`,
      });
    }
  };

  const attachedCount = ALL_KYC_DOCUMENTS.filter(
    (doc) =>
      documents.some((d) => d.document_type === doc.type) ||
      Boolean(stagedDocFiles[doc.type] || onboardingDraft.selectedFiles[doc.type])
  ).length;

  const handleSubmitAllRegistration = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!onboardingDraft.fullName.trim() || !onboardingDraft.city.trim()) {
      setFeedback({
        type: 'error',
        title: 'Personal Details Required',
        message: 'Enter your full legal name and operating city before creating your Driver ID.',
      });
      return;
    }

    const phoneRes = validateIndianPhone(onboardingDraft.phone);
    if (!phoneRes.valid) {
      setFeedback({
        type: 'error',
        title: 'Invalid Mobile Number',
        message: 'Enter a valid 10-digit Indian mobile number starting with 6–9.',
      });
      return;
    }

    if (onboardingDraft.email.trim() && !validateEmail(onboardingDraft.email)) {
      setFeedback({
        type: 'error',
        title: 'Invalid Email Address',
        message: 'Enter a valid email address or leave the optional field blank.',
      });
      return;
    }

    if (onboardingDraft.dateOfBirth && !validateAdultDob(onboardingDraft.dateOfBirth)) {
      setFeedback({
        type: 'error',
        title: 'Invalid Date of Birth',
        message: 'Driver partners must be at least 18 years old with a valid date of birth.',
      });
      return;
    }

    if (
      onboardingDraft.emergencyContactPhone.trim() &&
      !validateIndianPhone(onboardingDraft.emergencyContactPhone).valid
    ) {
      setFeedback({
        type: 'error',
        title: 'Invalid Emergency Contact Phone',
        message: 'Enter a valid 10-digit Indian mobile number for your emergency contact.',
      });
      return;
    }

    if (!validateVehicleRegNumber(onboardingDraft.registrationNumber)) {
      setFeedback({
        type: 'error',
        title: 'Valid Vehicle Plate Required',
        message: 'Enter a valid vehicle registration number (e.g. KA01AB1234).',
      });
      return;
    }

    if (!validateVehicleYear(onboardingDraft.vehicleYear)) {
      setFeedback({
        type: 'error',
        title: 'Invalid Vehicle Model Year',
        message: `Enter a valid manufacturing year between 1995 and ${new Date().getFullYear() + 1}.`,
      });
      return;
    }

    if (attachedCount < ALL_KYC_DOCUMENTS.length) {
      setFeedback({
        type: 'error',
        title: 'Upload All Driver & Vehicle Documents',
        message: `${attachedCount} of ${ALL_KYC_DOCUMENTS.length} required documents attached. Attach all Driver & Vehicle docs before Admin review.`,
      });
      return;
    }

    if (!backendConfigured || !driverProfile) {
      setFeedback({
        type: 'info',
        title: 'Sign-In Required to Sync to Admin',
        message:
          'All details and photos are validated locally. Tap "Continue with Google" or Sign in with OTP above so Super Admin can verify them immediately.',
      });
      return;
    }

    setSubmittingAll(true);
    try {
      const profileRes = await driverBackendService.driver.upsertProfile({
        full_name: onboardingDraft.fullName.trim(),
        phone: phoneRes.normalized,
        email: onboardingDraft.email.trim() || undefined,
        city: onboardingDraft.city.trim(),
        date_of_birth: onboardingDraft.dateOfBirth,
        emergency_contact_name: onboardingDraft.emergencyContactName.trim(),
        emergency_contact_phone: onboardingDraft.emergencyContactPhone.trim(),
      });

      if (!profileRes.ok || !profileRes.data) {
        setFeedback({
          type: 'error',
          title: 'Profile Save Failed',
          message: profileRes.error?.message || 'Unable to save Captain profile.',
        });
        return;
      }

      const createdDriverId = profileRes.data.driver_id;

      const vehRes = await driverBackendService.vehicle.upsertVehicle(createdDriverId, {
        category: onboardingDraft.vehicleCategory,
        make: onboardingDraft.vehicleMake.trim() || 'Partner Vehicle',
        model: onboardingDraft.vehicleModel.trim() || 'Standard',
        year: Number(onboardingDraft.vehicleYear) || new Date().getFullYear(),
        color: onboardingDraft.vehicleColor.trim() || 'White',
        registration_number: onboardingDraft.registrationNumber.trim().toUpperCase(),
        permit_number: onboardingDraft.permitNumber.trim() || undefined,
        insurance_expiry: onboardingDraft.insuranceExpiry,
        rc_expiry: onboardingDraft.rcExpiry,
      });

      if (!vehRes.ok) {
        setFeedback({
          type: 'error',
          title: 'Vehicle Registration Failed',
          message: vehRes.error?.message || 'Unable to save vehicle record.',
        });
        return;
      }

      for (const doc of ALL_KYC_DOCUMENTS) {
        const file = stagedDocFiles[doc.type];
        if (file) {
          const uploadRes = await driverBackendService.kyc.uploadDocument(
            createdDriverId,
            doc.type,
            file
          );
          if (!uploadRes.ok) {
            setFeedback({
              type: 'error',
              title: `Failed Uploading ${doc.title}`,
              message: uploadRes.error?.message || 'Document upload error.',
            });
            return;
          }
          if (doc.type === 'driver_selfie' && file.type.startsWith('image/')) {
            await driverBackendService.driver.uploadAvatar(createdDriverId, file);
          }
        }
      }

      const submitRes = await driverBackendService.kyc.submitForApproval(createdDriverId);
      if (!submitRes.ok) {
        setFeedback({
          type: 'error',
          title: 'Admin Submission Failed',
          message: submitRes.error?.message || 'Could not submit application.',
        });
        return;
      }

      await refreshDriverWorkspace();
      setFeedback({
        type: 'success',
        title: 'Submitted for Super Admin Review',
        message:
          'All compressed KYC photos & vehicle details synced to Cloud Firestore. Your Partner Rider ID unlocks automatically once Admin approves.',
      });
      navigate('kyc_pending');
    } finally {
      setSubmittingAll(false);
    }
  };

  const driverDocs = ALL_KYC_DOCUMENTS.filter((d) => d.group === 'driver');
  const vehicleDocs = ALL_KYC_DOCUMENTS.filter((d) => d.group === 'vehicle');

  return (
    <div className="space-y-5">
      {/* Top-Left Skip Icon & Button -> Home + Login Cross-Link */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate('dashboard')}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3.5 text-xs font-bold text-[#1E1E1E] transition-colors hover:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1B1E24] dark:text-white"
        >
          <SkipForward className="h-4 w-4 text-[#F5C518]" />
          <span>
            {t.skip} → {t.navHome}
          </span>
        </button>

        <button
          type="button"
          onClick={() => navigate('login_otp')}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3.5 text-xs font-bold text-[#1E1E1E] transition-colors hover:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1B1E24] dark:text-white"
        >
          <LogIn className="h-4 w-4 text-[#F5C518]" />
          <span>{t.loginBtn}</span>
        </button>
      </div>

      {/* SHINE CAPTAIN ID Creation Hero */}
      <section className="rounded-3xl bg-[#1E1E1E] p-4 text-white shadow-sm dark:border dark:border-neutral-800 dark:bg-[#14161A]">
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wider text-[#F5C518]">
              UNIFIED DRIVER ID &amp; VEHICLE KYC APPLICATION
            </p>
            <h1 className="font-display mt-1 text-xl font-extrabold text-white">
              Create Driver ID &amp; Upload All Docs
            </h1>
            <p className="mt-1 text-xs text-neutral-300">
              Photos auto-compress on device &amp; sync directly to Firestore so Super Admin sees them immediately.
            </p>
          </div>

          {!driverProfile && (
            <PrimaryButton
              type="button"
              variant="brand"
              disabled={googleBusy}
              className="w-full"
              onClick={() => void handleGoogleQuickAuth()}
            >
              <Sparkles className="h-4 w-4" />
              {googleBusy ? 'Connecting Google…' : 'Sign In with Google First (Instant Sync)'}
            </PrimaryButton>
          )}

          <div className="rounded-2xl border border-neutral-800 bg-[#262626] px-3.5 py-2.5 text-left">
            <p className="text-[11px] text-neutral-400">Partner Rider ID</p>
            <p className="font-mono-num mt-0.5 flex items-center gap-1.5 text-sm font-bold text-[#F5C518]">
              {driverProfile?.admin_approved && driverProfile?.partner_rider_id ? (
                <>
                  <BadgeCheck className="h-4 w-4" />
                  {driverProfile.partner_rider_id}
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5" />
                  Issued After Admin Approval
                </>
              )}
            </p>
          </div>
        </div>
      </section>

      <form onSubmit={handleSubmitAllRegistration} className="space-y-4">
        {/* 1. Driver Profile Photo (Syncs to Header Avatar & Super Admin) */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#14161A]">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3.5">
              {driverAvatarUrl ? (
                <img
                  src={driverAvatarUrl}
                  alt="Driver Portrait"
                  className="h-14 w-14 shrink-0 rounded-2xl object-cover ring-2 ring-[#F5C518]"
                />
              ) : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#1E1E1E] text-[#F5C518]">
                  <User className="h-6 w-6" />
                </span>
              )}
              <div>
                <h2 className="font-display text-sm font-bold">1. Real Driver Profile Photo</h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Capture via camera or upload from gallery — auto-syncs to Super Admin &amp; Header Avatar
                </p>
              </div>
            </div>
            <div className="w-full space-y-2">
              <PhotoActionButtons
                onSelectFile={(file) => void uploadOrSetProfilePhoto(file)}
                facingMode="user"
                accept="image/*"
                cameraTitle="Click Driver Profile Photo"
                busy={uploadingAvatar}
                cameraLabel="Click Photo"
                uploadLabel="Upload Photo"
              />
              {avatarPreviewUrl && !driverProfile?.avatar_url && (
                <button
                  type="button"
                  onClick={clearProfilePhoto}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-neutral-300 px-3 text-xs font-semibold text-neutral-600 hover:border-red-400 hover:text-red-600 dark:border-neutral-700 dark:text-neutral-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear Local Photo Preview
                </button>
              )}
            </div>
          </div>
        </section>

        {/* 2. Personal & Emergency Details */}
        <section className="space-y-3.5 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#14161A]">
          <h2 className="font-display border-b border-neutral-200 pb-2.5 text-sm font-bold dark:border-neutral-800">
            2. Personal &amp; Emergency Details
          </h2>
          <div className="grid grid-cols-1 gap-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Full Legal Name</label>
              <input
                type="text"
                placeholder="As printed on Driving License"
                value={onboardingDraft.fullName}
                onChange={(e) => updateDraft({ fullName: e.target.value })}
                className="min-h-[44px] w-full rounded-xl border border-neutral-300 bg-[#F7F8FA] px-3.5 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Mobile Number</label>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="10-digit mobile number"
                value={onboardingDraft.phone}
                onChange={(e) =>
                  updateDraft({ phone: e.target.value.replace(/\D/g, '').slice(0, 10) })
                }
                className="font-mono-num min-h-[44px] w-full rounded-xl border border-neutral-300 bg-[#F7F8FA] px-3.5 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Operating City</label>
              <input
                type="text"
                placeholder="e.g. Bengaluru, Delhi, Mumbai"
                value={onboardingDraft.city}
                onChange={(e) => updateDraft({ city: e.target.value })}
                className="min-h-[44px] w-full rounded-xl border border-neutral-300 bg-[#F7F8FA] px-3.5 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Date of Birth</label>
              <input
                type="date"
                value={onboardingDraft.dateOfBirth}
                onChange={(e) => updateDraft({ dateOfBirth: e.target.value })}
                className="font-mono-num min-h-[44px] w-full rounded-xl border border-neutral-300 bg-[#F7F8FA] px-3.5 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Emergency Contact Name &amp; Phone</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Contact name"
                  value={onboardingDraft.emergencyContactName}
                  onChange={(e) => updateDraft({ emergencyContactName: e.target.value })}
                  className="min-h-[44px] w-full rounded-xl border border-neutral-300 bg-[#F7F8FA] px-3 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
                />
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="Emergency phone"
                  value={onboardingDraft.emergencyContactPhone}
                  onChange={(e) =>
                    updateDraft({
                      emergencyContactPhone: e.target.value.replace(/\D/g, '').slice(0, 10),
                    })
                  }
                  className="font-mono-num min-h-[44px] w-full rounded-xl border border-neutral-300 bg-[#F7F8FA] px-3 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
                />
              </div>
            </div>
          </div>
        </section>

        {/* 3. Vehicle Category & Registration */}
        <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-[#14161A]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-3 dark:border-neutral-800">
            <h2 className="font-display text-base font-bold">3. Vehicle Details &amp; Permit</h2>
            <div className="flex items-center gap-1 rounded-xl bg-[#F7F8FA] p-1 dark:bg-[#1A1D23]">
              {(['bike', 'auto', 'cab'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => updateDraft({ vehicleCategory: cat })}
                  className={`min-h-[34px] rounded-lg px-3 text-xs font-semibold uppercase ${
                    onboardingDraft.vehicleCategory === cat
                      ? 'bg-[#1E1E1E] text-white dark:bg-[#F5C518] dark:text-[#1E1E1E]'
                      : 'text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Registration Number</label>
              <input
                type="text"
                placeholder="KA01AB1234"
                value={onboardingDraft.registrationNumber}
                onChange={(e) => updateDraft({ registrationNumber: e.target.value.toUpperCase() })}
                className="font-mono-num min-h-[44px] w-full rounded-xl border border-neutral-300 bg-[#F7F8FA] px-3.5 text-sm uppercase outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Make &amp; Model</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Make"
                  value={onboardingDraft.vehicleMake}
                  onChange={(e) => updateDraft({ vehicleMake: e.target.value })}
                  className="min-h-[44px] w-full rounded-xl border border-neutral-300 bg-[#F7F8FA] px-3 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
                />
                <input
                  type="text"
                  placeholder="Model"
                  value={onboardingDraft.vehicleModel}
                  onChange={(e) => updateDraft({ vehicleModel: e.target.value })}
                  className="min-h-[44px] w-full rounded-xl border border-neutral-300 bg-[#F7F8FA] px-3 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Permit Number (Commercial)</label>
              <input
                type="text"
                placeholder="State permit / badge no."
                value={onboardingDraft.permitNumber}
                onChange={(e) => updateDraft({ permitNumber: e.target.value })}
                className="font-mono-num min-h-[44px] w-full rounded-xl border border-neutral-300 bg-[#F7F8FA] px-3.5 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Insurance Expiry</label>
              <input
                type="date"
                value={onboardingDraft.insuranceExpiry}
                onChange={(e) => updateDraft({ insuranceExpiry: e.target.value })}
                className="font-mono-num min-h-[44px] w-full rounded-xl border border-neutral-300 bg-[#F7F8FA] px-3.5 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">RC Validity Expiry</label>
              <input
                type="date"
                value={onboardingDraft.rcExpiry}
                onChange={(e) => updateDraft({ rcExpiry: e.target.value })}
                className="font-mono-num min-h-[44px] w-full rounded-xl border border-neutral-300 bg-[#F7F8FA] px-3.5 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Year &amp; Color</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="2024"
                  value={onboardingDraft.vehicleYear}
                  onChange={(e) => updateDraft({ vehicleYear: e.target.value })}
                  className="font-mono-num min-h-[44px] w-full rounded-xl border border-neutral-300 bg-[#F7F8FA] px-3 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
                />
                <input
                  type="text"
                  placeholder="White"
                  value={onboardingDraft.vehicleColor}
                  onChange={(e) => updateDraft({ vehicleColor: e.target.value })}
                  className="min-h-[44px] w-full rounded-xl border border-neutral-300 bg-[#F7F8FA] px-3 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
                />
              </div>
            </div>
          </div>
        </section>

        {/* 4. All Driver & Vehicle Documents Together */}
        <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-[#14161A]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-3 dark:border-neutral-800">
            <div>
              <h2 className="font-display text-base font-bold">
                4. All Driver &amp; Vehicle Authentication Documents
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Click camera photos or upload files — compressed &amp; synced straight to Super Admin
              </p>
            </div>
            <span className="font-mono-num text-xs font-bold text-[#1E1E1E] dark:text-[#F5C518]">
              {attachedCount} / {ALL_KYC_DOCUMENTS.length} Attached
            </span>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-bold tracking-wide text-neutral-500 uppercase">
              Driver Identity &amp; License Documents
            </p>
            <div className="grid grid-cols-1 gap-3">
              {driverDocs.map((doc) => {
                const remote = documents.find((d) => d.document_type === doc.type);
                const localName = onboardingDraft.selectedFiles[doc.type];
                const previewSrc =
                  remote?.file_url && remote.file_url.startsWith('data:image/')
                    ? remote.file_url
                    : null;
                return (
                  <div
                    key={doc.type}
                    className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-[#F7F8FA] p-3.5 dark:border-neutral-800 dark:bg-[#1A1D23]"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-bold">{doc.title}</p>
                        <span className="text-[11px] font-semibold text-neutral-500">
                          {remote ? remote.status : localName ? 'Attached' : 'Required'}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-neutral-500">{doc.hint}</p>
                      {(remote?.file_name || localName) && (
                        <p className="font-mono-num mt-1.5 truncate text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                          {remote?.file_name || localName}
                        </p>
                      )}
                      {previewSrc && (
                        <img
                          src={previewSrc}
                          alt={doc.title}
                          className="mt-2 h-24 w-36 rounded-lg border border-neutral-300 object-cover dark:border-neutral-700"
                        />
                      )}
                    </div>
                    <div className="mt-3">
                      <PhotoActionButtons
                        onSelectFile={(file) => void attachDocument(doc.type, file)}
                        facingMode={doc.type === 'driver_selfie' ? 'user' : 'environment'}
                        cameraTitle={`Capture ${doc.title}`}
                        cameraLabel="Click Photo"
                        uploadLabel="Upload"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <p className="text-xs font-bold tracking-wide text-neutral-500 uppercase">
              Vehicle Authentication Documents
            </p>
            <div className="grid grid-cols-1 gap-3">
              {vehicleDocs.map((doc) => {
                const remote = documents.find((d) => d.document_type === doc.type);
                const localName = onboardingDraft.selectedFiles[doc.type];
                const previewSrc =
                  remote?.file_url && remote.file_url.startsWith('data:image/')
                    ? remote.file_url
                    : null;
                return (
                  <div
                    key={doc.type}
                    className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-[#F7F8FA] p-3.5 dark:border-neutral-800 dark:bg-[#1A1D23]"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-bold">{doc.title}</p>
                        <span className="text-[11px] font-semibold text-neutral-500">
                          {remote ? remote.status : localName ? 'Attached' : 'Required'}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-neutral-500">{doc.hint}</p>
                      {(remote?.file_name || localName) && (
                        <p className="font-mono-num mt-1.5 truncate text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                          {remote?.file_name || localName}
                        </p>
                      )}
                      {previewSrc && (
                        <img
                          src={previewSrc}
                          alt={doc.title}
                          className="mt-2 h-24 w-36 rounded-lg border border-neutral-300 object-cover dark:border-neutral-700"
                        />
                      )}
                    </div>
                    <div className="mt-3">
                      <PhotoActionButtons
                        onSelectFile={(file) => void attachDocument(doc.type, file)}
                        facingMode="environment"
                        cameraTitle={`Capture ${doc.title}`}
                        cameraLabel="Click Photo"
                        uploadLabel="Upload"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 5. Submit Complete Application -> Admin Review -> Partner Rider ID */}
        <div className="flex flex-wrap items-center gap-3">
          <PrimaryButton type="submit" variant="brand" disabled={submittingAll}>
            <FileUp className="h-4 w-4" />
            {submittingAll
              ? 'Syncing ID & Documents…'
              : 'Create Driver ID & Submit All Docs to Admin'}
          </PrimaryButton>
          <PrimaryButton type="button" variant="outline" onClick={() => navigate('kyc_pending')}>
            Check Admin Approval &amp; Rider ID
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
};
