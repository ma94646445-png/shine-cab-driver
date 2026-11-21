import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { IntegrationStatus } from '../contracts/integrations';
import type {
  DocumentType,
  DriverDocumentRecord,
  DriverNotification,
  DriverProfile,
  DriverRatingRecord,
  EarningsSummary,
  GeoPoint,
  PayoutRecord,
  RideRecord,
  ScreenId,
  SupportTicket,
  VehicleCategory,
  VehicleRecord,
  WalletAccount,
} from '../contracts/types';
import { canDriverGoOnline, type OnlineEligibilityResult } from '../contracts/validators';
import {
  getTranslations,
  type AppTranslations,
  type IndianLanguageCode,
} from '../i18n/translations';
import { liveLocationAdapter } from '../services/adapters/locationAdapter';
import { playRideOfferAlert } from '../services/adapters/soundAlert';
import { getAllIntegrationStatuses, isSupabaseConfigured } from '../services/config';
import { driverBackendService } from '../services/driverBackendService';

export interface OnboardingDraft {
  phone: string;
  fullName: string;
  email: string;
  city: string;
  dateOfBirth: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  vehicleCategory: VehicleCategory;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  vehicleColor: string;
  registrationNumber: string;
  permitNumber: string;
  insuranceExpiry: string;
  rcExpiry: string;
  selectedFiles: Partial<Record<DocumentType, string>>;
}

export interface DispatchPreferences {
  autoAcceptEligible: boolean;
  acceptCashRides: boolean;
  homewardFilterEnabled: boolean;
  homewardDestination: string;
}

export interface AppSettings {
  appLanguage: IndianLanguageCode;
  preferredNavigationApp: 'google_maps' | 'in_app_gps';
  voiceGuidanceEnabled: boolean;
  highAccuracyGps: boolean;
  rideOfferRingtone: 'chime' | 'urgent_bell' | 'vibrate_only';
  payoutAlerts: boolean;
  kycAlerts: boolean;
  safetySmsAlerts: boolean;
  shareLiveLocationOnTrip: boolean;
  autoLockOtpOnAttempts: boolean;
  autoNotifyEmergencyOnSos: boolean;
}

export interface ServiceFeedback {
  type: 'info' | 'error' | 'success';
  title: string;
  message: string;
  missingEnvVars?: string[];
}

interface DriverAppContextValue {
  currentScreen: ScreenId;
  canGoBack: boolean;
  navigate: (screen: ScreenId) => void;
  goBack: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  backendConfigured: boolean;
  integrationStatuses: IntegrationStatus[];
  loading: boolean;
  driverProfile: DriverProfile | null;
  vehicle: VehicleRecord | null;
  documents: DriverDocumentRecord[];
  onlineEligibility: OnlineEligibilityResult;
  onlineSince: string | null;
  activeRide: RideRecord | null;
  setActiveRide: (ride: RideRecord | null) => void;
  lastCompletedRide: RideRecord | null;
  setLastCompletedRide: (ride: RideRecord | null) => void;
  incomingOffer: RideRecord | null;
  setIncomingOffer: (ride: RideRecord | null) => void;
  earningsPeriod: EarningsSummary['period'];
  setEarningsPeriod: (p: EarningsSummary['period']) => void;
  earnings: EarningsSummary | null;
  wallet: WalletAccount | null;
  setWallet: (wallet: WalletAccount | null) => void;
  payouts: PayoutRecord[];
  rideHistory: RideRecord[];
  ratings: DriverRatingRecord[];
  notifications: DriverNotification[];
  supportTickets: SupportTicket[];
  setSupportTickets: React.Dispatch<React.SetStateAction<SupportTicket[]>>;
  liveLocation: GeoPoint | null;
  locationError: string | null;
  watchingGps: boolean;
  toggleWatchGps: () => void;
  requestGpsFix: () => Promise<GeoPoint | null>;
  onboardingDraft: OnboardingDraft;
  updateDraft: (patch: Partial<OnboardingDraft>) => void;
  dispatchPreferences: DispatchPreferences;
  updateDispatchPreferences: (patch: Partial<DispatchPreferences>) => void;
  appSettings: AppSettings;
  updateAppSettings: (patch: Partial<AppSettings>) => void;
  t: AppTranslations;
  avatarPreviewUrl: string | null;
  driverAvatarUrl: string | null;
  uploadingAvatar: boolean;
  uploadOrSetProfilePhoto: (file: File) => Promise<void>;
  clearProfilePhoto: () => void;
  stagedDocFiles: Partial<Record<DocumentType, File>>;
  stageDocumentFile: (docType: DocumentType, file: File) => void;
  feedback: ServiceFeedback | null;
  clearFeedback: () => void;
  setFeedback: (fb: ServiceFeedback | null) => void;
  refreshDriverWorkspace: () => Promise<void>;
  togglingDuty: boolean;
  toggleOnlineStatus: () => Promise<void>;
  directoryOpen: boolean;
  setDirectoryOpen: (open: boolean) => void;
}

const DEFAULT_DRAFT: OnboardingDraft = {
  phone: '',
  fullName: '',
  email: '',
  city: '',
  dateOfBirth: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  vehicleCategory: 'cab',
  vehicleMake: '',
  vehicleModel: '',
  vehicleYear: '',
  vehicleColor: '',
  registrationNumber: '',
  permitNumber: '',
  insuranceExpiry: '',
  rcExpiry: '',
  selectedFiles: {},
};

const DEFAULT_PREFERENCES: DispatchPreferences = {
  autoAcceptEligible: false,
  acceptCashRides: true,
  homewardFilterEnabled: false,
  homewardDestination: '',
};

const DEFAULT_APP_SETTINGS: AppSettings = {
  appLanguage: 'en',
  preferredNavigationApp: 'google_maps',
  voiceGuidanceEnabled: true,
  highAccuracyGps: true,
  rideOfferRingtone: 'urgent_bell',
  payoutAlerts: true,
  kycAlerts: true,
  safetySmsAlerts: true,
  shareLiveLocationOnTrip: true,
  autoLockOtpOnAttempts: true,
  autoNotifyEmergencyOnSos: true,
};

const DriverAppContext = createContext<DriverAppContextValue | null>(null);

export const DriverAppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [screenStack, setScreenStack] = useState<ScreenId[]>(['splash']);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = window.localStorage.getItem('shine_cab_driver_theme');
        if (saved === 'dark' || saved === 'light') return saved;
      } catch {
        // Ignore storage read restrictions
      }
    }
    return 'light';
  });
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [togglingDuty, setTogglingDuty] = useState(false);
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [vehicle, setVehicle] = useState<VehicleRecord | null>(null);
  const [documents, setDocuments] = useState<DriverDocumentRecord[]>([]);
  const [onlineSince, setOnlineSince] = useState<string | null>(null);
  const [activeRide, setActiveRide] = useState<RideRecord | null>(null);
  const [lastCompletedRide, setLastCompletedRide] = useState<RideRecord | null>(null);
  const [incomingOffer, setIncomingOffer] = useState<RideRecord | null>(null);
  const [earningsPeriod, setEarningsPeriod] = useState<EarningsSummary['period']>('daily');
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [wallet, setWallet] = useState<WalletAccount | null>(null);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [rideHistory, setRideHistory] = useState<RideRecord[]>([]);
  const [ratings, setRatings] = useState<DriverRatingRecord[]>([]);
  const [notifications, setNotifications] = useState<DriverNotification[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [liveLocation, setLiveLocation] = useState<GeoPoint | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [watchingGps, setWatchingGps] = useState(false);
  const lastLocationSyncRef = useRef<number>(0);
  const [onboardingDraft, setOnboardingDraft] = useState<OnboardingDraft>(DEFAULT_DRAFT);
  const [dispatchPreferences, setDispatchPreferences] = useState<DispatchPreferences>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('shine_cab_driver_prefs');
        if (raw) return { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<DispatchPreferences>) };
      } catch {
        return DEFAULT_PREFERENCES;
      }
    }
    return DEFAULT_PREFERENCES;
  });
  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('shine_cab_driver_app_settings');
        if (raw) return { ...DEFAULT_APP_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
      } catch {
        return DEFAULT_APP_SETTINGS;
      }
    }
    return DEFAULT_APP_SETTINGS;
  });
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        return window.localStorage.getItem('shine_cab_driver_avatar_preview');
      } catch {
        return null;
      }
    }
    return null;
  });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [stagedDocFiles, setStagedDocFiles] = useState<Partial<Record<DocumentType, File>>>({});
  const [feedback, setFeedback] = useState<ServiceFeedback | null>(null);
  const ringtoneRef = useRef(appSettings.rideOfferRingtone);

  useEffect(() => {
    ringtoneRef.current = appSettings.rideOfferRingtone;
  }, [appSettings.rideOfferRingtone]);

  const backendConfigured = isSupabaseConfigured();
  const integrationStatuses = useMemo(() => getAllIntegrationStatuses(), []);
  const t = useMemo(() => getTranslations(appSettings.appLanguage), [appSettings.appLanguage]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('shine_cab_driver_theme', theme);
      } catch {
        // Ignore storage write restrictions
      }
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('shine_cab_driver_prefs', JSON.stringify(dispatchPreferences));
      } catch {
        // Ignore storage write restrictions
      }
    }
  }, [dispatchPreferences]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('shine_cab_driver_app_settings', JSON.stringify(appSettings));
      } catch {
        // Ignore storage write restrictions
      }
    }
  }, [appSettings]);

  useEffect(() => {
    if (!watchingGps) return;
    setLocationError(null);
    const stop = liveLocationAdapter.watchPosition(
      (pt) => setLiveLocation(pt),
      (err) => setLocationError(err),
      appSettings.highAccuracyGps
    );
    return stop;
  }, [watchingGps, appSettings.highAccuracyGps]);

  const currentScreen = screenStack[screenStack.length - 1];
  const canGoBack = screenStack.length > 1;

  const navigate = useCallback((screen: ScreenId) => {
    setScreenStack((prev) => {
      if (prev[prev.length - 1] === screen) return prev;
      return [...prev.slice(-14), screen];
    });
    setDirectoryOpen(false);
  }, []);

  const goBack = useCallback(() => {
    setScreenStack((prev) => {
      if (prev.length > 1) return prev.slice(0, -1);
      if (prev[0] !== 'dashboard') return ['dashboard'];
      return prev;
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const updateDraft = useCallback((patch: Partial<OnboardingDraft>) => {
    setOnboardingDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateDispatchPreferences = useCallback((patch: Partial<DispatchPreferences>) => {
    setDispatchPreferences((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateAppSettings = useCallback((patch: Partial<AppSettings>) => {
    setAppSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const stageDocumentFile = useCallback((docType: DocumentType, file: File) => {
    setStagedDocFiles((prev) => ({ ...prev, [docType]: file }));
    setOnboardingDraft((prev) => ({
      ...prev,
      selectedFiles: { ...prev.selectedFiles, [docType]: file.name },
    }));
  }, []);

  const uploadOrSetProfilePhoto = useCallback(
    async (file: File) => {
      const reader = new FileReader();
      const dataUrl = await new Promise<string | null>((resolve) => {
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
      if (dataUrl) {
        setAvatarPreviewUrl(dataUrl);
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem('shine_cab_driver_avatar_preview', dataUrl);
          } catch {
            // Ignore localStorage quota errors for large images; keep in-memory preview
          }
        }
      }

      if (!backendConfigured || !driverProfile) {
        setFeedback({
          type: 'info',
          title: 'Photo Preview Updated Locally',
          message:
            'Your real photo is displayed in the header profile icon for this session. Sign in with Supabase connected to save it permanently to cloud storage.',
          missingEnvVars: backendConfigured
            ? undefined
            : ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
        });
        return;
      }

      setUploadingAvatar(true);
      const res = await driverBackendService.driver.uploadAvatar(driverProfile.driver_id, file);
      setUploadingAvatar(false);
      if (!res.ok) {
        setFeedback({
          type: 'error',
          title: 'Cloud Avatar Upload Failed',
          message: res.error?.message || 'Could not upload profile photo to Supabase Storage.',
        });
        return;
      }
      if (res.data) {
        setDriverProfile(res.data);
      }
      setFeedback({
        type: 'success',
        title: 'Driver Photo Updated',
        message: 'Your real profile photo is now synced across your driver account.',
      });
    },
    [backendConfigured, driverProfile]
  );

  const driverAvatarUrl = driverProfile?.avatar_url || avatarPreviewUrl;

  const clearProfilePhoto = useCallback(() => {
    setAvatarPreviewUrl(null);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem('shine_cab_driver_avatar_preview');
      } catch {
        // Ignore storage errors
      }
    }
    setFeedback({
      type: 'info',
      title: 'Local Photo Preview Cleared',
      message: 'Capture or upload a new real photo whenever ready.',
    });
  }, []);

  const clearFeedback = useCallback(() => setFeedback(null), []);

  const toggleWatchGps = useCallback(() => {
    setWatchingGps((prev) => !prev);
  }, []);

  const requestGpsFix = useCallback(async (): Promise<GeoPoint | null> => {
    setLocationError(null);
    const result = await liveLocationAdapter.getCurrentPosition(appSettings.highAccuracyGps);
    if (result.ok && result.data) {
      setLiveLocation(result.data);
      return result.data;
    }
    setLocationError(result.error?.message || 'Unable to acquire device GPS fix.');
    return null;
  }, [appSettings.highAccuracyGps]);

  const clearSessionData = useCallback(() => {
    setDriverProfile(null);
    setVehicle(null);
    setDocuments([]);
    setActiveRide(null);
    setLastCompletedRide(null);
    setIncomingOffer(null);
    setEarnings(null);
    setWallet(null);
    setPayouts([]);
    setRideHistory([]);
    setRatings([]);
    setNotifications([]);
    setSupportTickets([]);
    setOnlineSince(null);
  }, []);

  const refreshDriverWorkspace = useCallback(async () => {
    if (!backendConfigured) {
      clearSessionData();
      return;
    }

    setLoading(true);
    try {
      const profileRes = await driverBackendService.driver.getProfile();
      if (!profileRes.ok) {
        clearSessionData();
        if (profileRes.error) {
          setFeedback({
            type: 'info',
            title: 'Session Required',
            message: profileRes.error.message,
            missingEnvVars: profileRes.error.missingEnvVars,
          });
        }
        return;
      }

      const profile = profileRes.data ?? null;
      if (!profile) {
        clearSessionData();
        return;
      }
      setDriverProfile(profile);
      setOnlineSince((prev) => (profile.is_online ? prev || new Date().toISOString() : null));

      const [
        vehRes,
        docsRes,
        activeRideRes,
        earnRes,
        walletRes,
        payoutRes,
        historyRes,
        ratingRes,
        notifRes,
        ticketRes,
      ] = await Promise.all([
        driverBackendService.vehicle.getActiveVehicle(profile.driver_id),
        driverBackendService.kyc.listDocuments(profile.driver_id),
        driverBackendService.rides.getActiveRide(profile.driver_id),
        driverBackendService.finance.getEarnings(profile.driver_id, earningsPeriod),
        driverBackendService.finance.getWallet(profile.driver_id),
        driverBackendService.finance.getPayoutHistory(profile.driver_id),
        driverBackendService.rides.getRideHistory(profile.driver_id),
        driverBackendService.account.getRatings(profile.driver_id),
        driverBackendService.account.getNotifications(profile.driver_id),
        driverBackendService.account.getSupportTickets(profile.driver_id),
      ]);

      const activeVehicle = vehRes.ok ? vehRes.data ?? null : null;
      if (vehRes.ok) setVehicle(activeVehicle);
      if (docsRes.ok && docsRes.data) setDocuments(docsRes.data);
      if (activeRideRes.ok) setActiveRide(activeRideRes.data ?? null);
      if (earnRes.ok && earnRes.data) setEarnings(earnRes.data);
      if (walletRes.ok) setWallet(walletRes.data ?? null);
      if (payoutRes.ok && payoutRes.data) setPayouts(payoutRes.data);
      if (historyRes.ok && historyRes.data) setRideHistory(historyRes.data);
      if (ratingRes.ok && ratingRes.data) setRatings(ratingRes.data);
      if (notifRes.ok && notifRes.data) setNotifications(notifRes.data);
      if (ticketRes.ok && ticketRes.data) setSupportTickets(ticketRes.data);

      // Hydrate empty draft fields from verified backend records so edit forms start pre-filled
      setOnboardingDraft((prev) => ({
        ...prev,
        phone: prev.phone || profile.phone.replace(/^\+91/, ''),
        fullName: prev.fullName || profile.full_name || '',
        email: prev.email || profile.email || '',
        city: prev.city || profile.city || '',
        dateOfBirth: prev.dateOfBirth || profile.date_of_birth || '',
        emergencyContactName: prev.emergencyContactName || profile.emergency_contact_name || '',
        emergencyContactPhone: prev.emergencyContactPhone || profile.emergency_contact_phone || '',
        vehicleCategory: activeVehicle?.category ?? prev.vehicleCategory,
        vehicleMake: prev.vehicleMake || activeVehicle?.make || '',
        vehicleModel: prev.vehicleModel || activeVehicle?.model || '',
        vehicleYear: prev.vehicleYear || (activeVehicle?.year ? String(activeVehicle.year) : ''),
        vehicleColor: prev.vehicleColor || activeVehicle?.color || '',
        registrationNumber: prev.registrationNumber || activeVehicle?.registration_number || '',
        permitNumber: prev.permitNumber || activeVehicle?.permit_number || '',
        insuranceExpiry: prev.insuranceExpiry || activeVehicle?.insurance_expiry || '',
        rcExpiry: prev.rcExpiry || activeVehicle?.rc_expiry || '',
      }));
    } finally {
      setLoading(false);
    }
  }, [backendConfigured, clearSessionData, earningsPeriod]);

  useEffect(() => {
    if (backendConfigured) {
      void refreshDriverWorkspace();
    }
  }, [backendConfigured, refreshDriverWorkspace]);

  // Throttled live GPS coordinate sync to driver_locations while online/on-trip
  useEffect(() => {
    if (!backendConfigured || !driverProfile?.is_online || !liveLocation) return;
    if (activeRide && !appSettings.shareLiveLocationOnTrip) return;
    const now = Date.now();
    if (now - lastLocationSyncRef.current < 10000) return;
    lastLocationSyncRef.current = now;
    void driverBackendService.driver.updateLocation(driverProfile.driver_id, liveLocation);
  }, [backendConfigured, driverProfile?.driver_id, driverProfile?.is_online, liveLocation, activeRide, appSettings.shareLiveLocationOnTrip]);

  useEffect(() => {
    if (!backendConfigured || !driverProfile?.is_online || !vehicle?.category) return;
    const unsubscribe = driverBackendService.rides.subscribeOffers(
      driverProfile.driver_id,
      vehicle.category,
      (ride) => {
        playRideOfferAlert(ringtoneRef.current);
        setIncomingOffer(ride);
        navigate('incoming_ride');
      }
    );
    return unsubscribe;
  }, [backendConfigured, driverProfile?.driver_id, driverProfile?.is_online, vehicle?.category, navigate]);

  // Auto-expire incoming ride offer if offer_expires_at has elapsed
  useEffect(() => {
    if (!incomingOffer?.offer_expires_at) return;
    const expiresMs = new Date(incomingOffer.offer_expires_at).getTime() - Date.now();
    if (Number.isNaN(expiresMs)) return;
    if (expiresMs <= 0) {
      setIncomingOffer(null);
      return;
    }
    const timer = window.setTimeout(() => {
      setIncomingOffer((cur) => (cur?.ride_id === incomingOffer.ride_id ? null : cur));
    }, expiresMs);
    return () => window.clearTimeout(timer);
  }, [incomingOffer]);

  useEffect(() => {
    if (!backendConfigured || !driverProfile?.driver_id) return;
    const unsubscribe = driverBackendService.account.subscribeRatings(
      driverProfile.driver_id,
      (newRating) => {
        setRatings((prev) => {
          const updated = [
            newRating,
            ...prev.filter((r) => r.rating_id !== newRating.rating_id),
          ];
          const avg =
            updated.length > 0
              ? Number(
                  (
                    updated.reduce((sum, item) => sum + item.stars, 0) / updated.length
                  ).toFixed(2)
                )
              : null;
          setDriverProfile((cur) => (cur ? { ...cur, rating_average: avg } : cur));
          return updated;
        });
        setFeedback({
          type: 'info',
          title: `New ${newRating.stars}★ Customer Rating Received`,
          message: newRating.comment
            ? `"${newRating.comment}"`
            : 'Submitted via SHINE CAB Customer App.',
        });
      }
    );
    return unsubscribe;
  }, [backendConfigured, driverProfile?.driver_id]);

  useEffect(() => {
    if (!backendConfigured || !driverProfile?.driver_id) return;
    const unsubscribe = driverBackendService.account.subscribeNotifications(
      driverProfile.driver_id,
      (notif) => {
        setNotifications((prev) => [
          notif,
          ...prev.filter((n) => n.notification_id !== notif.notification_id),
        ]);
      }
    );
    return unsubscribe;
  }, [backendConfigured, driverProfile?.driver_id]);

  const onlineEligibility = useMemo(
    () => canDriverGoOnline(driverProfile, vehicle),
    [driverProfile, vehicle]
  );

  const toggleOnlineStatus = useCallback(async () => {
    if (togglingDuty) return;
    if (!backendConfigured) {
      setFeedback({
        type: 'error',
        title: 'Backend Configuration Required',
        message:
          'Cannot toggle Online duty status without a connected SHINE CAPTAIN Supabase backend verifying admin approval.',
        missingEnvVars: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
      });
      return;
    }

    if (!driverProfile) {
      setFeedback({
        type: 'error',
        title: 'Authentication Required',
        message: 'Sign in and complete driver verification before going online.',
      });
      return;
    }

    const nextOnline = !driverProfile.is_online;
    if (nextOnline && !onlineEligibility.allowed) {
      setFeedback({
        type: 'error',
        title: 'Approval Gate Locked',
        message: onlineEligibility.blockers.join(' '),
      });
      return;
    }

    setTogglingDuty(true);
    try {
      const res = await driverBackendService.driver.setOnlineStatus(
        driverProfile.driver_id,
        nextOnline,
        liveLocation ?? undefined
      );
      if (!res.ok) {
        setFeedback({
          type: 'error',
          title: 'Duty Status Update Blocked',
          message: res.error?.message || 'Could not update duty status.',
        });
        return;
      }

      if (res.data) {
        setDriverProfile(res.data);
        setOnlineSince(res.data.is_online ? new Date().toISOString() : null);
        setFeedback({
          type: 'success',
          title: res.data.is_online ? 'You are Online' : 'You are Offline',
          message: res.data.is_online
            ? 'Listening for verified ride offers in your vehicle category.'
            : 'Ride dispatch paused.',
        });
      }
    } finally {
      setTogglingDuty(false);
    }
  }, [togglingDuty, backendConfigured, driverProfile, onlineEligibility, liveLocation]);

  const value: DriverAppContextValue = {
    currentScreen,
    canGoBack,
    navigate,
    goBack,
    theme,
    toggleTheme,
    backendConfigured,
    integrationStatuses,
    loading,
    driverProfile,
    vehicle,
    documents,
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
    setWallet,
    payouts,
    rideHistory,
    ratings,
    notifications,
    supportTickets,
    setSupportTickets,
    liveLocation,
    locationError,
    watchingGps,
    toggleWatchGps,
    requestGpsFix,
    onboardingDraft,
    updateDraft,
    dispatchPreferences,
    updateDispatchPreferences,
    appSettings,
    updateAppSettings,
    t,
    avatarPreviewUrl,
    driverAvatarUrl,
    uploadingAvatar,
    uploadOrSetProfilePhoto,
    clearProfilePhoto,
    stagedDocFiles,
    stageDocumentFile,
    feedback,
    clearFeedback,
    setFeedback,
    refreshDriverWorkspace,
    togglingDuty,
    toggleOnlineStatus,
    directoryOpen,
    setDirectoryOpen,
  };

  return <DriverAppContext.Provider value={value}>{children}</DriverAppContext.Provider>;
};

export function useDriverApp(): DriverAppContextValue {
  const ctx = useContext(DriverAppContext);
  if (!ctx) throw new Error('useDriverApp must be used inside DriverAppProvider');
  return ctx;
}
