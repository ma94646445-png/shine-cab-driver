import type { IntegrationStatus } from '../contracts/integrations';
import type { ServiceResult } from '../contracts/types';

function readEnv(key: string): string {
  const metaEnv =
    typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Record<string, string | undefined> }).env
      ? (import.meta as unknown as { env: Record<string, string | undefined> }).env
      : undefined;
  if (metaEnv && typeof metaEnv[key] === 'string') {
    return metaEnv[key]!.trim();
  }
  if (typeof process !== 'undefined' && process.env && typeof process.env[key] === 'string') {
    return process.env[key]!.trim();
  }
  return '';
}

export const ENV_CONFIG = {
  supabaseUrl: readEnv('VITE_SUPABASE_URL'),
  supabaseAnonKey: readEnv('VITE_SUPABASE_ANON_KEY'),
  googleMapsApiKey: readEnv('VITE_GOOGLE_MAPS_API_KEY'),
  firebaseApiKey: readEnv('VITE_FIREBASE_API_KEY'),
  firebaseProjectId: readEnv('VITE_FIREBASE_PROJECT_ID'),
  firebaseSenderId: readEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  firebaseAppId: readEnv('VITE_FIREBASE_APP_ID'),
  firebaseVapidKey: readEnv('VITE_FIREBASE_VAPID_KEY'),
  razorpayKeyId: readEnv('VITE_RAZORPAY_KEY_ID'),
};

export function isSupabaseConfigured(): boolean {
  return Boolean(ENV_CONFIG.supabaseUrl && ENV_CONFIG.supabaseAnonKey);
}

export function getMissingSupabaseVars(): string[] {
  const missing: string[] = [];
  if (!ENV_CONFIG.supabaseUrl) missing.push('VITE_SUPABASE_URL');
  if (!ENV_CONFIG.supabaseAnonKey) missing.push('VITE_SUPABASE_ANON_KEY');
  return missing;
}

export function getAllIntegrationStatuses(): IntegrationStatus[] {
  const supaMissing = getMissingSupabaseVars();
  const mapsConfigured = Boolean(ENV_CONFIG.googleMapsApiKey);
  const fcmMissing = [
    !ENV_CONFIG.firebaseApiKey && 'VITE_FIREBASE_API_KEY',
    !ENV_CONFIG.firebaseProjectId && 'VITE_FIREBASE_PROJECT_ID',
    !ENV_CONFIG.firebaseVapidKey && 'VITE_FIREBASE_VAPID_KEY',
  ].filter(Boolean) as string[];
  const razorpayConfigured = Boolean(ENV_CONFIG.razorpayKeyId);
  const hasGeoApi = typeof navigator !== 'undefined' && 'geolocation' in navigator;

  return [
    {
      id: 'supabase',
      label: 'Shared Supabase Backend',
      configured: supaMissing.length === 0,
      mode: supaMissing.length === 0 ? 'live' : 'unconfigured',
      missingEnvVars: supaMissing,
      notes:
        supaMissing.length === 0
          ? 'Connected to shared SHINE CAB PostgreSQL, Auth, Realtime, and Edge Functions.'
          : 'Required for driver authentication, KYC approval status, atomic ride matching, wallet, and payouts.',
    },
    {
      id: 'google_maps',
      label: 'Google Maps & Routing',
      configured: mapsConfigured,
      mode: mapsConfigured ? 'live' : 'unconfigured',
      missingEnvVars: mapsConfigured ? [] : ['VITE_GOOGLE_MAPS_API_KEY'],
      notes: mapsConfigured
        ? 'Google Maps Directions and live map tiles enabled.'
        : 'Map tiles and turn-by-turn ETA require a Google Maps API key. External navigation link fallback remains available.',
    },
    {
      id: 'live_gps',
      label: 'Device GPS Telemetry',
      configured: hasGeoApi,
      mode: hasGeoApi ? 'browser_native' : 'unconfigured',
      missingEnvVars: [],
      notes: hasGeoApi
        ? 'Uses hardware/browser Geolocation API when driver grants permission. No coordinates are fabricated.'
        : 'Geolocation API is unavailable in this environment.',
    },
    {
      id: 'sms_otp',
      label: 'SMS / Mobile OTP Gateway',
      configured: supaMissing.length === 0,
      mode: supaMissing.length === 0 ? 'live' : 'unconfigured',
      missingEnvVars: supaMissing,
      notes: 'Dispatched via Supabase Auth Phone provider (Twilio / MSG91 configured on backend).',
    },
    {
      id: 'firebase_fcm',
      label: 'Firebase Cloud Messaging (Push)',
      configured: fcmMissing.length === 0,
      mode: fcmMissing.length === 0 ? 'live' : 'unconfigured',
      missingEnvVars: fcmMissing,
      notes: 'Required for background incoming ride ringtones and KYC approval push alerts.',
    },
    {
      id: 'razorpay',
      label: 'Razorpay Dues Collection',
      configured: razorpayConfigured,
      mode: razorpayConfigured ? 'live' : 'unconfigured',
      missingEnvVars: razorpayConfigured ? [] : ['VITE_RAZORPAY_KEY_ID'],
      notes: 'Used to settle cash-ride platform commission dues via UPI/Card.',
    },
    {
      id: 'payouts',
      label: 'Bank / UPI Payouts (Edge Function)',
      configured: supaMissing.length === 0,
      mode: supaMissing.length === 0 ? 'live' : 'unconfigured',
      missingEnvVars: supaMissing,
      notes: 'Executed strictly server-side via Supabase Edge Functions and RazorpayX / Cashfree Payouts.',
    },
  ];
}

export function backendNotConfigured<T>(actionDescription: string): ServiceResult<T> {
  const missing = getMissingSupabaseVars();
  return {
    ok: false,
    configured: false,
    error: {
      code: 'BACKEND_NOT_CONFIGURED',
      message: `${actionDescription} requires an active SHINE CAB Supabase backend connection.`,
      missingEnvVars: missing,
    },
  };
}
