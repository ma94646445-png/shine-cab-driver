import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut as firebaseSignOut,
  type ConfirmationResult,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type {
  AcceptRideResponse,
  CompleteRidePayload,
  DriverBackendContract,
  DriverRegistrationPayload,
  PayoutMethodPayload,
  SendRideMessagePayload,
  VehicleUpsertPayload,
  VerifyPickupOtpPayload,
} from '../contracts/api';
import type {
  DriverDocumentRecord,
  DriverNotification,
  DriverProfile,
  DriverRatingRecord,
  EarningsSummary,
  GeoPoint,
  PayoutRecord,
  RideMessageRecord,
  RideRecord,
  ServiceResult,
  SosAlertRecord,
  SupportTicket,
  VehicleCategory,
  VehicleRecord,
  WalletAccount,
} from '../contracts/types';
import { canDriverGoOnline, validateIndianPhone } from '../contracts/validators';
import { backendNotConfigured } from './config';
import {
  getFirebaseAuth,
  getFirebaseDb,
  googleAuthProvider,
  handleFirestoreError,
  OperationType,
  tsToIso,
} from './firebaseClient';
import { compressFileToFirestoreDataUrl } from './imageCompressor';

let pendingConfirmation: ConfirmationResult | null = null;
let cachedRecaptcha: RecaptchaVerifier | null = null;

function isPermissionError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: string }).code || '';
  const msg = (err as { message?: string }).message || '';
  return (
    code === 'permission-denied' ||
    code.includes('permission') ||
    msg.toLowerCase().includes('missing or insufficient permissions')
  );
}

function makeDocId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function mapDriverDoc(raw: Record<string, unknown>, id: string): DriverProfile {
  return {
    driver_id: String(raw.driver_id || id),
    user_id: String(raw.user_id || id),
    full_name: String(raw.full_name || 'Captain Partner'),
    phone: String(raw.phone || ''),
    email: raw.email ? String(raw.email) : null,
    city: String(raw.city || ''),
    date_of_birth: raw.date_of_birth ? String(raw.date_of_birth) : null,
    emergency_contact_name: raw.emergency_contact_name ? String(raw.emergency_contact_name) : null,
    emergency_contact_phone: raw.emergency_contact_phone ? String(raw.emergency_contact_phone) : null,
    avatar_url: raw.avatar_url ? String(raw.avatar_url) : null,
    profile_completed: Boolean(raw.profile_completed),
    documents_uploaded: Boolean(raw.documents_uploaded),
    vehicle_verified: Boolean(raw.vehicle_verified),
    kyc_status: (raw.kyc_status as DriverProfile['kyc_status']) || 'not_submitted',
    kyc_rejection_reason: raw.kyc_rejection_reason ? String(raw.kyc_rejection_reason) : null,
    admin_approved: Boolean(raw.admin_approved),
    account_status: (raw.account_status as DriverProfile['account_status']) || 'pending_setup',
    partner_rider_id: raw.partner_rider_id ? String(raw.partner_rider_id) : null,
    is_online: Boolean(raw.is_online),
    active_vehicle_id: raw.active_vehicle_id ? String(raw.active_vehicle_id) : null,
    rating_average: typeof raw.rating_average === 'number' ? raw.rating_average : null,
    total_rides: typeof raw.total_rides === 'number' ? raw.total_rides : 0,
    created_at: tsToIso(raw.created_at),
    updated_at: tsToIso(raw.updated_at),
  };
}

function mapVehicleDoc(raw: Record<string, unknown>, id: string): VehicleRecord {
  return {
    vehicle_id: String(raw.vehicle_id || id),
    driver_id: String(raw.driver_id || ''),
    category: (raw.category as VehicleCategory) || 'cab',
    make: String(raw.make || ''),
    model: String(raw.model || ''),
    year: typeof raw.year === 'number' ? raw.year : new Date().getFullYear(),
    color: String(raw.color || 'White'),
    registration_number: String(raw.registration_number || ''),
    permit_number: raw.permit_number ? String(raw.permit_number) : null,
    insurance_expiry: raw.insurance_expiry ? String(raw.insurance_expiry) : null,
    rc_expiry: raw.rc_expiry ? String(raw.rc_expiry) : null,
    verification_status: (raw.verification_status as VehicleRecord['verification_status']) || 'pending',
    is_active: Boolean(raw.is_active ?? true),
  };
}

function mapDriverDocument(raw: Record<string, unknown>, id: string): DriverDocumentRecord {
  return {
    document_id: String(raw.document_id || id),
    driver_id: String(raw.driver_id || ''),
    document_type: raw.document_type as DriverDocumentRecord['document_type'],
    storage_path: String(raw.storage_path || ''),
    file_url: raw.file_url ? String(raw.file_url) : null,
    file_name: String(raw.file_name || ''),
    status: (raw.status as DriverDocumentRecord['status']) || 'pending_review',
    rejection_reason: raw.rejection_reason ? String(raw.rejection_reason) : null,
    uploaded_at: raw.uploaded_at ? tsToIso(raw.uploaded_at) : null,
  };
}

function mapRideDoc(raw: Record<string, unknown>, id: string): RideRecord {
  return {
    ride_id: String(raw.ride_id || id),
    customer_id: String(raw.customer_id || ''),
    driver_id: raw.driver_id ? String(raw.driver_id) : null,
    vehicle_id: raw.vehicle_id ? String(raw.vehicle_id) : null,
    vehicle_category: (raw.vehicle_category as VehicleCategory) || 'cab',
    status: (raw.status as RideRecord['status']) || 'searching',
    pickup_address: String(raw.pickup_address || ''),
    pickup_lat: Number(raw.pickup_lat ?? 0),
    pickup_lng: Number(raw.pickup_lng ?? 0),
    dropoff_address: String(raw.dropoff_address || ''),
    dropoff_lat: Number(raw.dropoff_lat ?? 0),
    dropoff_lng: Number(raw.dropoff_lng ?? 0),
    estimated_distance_km: Number(raw.estimated_distance_km ?? 0),
    estimated_duration_min: Number(raw.estimated_duration_min ?? 0),
    estimated_fare_inr: Number(raw.estimated_fare_inr ?? 0),
    final_fare_inr: typeof raw.final_fare_inr === 'number' ? raw.final_fare_inr : null,
    commission_inr: typeof raw.commission_inr === 'number' ? raw.commission_inr : null,
    driver_net_inr: typeof raw.driver_net_inr === 'number' ? raw.driver_net_inr : null,
    payment_mode: (raw.payment_mode as RideRecord['payment_mode']) || 'cash',
    payment_status: (raw.payment_status as RideRecord['payment_status']) || 'pending',
    pickup_otp: raw.pickup_otp ? String(raw.pickup_otp) : null,
    pickup_otp_verified: Boolean(raw.pickup_otp_verified),
    offer_expires_at: raw.offer_expires_at ? String(raw.offer_expires_at) : null,
    customer: (raw.customer as RideRecord['customer']) || undefined,
    created_at: tsToIso(raw.created_at),
    started_at: raw.started_at ? tsToIso(raw.started_at) : null,
    completed_at: raw.completed_at ? tsToIso(raw.completed_at) : null,
  };
}

function mapRideMessageDoc(raw: Record<string, unknown>, id: string): RideMessageRecord {
  return {
    message_id: String(raw.message_id || id),
    ride_id: String(raw.ride_id || ''),
    driver_id: raw.driver_id ? String(raw.driver_id) : null,
    customer_id: raw.customer_id ? String(raw.customer_id) : null,
    sender_id: String(raw.sender_id || ''),
    sender_role: (raw.sender_role as RideMessageRecord['sender_role']) || 'driver',
    sender_name: String(raw.sender_name || 'Captain'),
    text: String(raw.text || ''),
    created_at: tsToIso(raw.created_at),
  };
}

function mapWalletDoc(raw: Record<string, unknown>, id: string): WalletAccount {
  return {
    wallet_id: String(raw.wallet_id || id),
    driver_id: String(raw.driver_id || id),
    available_balance_inr: Number(raw.available_balance_inr ?? 0),
    pending_settlement_inr: Number(raw.pending_settlement_inr ?? 0),
    cash_commission_due_inr: Number(raw.cash_commission_due_inr ?? 0),
    bank_account_verified: Boolean(raw.bank_account_verified),
    bank_account_masked: raw.bank_account_masked ? String(raw.bank_account_masked) : null,
    account_holder_name: raw.account_holder_name ? String(raw.account_holder_name) : null,
    upi_id: raw.upi_id ? String(raw.upi_id) : null,
    updated_at: tsToIso(raw.updated_at),
  };
}

function mapPayoutDoc(raw: Record<string, unknown>, id: string): PayoutRecord {
  return {
    payout_id: String(raw.payout_id || id),
    driver_id: String(raw.driver_id || ''),
    amount_inr: Number(raw.amount_inr ?? 0),
    status: (raw.status as PayoutRecord['status']) || 'initiated',
    provider_reference: raw.provider_reference ? String(raw.provider_reference) : null,
    destination_label: String(raw.destination_label || 'Registered Bank / UPI'),
    requested_at: tsToIso(raw.requested_at),
    settled_at: raw.settled_at ? tsToIso(raw.settled_at) : null,
  };
}

function mapRatingDoc(raw: Record<string, unknown>, id: string): DriverRatingRecord {
  return {
    rating_id: String(raw.rating_id || id),
    ride_id: String(raw.ride_id || ''),
    customer_id: String(raw.customer_id || ''),
    driver_id: String(raw.driver_id || ''),
    stars: Number(raw.stars ?? 5),
    comment: raw.comment ? String(raw.comment) : null,
    feedback_tags: Array.isArray(raw.feedback_tags)
      ? raw.feedback_tags.map((item) => String(item))
      : null,
    customer_name: raw.customer_name ? String(raw.customer_name) : null,
    pickup_address: raw.pickup_address ? String(raw.pickup_address) : null,
    dropoff_address: raw.dropoff_address ? String(raw.dropoff_address) : null,
    created_at: tsToIso(raw.created_at),
  };
}

function mapNotificationDoc(raw: Record<string, unknown>, id: string): DriverNotification {
  return {
    notification_id: String(raw.notification_id || id),
    driver_id: String(raw.driver_id || ''),
    category: (raw.category as DriverNotification['category']) || 'system',
    title: String(raw.title || ''),
    body: String(raw.body || ''),
    read: Boolean(raw.read),
    created_at: tsToIso(raw.created_at),
  };
}

function mapTicketDoc(raw: Record<string, unknown>, id: string): SupportTicket {
  return {
    ticket_id: String(raw.ticket_id || id),
    driver_id: String(raw.driver_id || ''),
    ride_id: raw.ride_id ? String(raw.ride_id) : null,
    subject: String(raw.subject || ''),
    description: String(raw.description || ''),
    status: (raw.status as SupportTicket['status']) || 'open',
    created_at: tsToIso(raw.created_at),
  };
}

function mapSosDoc(raw: Record<string, unknown>, id: string): SosAlertRecord {
  return {
    alert_id: String(raw.alert_id || id),
    driver_id: String(raw.driver_id || ''),
    ride_id: raw.ride_id ? String(raw.ride_id) : null,
    lat: typeof raw.lat === 'number' ? raw.lat : null,
    lng: typeof raw.lng === 'number' ? raw.lng : null,
    status: (raw.status as SosAlertRecord['status']) || 'triggered',
    created_at: tsToIso(raw.created_at),
  };
}

async function ensureDriverSeedDocs(
  uid: string,
  opts?: { fullName?: string | null; email?: string | null; phone?: string | null; avatarUrl?: string | null }
): Promise<DriverProfile> {
  const db = getFirebaseDb();
  if (!db) {
    throw new Error('Firebase Firestore not initialized');
  }
  const driverRef = doc(db, 'drivers', uid);
  let snap;
  try {
    snap = await getDoc(driverRef);
  } catch (err) {
    if (isPermissionError(err)) handleFirestoreError(err, OperationType.GET, `drivers/${uid}`);
    throw err;
  }

  if (snap.exists()) {
    const existing = mapDriverDoc(snap.data() as Record<string, unknown>, uid);
    // Ensure wallet doc exists as well
    const walletRef = doc(db, 'wallet_accounts', uid);
    const walletSnap = await getDoc(walletRef);
    if (!walletSnap.exists()) {
      await setDoc(walletRef, {
        wallet_id: uid,
        driver_id: uid,
        available_balance_inr: 0,
        pending_settlement_inr: 0,
        cash_commission_due_inr: 0,
        bank_account_verified: false,
        updated_at: serverTimestamp(),
      });
    }
    return existing;
  }

  const initialDriver = {
    driver_id: uid,
    user_id: uid,
    full_name: opts?.fullName?.trim() || 'SHINE Captain',
    phone: opts?.phone?.trim() || '',
    email: opts?.email || null,
    city: '',
    date_of_birth: null,
    emergency_contact_name: null,
    emergency_contact_phone: null,
    avatar_url: opts?.avatarUrl || null,
    profile_completed: false,
    documents_uploaded: false,
    vehicle_verified: false,
    kyc_status: 'not_submitted',
    kyc_rejection_reason: null,
    admin_approved: false,
    account_status: 'pending_setup',
    partner_rider_id: null,
    is_online: false,
    active_vehicle_id: null,
    rating_average: null,
    total_rides: 0,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };

  try {
    await setDoc(driverRef, initialDriver);
    await setDoc(doc(db, 'wallet_accounts', uid), {
      wallet_id: uid,
      driver_id: uid,
      available_balance_inr: 0,
      pending_settlement_inr: 0,
      cash_commission_due_inr: 0,
      bank_account_verified: false,
      updated_at: serverTimestamp(),
    });
  } catch (err) {
    if (isPermissionError(err)) handleFirestoreError(err, OperationType.CREATE, `drivers/${uid}`);
    throw err;
  }

  const fresh = await getDoc(driverRef);
  return mapDriverDoc((fresh.data() as Record<string, unknown>) || {}, uid);
}

export function computeEarningsFromRides(
  rides: RideRecord[],
  period: EarningsSummary['period']
): EarningsSummary {
  const now = Date.now();
  const windowMs =
    period === 'daily'
      ? 24 * 60 * 60 * 1000
      : period === 'weekly'
        ? 7 * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000;

  let gross = 0;
  let commission = 0;
  let net = 0;
  let cash = 0;
  let online = 0;
  let completed = 0;
  let totalMinutes = 0;

  for (const r of rides) {
    if (r.status !== 'completed') continue;
    const completedTime = Date.parse(r.completed_at || r.created_at);
    if (!Number.isNaN(completedTime) && now - completedTime > windowMs) {
      continue;
    }
    const fare = r.final_fare_inr ?? r.estimated_fare_inr ?? 0;
    const comm = r.commission_inr ?? Math.round(fare * 0.15 * 100) / 100;
    const drvNet = r.driver_net_inr ?? Math.round((fare - comm) * 100) / 100;

    gross += fare;
    commission += comm;
    net += drvNet;
    if (r.payment_mode === 'cash') cash += fare;
    else online += fare;
    completed += 1;
    totalMinutes += r.estimated_duration_min || 15;
  }

  return {
    period,
    gross_fare_inr: Number(gross.toFixed(2)),
    platform_commission_inr: Number(commission.toFixed(2)),
    net_earnings_inr: Number(net.toFixed(2)),
    cash_collected_inr: Number(cash.toFixed(2)),
    online_payments_inr: Number(online.toFixed(2)),
    completed_rides: completed,
    online_hours: Number((totalMinutes / 60).toFixed(1)),
    currency: 'INR',
  };
}

export const driverBackendService: DriverBackendContract = {
  auth: {
    async signInWithGoogle() {
      const auth = getFirebaseAuth();
      const db = getFirebaseDb();
      if (!auth || !db) return backendNotConfigured('Signing in with Google');

      try {
        const credential = await signInWithPopup(auth, googleAuthProvider);
        const user = credential.user;
        await ensureDriverSeedDocs(user.uid, {
          fullName: user.displayName,
          email: user.email,
          phone: user.phoneNumber,
          avatarUrl: user.photoURL,
        });
        return {
          ok: true,
          configured: true,
          data: {
            user_id: user.uid,
            driver_id: user.uid,
            email: user.email,
            displayName: user.displayName,
          },
        };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.WRITE, 'drivers');
        const msg = err instanceof Error ? err.message : 'Google Sign-In failed or was cancelled.';
        return { ok: false, configured: true, error: { code: 'NETWORK_ERROR', message: msg } };
      }
    },

    async sendOtp(phone: string) {
      const check = validateIndianPhone(phone);
      if (!check.valid) {
        return {
          ok: false,
          configured: true,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Enter a valid 10-digit Indian mobile number.',
          },
        };
      }
      const auth = getFirebaseAuth();
      if (!auth) return backendNotConfigured('Sending login OTP');
      if (typeof document === 'undefined') {
        return {
          ok: false,
          configured: true,
          error: { code: 'UNKNOWN_ERROR', message: 'Phone OTP requires browser DOM reCAPTCHA.' },
        };
      }

      try {
        let container = document.getElementById('shine-recaptcha-container');
        if (!container) {
          container = document.createElement('div');
          container.id = 'shine-recaptcha-container';
          container.style.display = 'none';
          document.body.appendChild(container);
        }
        if (!cachedRecaptcha) {
          cachedRecaptcha = new RecaptchaVerifier(auth, 'shine-recaptcha-container', {
            size: 'invisible',
          });
        }
        pendingConfirmation = await signInWithPhoneNumber(auth, check.normalized, cachedRecaptcha);
        return { ok: true, configured: true, data: { expiresInSeconds: 120 } };
      } catch (err) {
        cachedRecaptcha = null;
        const msg = err instanceof Error ? err.message : 'Unable to dispatch SMS OTP.';
        const hint = msg.includes('operation-not-allowed') || msg.includes('billing')
          ? 'Firebase Phone SMS requires enabling Phone provider in Firebase Console. Use instant "Continue with Google" below instead.'
          : msg;
        return { ok: false, configured: true, error: { code: 'NETWORK_ERROR', message: hint } };
      }
    },

    async verifyOtp(phone: string, token: string) {
      const check = validateIndianPhone(phone);
      const cleanedToken = token.trim();
      if (!check.valid) {
        return {
          ok: false,
          configured: true,
          error: { code: 'VALIDATION_ERROR', message: 'Enter a valid 10-digit Indian mobile number.' },
        };
      }
      if (cleanedToken.length !== 6) {
        return {
          ok: false,
          configured: true,
          error: { code: 'INVALID_OTP', message: 'Enter the complete 6-digit SMS OTP.' },
        };
      }
      const auth = getFirebaseAuth();
      if (!auth) return backendNotConfigured('Verifying login OTP');
      if (!pendingConfirmation) {
        return {
          ok: false,
          configured: true,
          error: {
            code: 'INVALID_OTP',
            message: 'Request a fresh OTP or sign in instantaneously with Google.',
          },
        };
      }

      try {
        const result = await pendingConfirmation.confirm(cleanedToken);
        pendingConfirmation = null;
        await ensureDriverSeedDocs(result.user.uid, {
          phone: result.user.phoneNumber || check.normalized,
        });
        return {
          ok: true,
          configured: true,
          data: { user_id: result.user.uid, driver_id: result.user.uid },
        };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.WRITE, 'drivers');
        return {
          ok: false,
          configured: true,
          error: {
            code: 'INVALID_OTP',
            message: err instanceof Error ? err.message : 'Invalid or expired OTP.',
          },
        };
      }
    },

    async signOut() {
      const auth = getFirebaseAuth();
      if (!auth) return backendNotConfigured('Signing out');
      try {
        await firebaseSignOut(auth);
        return { ok: true, configured: true };
      } catch (err) {
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Sign-out failed.' },
        };
      }
    },
  },

  driver: {
    async getProfile(): Promise<ServiceResult<DriverProfile | null>> {
      const auth = getFirebaseAuth();
      const db = getFirebaseDb();
      if (!auth || !db) return backendNotConfigured('Fetching driver profile');

      const user = auth.currentUser;
      if (!user) {
        return {
          ok: false,
          configured: true,
          error: { code: 'UNAUTHENTICATED', message: 'Sign in with Google or Mobile OTP to sync your Captain profile.' },
        };
      }

      const path = `drivers/${user.uid}`;
      try {
        const snap = await getDoc(doc(db, 'drivers', user.uid));
        if (!snap.exists()) {
          const seeded = await ensureDriverSeedDocs(user.uid, {
            fullName: user.displayName,
            email: user.email,
            phone: user.phoneNumber,
            avatarUrl: user.photoURL,
          });
          return { ok: true, configured: true, data: seeded };
        }
        return {
          ok: true,
          configured: true,
          data: mapDriverDoc(snap.data() as Record<string, unknown>, user.uid),
        };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.GET, path);
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Profile fetch failed.' },
        };
      }
    },

    async upsertProfile(payload: DriverRegistrationPayload): Promise<ServiceResult<DriverProfile>> {
      const auth = getFirebaseAuth();
      const db = getFirebaseDb();
      if (!auth || !db) return backendNotConfigured('Saving driver personal details');

      const user = auth.currentUser;
      if (!user) {
        return {
          ok: false,
          configured: true,
          error: { code: 'UNAUTHENTICATED', message: 'Sign in with Google or OTP before saving your driver profile.' },
        };
      }

      const path = `drivers/${user.uid}`;
      try {
        await ensureDriverSeedDocs(user.uid, {
          fullName: payload.full_name,
          email: payload.email || user.email,
          phone: payload.phone,
        });
        await updateDoc(doc(db, 'drivers', user.uid), {
          full_name: payload.full_name,
          phone: payload.phone,
          email: payload.email || null,
          city: payload.city,
          date_of_birth: payload.date_of_birth || null,
          emergency_contact_name: payload.emergency_contact_name || null,
          emergency_contact_phone: payload.emergency_contact_phone || null,
          profile_completed: true,
          updated_at: serverTimestamp(),
        });
        const fresh = await getDoc(doc(db, 'drivers', user.uid));
        return {
          ok: true,
          configured: true,
          data: mapDriverDoc((fresh.data() as Record<string, unknown>) || {}, user.uid),
        };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.UPDATE, path);
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Failed saving profile.' },
        };
      }
    },

    async uploadAvatar(driverId: string, file: File): Promise<ServiceResult<DriverProfile>> {
      const auth = getFirebaseAuth();
      const db = getFirebaseDb();
      if (!auth || !db) return backendNotConfigured('Saving driver profile photo');
      if (!auth.currentUser) {
        return {
          ok: false,
          configured: true,
          error: { code: 'UNAUTHENTICATED', message: 'Sign in to save your profile photo to Firestore.' },
        };
      }

      const path = `drivers/${driverId}`;
      try {
        const compressedDataUrl = await compressFileToFirestoreDataUrl(file, {
          maxDimension: 720,
          quality: 0.75,
        });
        await ensureDriverSeedDocs(driverId);
        await updateDoc(doc(db, 'drivers', driverId), {
          avatar_url: compressedDataUrl,
          updated_at: serverTimestamp(),
        });
        const fresh = await getDoc(doc(db, 'drivers', driverId));
        return {
          ok: true,
          configured: true,
          data: mapDriverDoc((fresh.data() as Record<string, unknown>) || {}, driverId),
        };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.UPDATE, path);
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Avatar upload failed.' },
        };
      }
    },

    async setOnlineStatus(
      driverId: string,
      online: boolean,
      location?: GeoPoint,
      vehicleCategory?: VehicleCategory
    ): Promise<ServiceResult<DriverProfile>> {
      const auth = getFirebaseAuth();
      const db = getFirebaseDb();
      if (!auth || !db) return backendNotConfigured('Updating online/offline duty status');

      const driverPath = `drivers/${driverId}`;
      try {
        const driverSnap = await getDoc(doc(db, 'drivers', driverId));
        if (!driverSnap.exists()) {
          return {
            ok: false,
            configured: true,
            error: { code: 'NOT_APPROVED', message: 'Driver profile not found.' },
          };
        }
        const driver = mapDriverDoc(driverSnap.data() as Record<string, unknown>, driverId);

        const vehicleSnap = await getDoc(doc(db, 'vehicles', `${driverId}_active`));
        const vehicle = vehicleSnap.exists()
          ? mapVehicleDoc(vehicleSnap.data() as Record<string, unknown>, vehicleSnap.id)
          : null;

        if (online) {
          const gate = canDriverGoOnline(driver, vehicle);
          if (!gate.allowed) {
            return {
              ok: false,
              configured: true,
              error: {
                code: 'NOT_APPROVED',
                message: gate.blockers[0] || 'Driver is not approved by Admin yet.',
              },
            };
          }
        }

        const driverPatch: Record<string, unknown> = {
          is_online: online,
          updated_at: serverTimestamp(),
        };
        if (location) {
          driverPatch.lat = location.lat;
          driverPatch.lng = location.lng;
          driverPatch.heading = location.heading ?? null;
          driverPatch.speed_kmh = location.speed_kmh ?? 0;
        }
        await updateDoc(doc(db, 'drivers', driverId), driverPatch);

        if (location) {
          await setDoc(doc(db, 'driver_locations', driverId), {
            driver_id: driverId,
            lat: location.lat,
            lng: location.lng,
            heading: location.heading ?? null,
            speed_kmh: location.speed_kmh ?? 0,
            accuracy_m: location.accuracy_m ?? null,
            is_online: online,
            vehicle_category: vehicleCategory || vehicle?.category || 'cab',
            updated_at: serverTimestamp(),
          });
        } else {
          const locSnap = await getDoc(doc(db, 'driver_locations', driverId));
          if (locSnap.exists()) {
            await updateDoc(doc(db, 'driver_locations', driverId), {
              is_online: online,
              updated_at: serverTimestamp(),
            });
          }
        }

        const updatedSnap = await getDoc(doc(db, 'drivers', driverId));
        return {
          ok: true,
          configured: true,
          data: mapDriverDoc((updatedSnap.data() as Record<string, unknown>) || {}, driverId),
        };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.UPDATE, driverPath);
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Duty toggle failed.' },
        };
      }
    },

    async updateLocation(
      driverId: string,
      location: GeoPoint,
      isOnline = true,
      vehicleCategory?: VehicleCategory
    ) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Syncing live GPS telemetry');
      if (!auth.currentUser) return { ok: false, configured: true };

      const locPath = `driver_locations/${driverId}`;
      try {
        await setDoc(doc(db, 'driver_locations', driverId), {
          driver_id: driverId,
          lat: location.lat,
          lng: location.lng,
          heading: location.heading ?? null,
          speed_kmh: location.speed_kmh ?? 0,
          accuracy_m: location.accuracy_m ?? null,
          is_online: isOnline,
          vehicle_category: vehicleCategory ?? null,
          updated_at: serverTimestamp(),
        });
        await updateDoc(doc(db, 'drivers', driverId), {
          lat: location.lat,
          lng: location.lng,
          heading: location.heading ?? null,
          speed_kmh: location.speed_kmh ?? 0,
          updated_at: serverTimestamp(),
        });
        return { ok: true, configured: true };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.WRITE, locPath);
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'GPS sync failed.' },
        };
      }
    },
  },

  vehicle: {
    async getActiveVehicle(driverId: string) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Fetching vehicle details');
      if (!auth.currentUser) {
        return { ok: true, configured: true, data: null };
      }
      const path = 'vehicles';
      try {
        const directSnap = await getDoc(doc(db, 'vehicles', `${driverId}_active`));
        if (directSnap.exists()) {
          return {
            ok: true,
            configured: true,
            data: mapVehicleDoc(directSnap.data() as Record<string, unknown>, directSnap.id),
          };
        }
        const snap = await getDocs(
          query(collection(db, 'vehicles'), where('driver_id', '==', driverId))
        );
        const first = snap.docs[0];
        return {
          ok: true,
          configured: true,
          data: first ? mapVehicleDoc(first.data() as Record<string, unknown>, first.id) : null,
        };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.GET, path);
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Vehicle fetch failed.' },
        };
      }
    },

    async upsertVehicle(driverId: string, payload: VehicleUpsertPayload) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Saving vehicle details');
      if (!auth.currentUser) {
        return {
          ok: false,
          configured: true,
          error: { code: 'UNAUTHENTICATED', message: 'Sign in first before registering a vehicle.' },
        };
      }

      const vehicleId = `${driverId}_active`;
      const path = `vehicles/${vehicleId}`;
      try {
        await ensureDriverSeedDocs(driverId);
        const existingSnap = await getDoc(doc(db, 'vehicles', vehicleId));
        if (existingSnap.exists()) {
          await updateDoc(doc(db, 'vehicles', vehicleId), {
            category: payload.category,
            make: payload.make,
            model: payload.model,
            year: payload.year,
            color: payload.color,
            registration_number: payload.registration_number.toUpperCase(),
            permit_number: payload.permit_number || null,
            insurance_expiry: payload.insurance_expiry || null,
            rc_expiry: payload.rc_expiry || null,
            is_active: true,
            updated_at: serverTimestamp(),
          });
        } else {
          await setDoc(doc(db, 'vehicles', vehicleId), {
            vehicle_id: vehicleId,
            driver_id: driverId,
            category: payload.category,
            make: payload.make,
            model: payload.model,
            year: payload.year,
            color: payload.color,
            registration_number: payload.registration_number.toUpperCase(),
            permit_number: payload.permit_number || null,
            insurance_expiry: payload.insurance_expiry || null,
            rc_expiry: payload.rc_expiry || null,
            verification_status: 'pending',
            is_active: true,
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
          });
        }
        await updateDoc(doc(db, 'drivers', driverId), {
          active_vehicle_id: vehicleId,
          updated_at: serverTimestamp(),
        });
        const fresh = await getDoc(doc(db, 'vehicles', vehicleId));
        return {
          ok: true,
          configured: true,
          data: mapVehicleDoc((fresh.data() as Record<string, unknown>) || {}, vehicleId),
        };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.WRITE, path);
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Vehicle save failed.' },
        };
      }
    },
  },

  kyc: {
    async listDocuments(driverId: string) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Loading KYC documents');
      if (!auth.currentUser) return { ok: true, configured: true, data: [] };

      const path = 'driver_documents';
      try {
        const snap = await getDocs(
          query(collection(db, 'driver_documents'), where('driver_id', '==', driverId))
        );
        const list = snap.docs.map((d) =>
          mapDriverDocument(d.data() as Record<string, unknown>, d.id)
        );
        return { ok: true, configured: true, data: list };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.LIST, path);
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Failed loading docs.' },
        };
      }
    },

    async uploadDocument(driverId, docType, file) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Saving KYC document');
      if (!auth.currentUser) {
        return {
          ok: false,
          configured: true,
          error: { code: 'UNAUTHENTICATED', message: 'Sign in before uploading KYC documents.' },
        };
      }

      const docId = `${driverId}_${docType}`;
      const path = `driver_documents/${docId}`;
      try {
        const compressedDataUrl = await compressFileToFirestoreDataUrl(file, {
          maxDimension: 720,
          quality: 0.75,
        });
        await ensureDriverSeedDocs(driverId);

        const docPayload = {
          document_id: docId,
          driver_id: driverId,
          document_type: docType,
          storage_path: `firestore://driver_documents/${docId}`,
          file_url: compressedDataUrl,
          file_name: file.name,
          status: 'pending_review',
          rejection_reason: null,
          uploaded_at: serverTimestamp(),
        };

        const existing = await getDoc(doc(db, 'driver_documents', docId));
        if (existing.exists()) {
          await updateDoc(doc(db, 'driver_documents', docId), {
            storage_path: docPayload.storage_path,
            file_url: docPayload.file_url,
            file_name: docPayload.file_name,
            status: 'pending_review',
            rejection_reason: null,
            uploaded_at: serverTimestamp(),
          });
        } else {
          await setDoc(doc(db, 'driver_documents', docId), docPayload);
        }

        const fresh = await getDoc(doc(db, 'driver_documents', docId));
        return {
          ok: true,
          configured: true,
          data: mapDriverDocument((fresh.data() as Record<string, unknown>) || {}, docId),
        };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.WRITE, path);
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'KYC document upload failed.' },
        };
      }
    },

    async submitForApproval(driverId: string) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Submitting KYC for admin review');
      const path = `drivers/${driverId}`;
      try {
        await updateDoc(doc(db, 'drivers', driverId), {
          documents_uploaded: true,
          kyc_status: 'under_review',
          account_status: 'pending_approval',
          updated_at: serverTimestamp(),
        });
        const fresh = await getDoc(doc(db, 'drivers', driverId));
        return {
          ok: true,
          configured: true,
          data: mapDriverDoc((fresh.data() as Record<string, unknown>) || {}, driverId),
        };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.UPDATE, path);
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'KYC submission failed.' },
        };
      }
    },
  },

  rides: {
    subscribeOffers(driverId: string, category: VehicleCategory, onOffer: (ride: RideRecord) => void) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth?.currentUser) return () => {};

      const q = query(
        collection(db, 'rides'),
        where('status', 'in', ['searching', 'offered', 'requested'])
      );

      const seenOffers = new Set<string>();
      const unsub = onSnapshot(
        q,
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added' || change.type === 'modified') {
              const ride = mapRideDoc(change.doc.data() as Record<string, unknown>, change.doc.id);
              const categoryMatches = !ride.vehicle_category || ride.vehicle_category === category;
              const eligible = !ride.driver_id || ride.driver_id === driverId;
              if (categoryMatches && eligible && !seenOffers.has(ride.ride_id)) {
                seenOffers.add(ride.ride_id);
                onOffer(ride);
              }
            }
          });
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, 'rides');
        }
      );

      return unsub;
    },

    async acceptRide(
      rideId: string,
      driverId: string,
      vehicleId?: string | null
    ): Promise<ServiceResult<AcceptRideResponse>> {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Accepting ride atomically');
      if (!auth.currentUser) {
        return {
          ok: false,
          configured: true,
          error: { code: 'UNAUTHENTICATED', message: 'Sign in to accept rides.' },
        };
      }

      const path = `rides/${rideId}`;
      try {
        const updatedRide = await runTransaction(db, async (tx) => {
          const rideRef = doc(db, 'rides', rideId);
          const snap = await tx.get(rideRef);
          if (!snap.exists()) {
            throw new Error('RIDE_NOT_FOUND');
          }
          const current = mapRideDoc(snap.data() as Record<string, unknown>, rideId);
          if (
            current.driver_id &&
            current.driver_id !== driverId
          ) {
            throw new Error('ALREADY_TAKEN');
          }
          if (!['searching', 'offered', 'requested'].includes(current.status)) {
            throw new Error('ALREADY_TAKEN');
          }
          tx.update(rideRef, {
            driver_id: driverId,
            vehicle_id: vehicleId || `${driverId}_active`,
            status: 'accepted',
            updated_at: serverTimestamp(),
          });
          return {
            ...current,
            driver_id: driverId,
            vehicle_id: vehicleId || `${driverId}_active`,
            status: 'accepted' as const,
          };
        });

        return {
          ok: true,
          configured: true,
          data: {
            ride: updatedRide,
            accepted_atomically: true,
            assigned_driver_id: driverId,
          },
        };
      } catch (err) {
        if (err instanceof Error && err.message === 'ALREADY_TAKEN') {
          return {
            ok: false,
            configured: true,
            error: {
              code: 'RIDE_ALREADY_TAKEN',
              message: 'Another captain claimed this ride moments earlier.',
            },
          };
        }
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.UPDATE, path);
        return {
          ok: false,
          configured: true,
          error: {
            code: 'NETWORK_ERROR',
            message: err instanceof Error ? err.message : 'Unable to accept ride.',
          },
        };
      }
    },

    async rejectRide(rideId: string, driverId: string) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Declining ride offer');
      const path = `rides/${rideId}`;
      try {
        const snap = await getDoc(doc(db, 'rides', rideId));
        if (snap.exists()) {
          const data = snap.data() as Record<string, unknown>;
          if (data.status === 'offered' && data.driver_id === driverId) {
            await updateDoc(doc(db, 'rides', rideId), {
              driver_id: null,
              status: 'searching',
              updated_at: serverTimestamp(),
            });
          }
        }
        return { ok: true, configured: true };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.UPDATE, path);
        return { ok: true, configured: true };
      }
    },

    async markArrived(rideId: string, driverId: string) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Updating arrival at pickup');
      const path = `rides/${rideId}`;
      try {
        await updateDoc(doc(db, 'rides', rideId), {
          status: 'arrived',
          updated_at: serverTimestamp(),
        });
        const fresh = await getDoc(doc(db, 'rides', rideId));
        return {
          ok: true,
          configured: true,
          data: mapRideDoc((fresh.data() as Record<string, unknown>) || { driver_id: driverId }, rideId),
        };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.UPDATE, path);
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Failed updating arrival.' },
        };
      }
    },

    async verifyPickupOtp(payload: VerifyPickupOtpPayload) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Verifying pickup OTP');

      const cleanedOtp = payload.otp_code.trim();
      if (!/^\d{4}$/.test(cleanedOtp)) {
        return {
          ok: false,
          configured: true,
          error: { code: 'INVALID_OTP', message: 'Enter a valid 4-digit numeric Pickup OTP.' },
        };
      }

      const path = `rides/${payload.ride_id}`;
      try {
        const started = await runTransaction(db, async (tx) => {
          const rideRef = doc(db, 'rides', payload.ride_id);
          const snap = await tx.get(rideRef);
          if (!snap.exists()) throw new Error('RIDE_NOT_FOUND');
          const ride = mapRideDoc(snap.data() as Record<string, unknown>, payload.ride_id);
          if (ride.driver_id !== payload.driver_id) throw new Error('NOT_ASSIGNED');
          if (ride.pickup_otp && ride.pickup_otp.trim() !== cleanedOtp) {
            throw new Error('OTP_MISMATCH');
          }
          tx.update(rideRef, {
            status: 'in_progress',
            pickup_otp_verified: true,
            started_at: serverTimestamp(),
            updated_at: serverTimestamp(),
          });
          return {
            ...ride,
            status: 'in_progress' as const,
            pickup_otp_verified: true,
            started_at: new Date().toISOString(),
          };
        });
        return { ok: true, configured: true, data: started };
      } catch (err) {
        if (err instanceof Error && err.message === 'OTP_MISMATCH') {
          return {
            ok: false,
            configured: true,
            error: {
              code: 'INVALID_OTP',
              message: 'Incorrect 4-digit OTP. Ask the passenger to check their SHINE Customer App.',
            },
          };
        }
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.UPDATE, path);
        return {
          ok: false,
          configured: true,
          error: {
            code: 'INVALID_OTP',
            message: err instanceof Error ? err.message : 'OTP verification failed.',
          },
        };
      }
    },

    async completeRide(payload: CompleteRidePayload) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Completing ride and updating wallet');

      const path = `rides/${payload.ride_id}`;
      try {
        const completed = await runTransaction(db, async (tx) => {
          const rideRef = doc(db, 'rides', payload.ride_id);
          const driverRef = doc(db, 'drivers', payload.driver_id);
          const walletRef = doc(db, 'wallet_accounts', payload.driver_id);

          const [rideSnap, driverSnap, walletSnap] = await Promise.all([
            tx.get(rideRef),
            tx.get(driverRef),
            tx.get(walletRef),
          ]);

          if (!rideSnap.exists()) throw new Error('RIDE_NOT_FOUND');
          const ride = mapRideDoc(rideSnap.data() as Record<string, unknown>, payload.ride_id);
          if (ride.driver_id !== payload.driver_id) throw new Error('NOT_ASSIGNED');
          if (!ride.pickup_otp_verified || ride.status !== 'in_progress') {
            throw new Error('INVALID_STATE');
          }

          const finalFare = Number((ride.estimated_fare_inr || 0).toFixed(2));
          const commission = Number((finalFare * 0.15).toFixed(2));
          const driverNet = Number((finalFare - commission).toFixed(2));

          tx.update(rideRef, {
            status: 'completed',
            final_fare_inr: finalFare,
            commission_inr: commission,
            driver_net_inr: driverNet,
            payment_status: 'paid',
            completed_at: serverTimestamp(),
            updated_at: serverTimestamp(),
          });

          if (driverSnap.exists()) {
            const curRides = Number((driverSnap.data() as Record<string, unknown>).total_rides || 0);
            tx.update(driverRef, {
              total_rides: curRides + 1,
              updated_at: serverTimestamp(),
            });
          }

          if (walletSnap.exists()) {
            const w = mapWalletDoc(walletSnap.data() as Record<string, unknown>, payload.driver_id);
            const isCash = ride.payment_mode === 'cash';
            tx.update(walletRef, {
              available_balance_inr: isCash
                ? w.available_balance_inr
                : Number((w.available_balance_inr + driverNet).toFixed(2)),
              cash_commission_due_inr: isCash
                ? Number((w.cash_commission_due_inr + commission).toFixed(2))
                : w.cash_commission_due_inr,
              updated_at: serverTimestamp(),
            });
          }

          return {
            ...ride,
            status: 'completed' as const,
            final_fare_inr: finalFare,
            commission_inr: commission,
            driver_net_inr: driverNet,
            payment_status: 'paid' as const,
            completed_at: new Date().toISOString(),
          };
        });

        return { ok: true, configured: true, data: completed };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.UPDATE, path);
        return {
          ok: false,
          configured: true,
          error: {
            code: 'NETWORK_ERROR',
            message: err instanceof Error ? err.message : 'Unable to complete ride.',
          },
        };
      }
    },

    async cancelRide(rideId: string, _driverId: string, reason: string) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Cancelling active ride');
      const path = `rides/${rideId}`;
      try {
        await updateDoc(doc(db, 'rides', rideId), {
          status: 'cancelled',
          cancellation_reason: reason || 'Cancelled by captain',
          cancelled_by: 'driver',
          updated_at: serverTimestamp(),
        });
        const fresh = await getDoc(doc(db, 'rides', rideId));
        return {
          ok: true,
          configured: true,
          data: mapRideDoc((fresh.data() as Record<string, unknown>) || {}, rideId),
        };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.UPDATE, path);
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Cancel failed.' },
        };
      }
    },

    async getActiveRide(driverId: string) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Loading active ride');
      if (!auth.currentUser) return { ok: true, configured: true, data: null };

      try {
        const snap = await getDocs(
          query(collection(db, 'rides'), where('driver_id', '==', driverId))
        );
        const active = snap.docs
          .map((d) => mapRideDoc(d.data() as Record<string, unknown>, d.id))
          .filter((r) => ['accepted', 'arriving', 'arrived', 'in_progress'].includes(r.status))
          .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0] ?? null;

        return { ok: true, configured: true, data: active };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.LIST, 'rides');
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Active ride fetch failed.' },
        };
      }
    },

    async getRideHistory(driverId: string) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Loading ride history');
      if (!auth.currentUser) return { ok: true, configured: true, data: [] };

      try {
        const snap = await getDocs(
          query(collection(db, 'rides'), where('driver_id', '==', driverId))
        );
        const history = snap.docs
          .map((d) => mapRideDoc(d.data() as Record<string, unknown>, d.id))
          .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
          .slice(0, 50);

        return { ok: true, configured: true, data: history };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.LIST, 'rides');
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Ride history failed.' },
        };
      }
    },

    subscribeMessages(rideId: string, onMessages: (messages: RideMessageRecord[]) => void) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth?.currentUser || !rideId) return () => {};

      const q = query(collection(db, 'ride_messages'), where('ride_id', '==', rideId));
      return onSnapshot(
        q,
        (snap) => {
          const list = snap.docs
            .map((d) => mapRideMessageDoc(d.data() as Record<string, unknown>, d.id))
            .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
          onMessages(list);
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, 'ride_messages');
        }
      );
    },

    async sendMessage(payload: SendRideMessagePayload): Promise<ServiceResult<RideMessageRecord>> {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Sending live ride chat message');
      if (!auth.currentUser) {
        return { ok: false, configured: true, error: { code: 'UNAUTHENTICATED', message: 'Sign in to chat.' } };
      }

      const msgId = makeDocId('msg');
      const path = `ride_messages/${msgId}`;
      try {
        await setDoc(doc(db, 'ride_messages', msgId), {
          message_id: msgId,
          ride_id: payload.ride_id,
          driver_id: payload.driver_id,
          customer_id: payload.customer_id,
          sender_id: payload.sender_id,
          sender_role: 'driver',
          sender_name: payload.sender_name,
          text: payload.text.trim(),
          created_at: serverTimestamp(),
        });
        return {
          ok: true,
          configured: true,
          data: {
            message_id: msgId,
            ride_id: payload.ride_id,
            driver_id: payload.driver_id,
            customer_id: payload.customer_id,
            sender_id: payload.sender_id,
            sender_role: 'driver',
            sender_name: payload.sender_name,
            text: payload.text.trim(),
            created_at: new Date().toISOString(),
          },
        };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.CREATE, path);
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Chat send failed.' },
        };
      }
    },
  },

  finance: {
    async getEarnings(driverId: string, period: EarningsSummary['period']) {
      const historyRes = await this.getRideHistoryRef(driverId);
      if (!historyRes.ok) {
        return { ok: false, configured: historyRes.configured, error: historyRes.error };
      }
      return {
        ok: true,
        configured: true,
        data: computeEarningsFromRides(historyRes.data || [], period),
      };
    },

    async getWallet(driverId: string) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Loading wallet ledger');
      if (!auth.currentUser) return { ok: true, configured: true, data: null };

      const path = `wallet_accounts/${driverId}`;
      try {
        const snap = await getDoc(doc(db, 'wallet_accounts', driverId));
        if (!snap.exists()) return { ok: true, configured: true, data: null };
        return {
          ok: true,
          configured: true,
          data: mapWalletDoc(snap.data() as Record<string, unknown>, driverId),
        };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.GET, path);
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Wallet fetch failed.' },
        };
      }
    },

    async updatePayoutMethod(driverId: string, payload: PayoutMethodPayload) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Saving bank or UPI payout method');
      if (!auth.currentUser) {
        return { ok: false, configured: true, error: { code: 'UNAUTHENTICATED', message: 'Sign in first.' } };
      }

      const path = `wallet_accounts/${driverId}`;
      try {
        await ensureDriverSeedDocs(driverId);
        const digits = (payload.bank_account_number || '').replace(/\D/g, '');
        const masked =
          digits.length >= 4
            ? `XXXX-${digits.slice(-4)}${payload.ifsc_code ? ` (${payload.ifsc_code.toUpperCase()})` : ''}`
            : undefined;

        const patch: Record<string, unknown> = { updated_at: serverTimestamp() };
        if (payload.upi_id !== undefined) patch.upi_id = payload.upi_id.trim() || null;
        if (payload.account_holder_name !== undefined) {
          patch.account_holder_name = payload.account_holder_name.trim() || null;
        }
        if (masked) {
          patch.bank_account_masked = masked;
          patch.bank_account_verified = true;
        }

        await updateDoc(doc(db, 'wallet_accounts', driverId), patch);
        const fresh = await getDoc(doc(db, 'wallet_accounts', driverId));
        return {
          ok: true,
          configured: true,
          data: mapWalletDoc((fresh.data() as Record<string, unknown>) || {}, driverId),
        };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.UPDATE, path);
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Failed updating payout method.' },
        };
      }
    },

    async getPayoutHistory(driverId: string) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Loading payout history');
      if (!auth.currentUser) return { ok: true, configured: true, data: [] };

      try {
        const snap = await getDocs(
          query(collection(db, 'payouts'), where('driver_id', '==', driverId))
        );
        const list = snap.docs
          .map((d) => mapPayoutDoc(d.data() as Record<string, unknown>, d.id))
          .sort((a, b) => Date.parse(b.requested_at) - Date.parse(a.requested_at));
        return { ok: true, configured: true, data: list };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.LIST, 'payouts');
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Payout history failed.' },
        };
      }
    },

    async requestPayout(driverId: string, amountInr: number) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Requesting wallet payout');
      if (!auth.currentUser) {
        return { ok: false, configured: true, error: { code: 'UNAUTHENTICATED', message: 'Sign in first.' } };
      }

      const payoutId = makeDocId('pay');
      const path = `payouts/${payoutId}`;
      try {
        const created = await runTransaction(db, async (tx) => {
          const walletRef = doc(db, 'wallet_accounts', driverId);
          const wSnap = await tx.get(walletRef);
          if (!wSnap.exists()) throw new Error('Wallet account not initialized yet.');
          const w = mapWalletDoc(wSnap.data() as Record<string, unknown>, driverId);
          if (amountInr <= 0 || amountInr > w.available_balance_inr) {
            throw new Error('Requested payout exceeds available wallet balance.');
          }
          const destination =
            w.upi_id || w.bank_account_masked || 'Registered Bank / UPI';
          const payoutRef = doc(db, 'payouts', payoutId);

          tx.update(walletRef, {
            available_balance_inr: Number((w.available_balance_inr - amountInr).toFixed(2)),
            pending_settlement_inr: Number((w.pending_settlement_inr + amountInr).toFixed(2)),
            updated_at: serverTimestamp(),
          });

          tx.set(payoutRef, {
            payout_id: payoutId,
            driver_id: driverId,
            amount_inr: amountInr,
            status: 'initiated',
            provider_reference: `REQ-${Date.now()}`,
            destination_label: destination,
            requested_at: serverTimestamp(),
            settled_at: null,
          });

          return {
            payout_id: payoutId,
            driver_id: driverId,
            amount_inr: amountInr,
            status: 'initiated' as const,
            provider_reference: `REQ-${Date.now()}`,
            destination_label: destination,
            requested_at: new Date().toISOString(),
            settled_at: null,
          };
        });

        return { ok: true, configured: true, data: created };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.CREATE, path);
        return {
          ok: false,
          configured: true,
          error: { code: 'VALIDATION_ERROR', message: err instanceof Error ? err.message : 'Payout request failed.' },
        };
      }
    },

    async settleCashDues(driverId: string, amountInr: number): Promise<ServiceResult<WalletAccount>> {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Settling cash dues');
      const path = `wallet_accounts/${driverId}`;
      try {
        const updatedWallet = await runTransaction(db, async (tx) => {
          const walletRef = doc(db, 'wallet_accounts', driverId);
          const wSnap = await tx.get(walletRef);
          if (!wSnap.exists()) throw new Error('Wallet account not found.');
          const w = mapWalletDoc(wSnap.data() as Record<string, unknown>, driverId);
          const newDue = Math.max(0, Number((w.cash_commission_due_inr - amountInr).toFixed(2)));
          tx.update(walletRef, {
            cash_commission_due_inr: newDue,
            updated_at: serverTimestamp(),
          });
          return { ...w, cash_commission_due_inr: newDue, updated_at: new Date().toISOString() };
        });
        return { ok: true, configured: true, data: updatedWallet };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.UPDATE, path);
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Dues settlement failed.' },
        };
      }
    },

    // Internal helper avoiding cross-module circular dependency on driverBackendService.rides
    async getRideHistoryRef(driverId: string) {
      return driverBackendService.rides.getRideHistory(driverId);
    },
  } as DriverBackendContract['finance'] & {
    getRideHistoryRef(driverId: string): Promise<ServiceResult<RideRecord[]>>;
  },

  account: {
    async getRatings(driverId: string) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Loading customer ratings');
      if (!auth.currentUser) return { ok: true, configured: true, data: [] };

      try {
        const snap = await getDocs(
          query(collection(db, 'ratings'), where('driver_id', '==', driverId))
        );
        const list = snap.docs
          .map((d) => mapRatingDoc(d.data() as Record<string, unknown>, d.id))
          .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
        return { ok: true, configured: true, data: list };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.LIST, 'ratings');
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Ratings fetch failed.' },
        };
      }
    },

    subscribeRatings(driverId: string, onRating: (rating: DriverRatingRecord) => void) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth?.currentUser || !driverId) return () => {};

      const q = query(collection(db, 'ratings'), where('driver_id', '==', driverId));
      return onSnapshot(
        q,
        (snap) => {
          snap.docChanges().forEach((change) => {
            if (change.type === 'added') {
              onRating(mapRatingDoc(change.doc.data() as Record<string, unknown>, change.doc.id));
            }
          });
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'ratings')
      );
    },

    async getNotifications(driverId: string) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Loading notifications');
      if (!auth.currentUser) return { ok: true, configured: true, data: [] };

      try {
        const snap = await getDocs(
          query(collection(db, 'notifications'), where('driver_id', '==', driverId))
        );
        const list = snap.docs
          .map((d) => mapNotificationDoc(d.data() as Record<string, unknown>, d.id))
          .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
        return { ok: true, configured: true, data: list };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.LIST, 'notifications');
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Notifications failed.' },
        };
      }
    },

    subscribeNotifications(driverId: string, onNotification: (notification: DriverNotification) => void) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth?.currentUser || !driverId) return () => {};

      const q = query(collection(db, 'notifications'), where('driver_id', '==', driverId));
      return onSnapshot(
        q,
        (snap) => {
          snap.docChanges().forEach((change) => {
            if (change.type === 'added') {
              onNotification(
                mapNotificationDoc(change.doc.data() as Record<string, unknown>, change.doc.id)
              );
            }
          });
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
      );
    },

    async markNotificationRead(notificationId: string) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Updating notification');
      const path = `notifications/${notificationId}`;
      try {
        await updateDoc(doc(db, 'notifications', notificationId), { read: true });
        return { ok: true, configured: true };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.UPDATE, path);
        return { ok: true, configured: true };
      }
    },

    async markAllNotificationsRead(driverId: string) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Marking notifications read');
      try {
        const snap = await getDocs(
          query(collection(db, 'notifications'), where('driver_id', '==', driverId))
        );
        const batch = writeBatch(db);
        snap.docs.forEach((d) => {
          if (!d.data().read) batch.update(d.ref, { read: true });
        });
        await batch.commit();
        return { ok: true, configured: true };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.UPDATE, 'notifications');
        return { ok: true, configured: true };
      }
    },

    async getSupportTickets(driverId: string) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Loading support tickets');
      if (!auth.currentUser) return { ok: true, configured: true, data: [] };

      try {
        const snap = await getDocs(
          query(collection(db, 'support_tickets'), where('driver_id', '==', driverId))
        );
        const list = snap.docs
          .map((d) => mapTicketDoc(d.data() as Record<string, unknown>, d.id))
          .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
        return { ok: true, configured: true, data: list };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.LIST, 'support_tickets');
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Tickets fetch failed.' },
        };
      }
    },

    async createSupportTicket(driverId: string, subject: string, description: string, rideId?: string) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Submitting support ticket');
      if (!auth.currentUser) {
        return { ok: false, configured: true, error: { code: 'UNAUTHENTICATED', message: 'Sign in to submit a ticket.' } };
      }

      const ticketId = makeDocId('tkt');
      const path = `support_tickets/${ticketId}`;
      try {
        await setDoc(doc(db, 'support_tickets', ticketId), {
          ticket_id: ticketId,
          driver_id: driverId,
          ride_id: rideId?.trim() || null,
          subject: subject.trim(),
          description: description.trim(),
          status: 'open',
          created_at: serverTimestamp(),
        });
        const fresh = await getDoc(doc(db, 'support_tickets', ticketId));
        return {
          ok: true,
          configured: true,
          data: mapTicketDoc((fresh.data() as Record<string, unknown>) || {}, ticketId),
        };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.CREATE, path);
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Ticket create failed.' },
        };
      }
    },

    async triggerSos(driverId: string, rideId?: string, location?: GeoPoint) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Dispatching Emergency SOS alert');
      if (!auth.currentUser) {
        return { ok: false, configured: true, error: { code: 'UNAUTHENTICATED', message: 'Sign in first or dial 112.' } };
      }

      const alertId = makeDocId('sos');
      const path = `sos_alerts/${alertId}`;
      try {
        await setDoc(doc(db, 'sos_alerts', alertId), {
          alert_id: alertId,
          driver_id: driverId,
          ride_id: rideId || null,
          lat: location?.lat ?? null,
          lng: location?.lng ?? null,
          status: 'triggered',
          created_at: serverTimestamp(),
        });
        const fresh = await getDoc(doc(db, 'sos_alerts', alertId));
        return {
          ok: true,
          configured: true,
          data: mapSosDoc((fresh.data() as Record<string, unknown>) || {}, alertId),
        };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.CREATE, path);
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'SOS dispatch failed.' },
        };
      }
    },

    subscribeSosAlerts(driverId: string, onAlerts: (alerts: SosAlertRecord[]) => void) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth?.currentUser || !driverId) return () => {};

      const q = query(collection(db, 'sos_alerts'), where('driver_id', '==', driverId));
      return onSnapshot(
        q,
        (snap) => {
          const list = snap.docs
            .map((d) => mapSosDoc(d.data() as Record<string, unknown>, d.id))
            .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
          onAlerts(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'sos_alerts')
      );
    },
  },
};

export function subscribeDriverProfile(
  driverId: string,
  onProfile: (profile: DriverProfile | null) => void
): () => void {
  const db = getFirebaseDb();
  const auth = getFirebaseAuth();
  if (!db || !auth?.currentUser || !driverId) return () => {};

  const path = `drivers/${driverId}`;
  return onSnapshot(
    doc(db, 'drivers', driverId),
    (snap) => {
      if (!snap.exists()) {
        onProfile(null);
        return;
      }
      onProfile(mapDriverDoc(snap.data() as Record<string, unknown>, driverId));
    },
    (err) => handleFirestoreError(err, OperationType.GET, path)
  );
}

export function subscribeDriverDocuments(
  driverId: string,
  onDocs: (docs: DriverDocumentRecord[]) => void
): () => void {
  const db = getFirebaseDb();
  const auth = getFirebaseAuth();
  if (!db || !auth?.currentUser || !driverId) return () => {};

  const q = query(collection(db, 'driver_documents'), where('driver_id', '==', driverId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) =>
        mapDriverDocument(d.data() as Record<string, unknown>, d.id)
      );
      onDocs(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'driver_documents')
  );
}

export function subscribeDriverRides(
  driverId: string,
  onRides: (rides: RideRecord[]) => void
): () => void {
  const db = getFirebaseDb();
  const auth = getFirebaseAuth();
  if (!db || !auth?.currentUser || !driverId) return () => {};

  const q = query(collection(db, 'rides'), where('driver_id', '==', driverId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => mapRideDoc(d.data() as Record<string, unknown>, d.id))
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
      onRides(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'rides')
  );
}

export function subscribeWalletAccount(
  driverId: string,
  onWallet: (wallet: WalletAccount | null) => void
): () => void {
  const db = getFirebaseDb();
  const auth = getFirebaseAuth();
  if (!db || !auth?.currentUser || !driverId) return () => {};

  const path = `wallet_accounts/${driverId}`;
  return onSnapshot(
    doc(db, 'wallet_accounts', driverId),
    (snap) => {
      if (!snap.exists()) {
        onWallet(null);
        return;
      }
      onWallet(mapWalletDoc(snap.data() as Record<string, unknown>, driverId));
    },
    (err) => handleFirestoreError(err, OperationType.GET, path)
  );
}

