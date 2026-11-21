import type {
  MapsProviderAdapter,
  PaymentGatewayAdapter,
  PayoutProviderAdapter,
  PushNotificationAdapter,
  RoutePreview,
  SmsOtpAdapter,
} from '../../contracts/integrations';
import type { GeoPoint, ServiceResult } from '../../contracts/types';
import { ENV_CONFIG, getMissingSupabaseVars, isSupabaseConfigured } from '../config';
import { getSupabaseClient } from '../supabaseClient';

export const mapsProviderAdapter: MapsProviderAdapter = {
  isConfigured() {
    return Boolean(ENV_CONFIG.googleMapsApiKey);
  },
  getStatus() {
    const configured = this.isConfigured();
    return {
      id: 'google_maps',
      label: 'Google Maps & Routing',
      configured,
      mode: configured ? 'live' : 'unconfigured',
      missingEnvVars: configured ? [] : ['VITE_GOOGLE_MAPS_API_KEY'],
      notes: configured
        ? 'Google Maps routing active.'
        : 'Configure VITE_GOOGLE_MAPS_API_KEY for embedded route polylines and live turn-by-turn ETA.',
    };
  },
  async calculateRoute(origin: GeoPoint, destination: GeoPoint): Promise<ServiceResult<RoutePreview>> {
    if (!this.isConfigured()) {
      return {
        ok: false,
        configured: false,
        error: {
          code: 'INTEGRATION_NOT_CONFIGURED',
          message: 'Google Maps routing is not configured. Provide VITE_GOOGLE_MAPS_API_KEY.',
          missingEnvVars: ['VITE_GOOGLE_MAPS_API_KEY'],
        },
      };
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        ok: false,
        configured: false,
        error: {
          code: 'BACKEND_NOT_CONFIGURED',
          message: 'Route calculation proxy requires Supabase Edge Function connection.',
          missingEnvVars: getMissingSupabaseVars(),
        },
      };
    }

    const { data, error } = await supabase.functions.invoke('compute-route', {
      body: { origin, destination },
    });
    if (error) {
      return {
        ok: false,
        configured: true,
        error: { code: 'NETWORK_ERROR', message: error.message },
      };
    }
    return { ok: true, configured: true, data: data as RoutePreview };
  },
  openExternalTurnByTurn(destinationLat: number, destinationLng: number, label?: string) {
    const query = encodeURIComponent(label ? `${destinationLat},${destinationLng} (${label})` : `${destinationLat},${destinationLng}`);
    return `https://www.google.com/maps/dir/?api=1&destination=${query}&travelmode=driving`;
  },
};

export const pushNotificationAdapter: PushNotificationAdapter = {
  isConfigured() {
    return Boolean(ENV_CONFIG.firebaseApiKey && ENV_CONFIG.firebaseProjectId && ENV_CONFIG.firebaseVapidKey);
  },
  getStatus() {
    const missing = [
      !ENV_CONFIG.firebaseApiKey && 'VITE_FIREBASE_API_KEY',
      !ENV_CONFIG.firebaseProjectId && 'VITE_FIREBASE_PROJECT_ID',
      !ENV_CONFIG.firebaseVapidKey && 'VITE_FIREBASE_VAPID_KEY',
    ].filter(Boolean) as string[];
    return {
      id: 'firebase_fcm',
      label: 'Firebase Cloud Messaging',
      configured: missing.length === 0,
      mode: missing.length === 0 ? 'live' : 'unconfigured',
      missingEnvVars: missing,
      notes:
        missing.length === 0
          ? 'FCM push tokens ready for background ride alerts.'
          : 'Configure Firebase Web Push credentials to enable background ride request alerts.',
    };
  },
  async requestDeviceToken(): Promise<ServiceResult<{ token: string }>> {
    const status = this.getStatus();
    if (!status.configured) {
      return {
        ok: false,
        configured: false,
        error: {
          code: 'INTEGRATION_NOT_CONFIGURED',
          message: 'Firebase Cloud Messaging credentials are missing.',
          missingEnvVars: status.missingEnvVars,
        },
      };
    }
    return {
      ok: false,
      configured: true,
      error: {
        code: 'INTEGRATION_NOT_CONFIGURED',
        message: 'Service worker registration for Firebase Messaging must be initialized on HTTPS production host.',
      },
    };
  },
};

export const razorpayAdapter: PaymentGatewayAdapter = {
  isConfigured() {
    return Boolean(ENV_CONFIG.razorpayKeyId) && isSupabaseConfigured();
  },
  getStatus() {
    const missing = [
      !ENV_CONFIG.razorpayKeyId && 'VITE_RAZORPAY_KEY_ID',
      ...getMissingSupabaseVars(),
    ].filter(Boolean) as string[];
    return {
      id: 'razorpay',
      label: 'Razorpay Checkout',
      configured: missing.length === 0,
      mode: missing.length === 0 ? 'live' : 'unconfigured',
      missingEnvVars: missing,
      notes: 'Collects driver commission dues securely via server-verified Razorpay orders.',
    };
  },
  async createDuesSettlementOrder(amountInr: number, driverId: string): Promise<ServiceResult<{ orderId: string }>> {
    const status = this.getStatus();
    if (!status.configured) {
      return {
        ok: false,
        configured: false,
        error: {
          code: 'INTEGRATION_NOT_CONFIGURED',
          message: 'Razorpay dues settlement requires VITE_RAZORPAY_KEY_ID and Supabase backend.',
          missingEnvVars: status.missingEnvVars,
        },
      };
    }
    const supabase = getSupabaseClient()!;
    const { data, error } = await supabase.functions.invoke('create-dues-order', {
      body: { amount_inr: amountInr, driver_id: driverId },
    });
    if (error || !data?.order_id) {
      return {
        ok: false,
        configured: true,
        error: {
          code: 'NETWORK_ERROR',
          message: error?.message || 'Razorpay order response did not include an order ID.',
        },
      };
    }
    return { ok: true, configured: true, data: { orderId: data.order_id } };
  },
};

export const smsOtpAdapter: SmsOtpAdapter = {
  isConfigured: () => isSupabaseConfigured(),
  getStatus() {
    const missing = getMissingSupabaseVars();
    return {
      id: 'sms_otp',
      label: 'SMS / Mobile OTP',
      configured: missing.length === 0,
      mode: missing.length === 0 ? 'live' : 'unconfigured',
      missingEnvVars: missing,
      notes: 'Mobile OTP authentication uses Supabase Auth Phone provider.',
    };
  },
  async sendLoginOtp(phone: string) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        ok: false,
        configured: false,
        error: {
          code: 'BACKEND_NOT_CONFIGURED',
          message: 'Mobile OTP requires Supabase Auth backend configuration.',
          missingEnvVars: getMissingSupabaseVars(),
        },
      };
    }
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) {
      return { ok: false, configured: true, error: { code: 'NETWORK_ERROR', message: error.message } };
    }
    return { ok: true, configured: true, data: { requestId: `otp_${Date.now()}` } };
  },
};

export const payoutProviderAdapter: PayoutProviderAdapter = {
  isConfigured: () => isSupabaseConfigured(),
  getStatus() {
    const missing = getMissingSupabaseVars();
    return {
      id: 'payouts',
      label: 'Bank / UPI Payouts',
      configured: missing.length === 0,
      mode: missing.length === 0 ? 'live' : 'unconfigured',
      missingEnvVars: missing,
      notes: 'Payouts are processed server-side via Supabase Edge Functions; secrets never touch the client.',
    };
  },
  async initiateBankPayout(driverId: string, amountInr: number, channel: 'bank' | 'upi' = 'bank') {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        ok: false,
        configured: false,
        error: {
          code: 'BACKEND_NOT_CONFIGURED',
          message: 'Payout initiation requires Supabase backend and Payout Edge Function.',
          missingEnvVars: getMissingSupabaseVars(),
        },
      };
    }
    const { data, error } = await supabase.functions.invoke('request-driver-payout', {
      body: { driver_id: driverId, amount_inr: amountInr, channel },
    });
    if (error || !data?.payout_id) {
      return {
        ok: false,
        configured: true,
        error: {
          code: 'NETWORK_ERROR',
          message: error?.message || 'Payout response did not return a valid payout ID.',
        },
      };
    }
    return { ok: true, configured: true, data: { payoutReference: data.payout_id } };
  },
};
