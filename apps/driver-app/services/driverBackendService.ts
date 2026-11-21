import type {
  AcceptRideResponse,
  CompleteRidePayload,
  DriverBackendContract,
  DriverRegistrationPayload,
  PayoutMethodPayload,
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
import { getSupabaseClient } from './supabaseClient';

export const driverBackendService: DriverBackendContract = {
  auth: {
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
      const supabase = getSupabaseClient();
      if (!supabase) return backendNotConfigured('Sending login OTP');

      const { error } = await supabase.auth.signInWithOtp({ phone: check.normalized });
      if (error) {
        return { ok: false, configured: true, error: { code: 'NETWORK_ERROR', message: error.message } };
      }
      return { ok: true, configured: true, data: { expiresInSeconds: 120 } };
    },

    async verifyOtp(phone: string, token: string) {
      const check = validateIndianPhone(phone);
      const cleanedToken = token.trim();
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
      if (cleanedToken.length !== 6) {
        return {
          ok: false,
          configured: true,
          error: {
            code: 'INVALID_OTP',
            message: 'Enter the complete 6-digit SMS OTP.',
          },
        };
      }
      const supabase = getSupabaseClient();
      if (!supabase) return backendNotConfigured('Verifying login OTP');

      const { data, error } = await supabase.auth.verifyOtp({
        phone: check.normalized,
        token: cleanedToken,
        type: 'sms',
      });
      if (error || !data.user) {
        return {
          ok: false,
          configured: true,
          error: { code: 'INVALID_OTP', message: error?.message || 'Invalid or expired OTP.' },
        };
      }

      const { data: driverRow } = await supabase
        .from('drivers')
        .select('driver_id')
        .eq('user_id', data.user.id)
        .maybeSingle();

      return {
        ok: true,
        configured: true,
        data: {
          user_id: data.user.id,
          driver_id: driverRow?.driver_id ?? data.user.id,
        },
      };
    },

    async signOut() {
      const supabase = getSupabaseClient();
      if (!supabase) return backendNotConfigured('Signing out');
      const { error } = await supabase.auth.signOut();
      if (error) {
        return { ok: false, configured: true, error: { code: 'NETWORK_ERROR', message: error.message } };
      }
      return { ok: true, configured: true };
    },
  },

  driver: {
    async getProfile(): Promise<ServiceResult<DriverProfile | null>> {
      const supabase = getSupabaseClient();
      if (!supabase) return backendNotConfigured('Fetching driver profile');

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr || !user) {
        return {
          ok: false,
          configured: true,
          error: { code: 'UNAUTHENTICATED', message: 'Sign in with your registered driver mobile number.' },
        };
      }

      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        return { ok: false, configured: true, error: { code: 'NETWORK_ERROR', message: error.message } };
      }
      return { ok: true, configured: true, data: (data as DriverProfile | null) ?? null };
    },

    async upsertProfile(payload: DriverRegistrationPayload): Promise<ServiceResult<DriverProfile>> {
      const supabase = getSupabaseClient();
      if (!supabase) return backendNotConfigured('Saving driver personal details');

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return {
          ok: false,
          configured: true,
          error: { code: 'UNAUTHENTICATED', message: 'Authentication required before saving driver profile.' },
        };
      }

      const { error: userUpsertErr } = await supabase.from('users').upsert(
        {
          user_id: user.id,
          role: 'driver',
          phone: payload.phone,
          full_name: payload.full_name,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
      if (userUpsertErr) {
        return { ok: false, configured: true, error: { code: 'NETWORK_ERROR', message: userUpsertErr.message } };
      }

      const { data, error } = await supabase
        .from('drivers')
        .upsert(
          {
            user_id: user.id,
            full_name: payload.full_name,
            phone: payload.phone,
            email: payload.email || null,
            city: payload.city,
            date_of_birth: payload.date_of_birth,
            emergency_contact_name: payload.emergency_contact_name,
            emergency_contact_phone: payload.emergency_contact_phone,
            profile_completed: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
        .select('*')
        .single();

      if (error) {
        return { ok: false, configured: true, error: { code: 'NETWORK_ERROR', message: error.message } };
      }
      return { ok: true, configured: true, data: data as DriverProfile };
    },

    async uploadAvatar(driverId: string, file: File): Promise<ServiceResult<DriverProfile>> {
      const supabase = getSupabaseClient();
      if (!supabase) return backendNotConfigured('Uploading driver profile photo');

      const ext = (file.name.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
      const path = `${driverId}/avatar_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('driver-avatars')
        .upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' });
      if (uploadErr) {
        return { ok: false, configured: true, error: { code: 'NETWORK_ERROR', message: uploadErr.message } };
      }

      const { data: urlData } = supabase.storage.from('driver-avatars').getPublicUrl(path);
      const { data, error } = await supabase
        .from('drivers')
        .update({ avatar_url: urlData.publicUrl, updated_at: new Date().toISOString() })
        .eq('driver_id', driverId)
        .select('*')
        .single();

      if (error) {
        return { ok: false, configured: true, error: { code: 'NETWORK_ERROR', message: error.message } };
      }
      return { ok: true, configured: true, data: data as DriverProfile };
    },

    async setOnlineStatus(driverId: string, online: boolean, location?: GeoPoint): Promise<ServiceResult<DriverProfile>> {
      const supabase = getSupabaseClient();
      if (!supabase) return backendNotConfigured('Updating online/offline duty status');

      if (online) {
        const [{ data: driver }, { data: vehicle }] = await Promise.all([
          supabase.from('drivers').select('*').eq('driver_id', driverId).single(),
          supabase.from('vehicles').select('*').eq('driver_id', driverId).eq('is_active', true).maybeSingle(),
        ]);
        const gate = canDriverGoOnline(driver as DriverProfile, vehicle as VehicleRecord | null);
        if (!gate.allowed) {
          return {
            ok: false,
            configured: true,
            error: {
              code: 'NOT_APPROVED',
              message: gate.blockers[0] || 'Driver is not approved to go online.',
            },
          };
        }
        if (location) {
          await supabase.from('driver_locations').upsert(
            {
              driver_id: driverId,
              lat: location.lat,
              lng: location.lng,
              heading: location.heading ?? null,
              speed_kmh: location.speed_kmh ?? null,
              updated_at: location.recorded_at,
            },
            { onConflict: 'driver_id' }
          );
        }
      }

      const { data, error } = await supabase
        .from('drivers')
        .update({ is_online: online, updated_at: new Date().toISOString() })
        .eq('driver_id', driverId)
        .select('*')
        .single();

      if (error) {
        return { ok: false, configured: true, error: { code: 'NETWORK_ERROR', message: error.message } };
      }
      return { ok: true, configured: true, data: data as DriverProfile };
    },

    async updateLocation(driverId: string, location: GeoPoint) {
      const supabase = getSupabaseClient();
      if (!supabase) return backendNotConfigured('Syncing live GPS coordinates');
      const { error } = await supabase.from('driver_locations').upsert(
        {
          driver_id: driverId,
          lat: location.lat,
          lng: location.lng,
          heading: location.heading ?? null,
          speed_kmh: location.speed_kmh ?? null,
          updated_at: location.recorded_at,
        },
        { onConflict: 'driver_id' }
      );
      if (error) {
        return { ok: false, configured: true, error: { code: 'NETWORK_ERROR', message: error.message } };
      }
      return { ok: true, configured: true };
    },
  },

  vehicle: {
    async getActiveVehicle(driverId: string) {
      const supabase = getSupabaseClient();
      if (!supabase) return backendNotConfigured('Fetching vehicle details');
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('driver_id', driverId)
        .eq('is_active', true)
        .maybeSingle();
      if (error) {
        return { ok: false, configured: true, error: { code: 'NETWORK_ERROR', message: error.message } };
      }
      return { ok: true, configured: true, data: (data as VehicleRecord | null) ?? null };
    },

    async upsertVehicle(driverId: string, payload: VehicleUpsertPayload) {
      const supabase = getSupabaseClient();
      if (!supabase) return backendNotConfigured('Saving vehicle details');
      const { data, error } = await supabase
        .from('vehicles')
        .upsert(
          {
            driver_id: driverId,
            category: payload.category,
            make: payload.make,
            model: payload.model,
            year: payload.year,
            color: payload.color,
            registration_number: payload.registration_number.toUpperCase(),
            permit_number: payload.permit_number || null,
            insurance_expiry: payload.insurance_expiry,
            rc_expiry: payload.rc_expiry,
            is_active: true,
          },
          { onConflict: 'driver_id,registration_number' }
        )
        .select('*')
        .single();

      if (error) {
        return { ok: false, configured: true, error: { code: 'NETWORK_ERROR', message: error.message } };
      }
      const savedVehicle = data as VehicleRecord;
      await supabase
        .from('drivers')
        .update({ active_vehicle_id: savedVehicle.vehicle_id, updated_at: new Date().toISOString() })
        .eq('driver_id', driverId);

      return { ok: true, configured: true, data: savedVehicle };
    },
  },

  kyc: {
    async listDocuments(driverId: string) {
      const supabase = getSupabaseClient();
      if (!supabase) return backendNotConfigured('Loading KYC documents');
      const { data, error } = await supabase
        .from('driver_documents')
        .select('*')
        .eq('driver_id', driverId);
      if (error) {
        return { ok: false, configured: true, error: { code: 'NETWORK_ERROR', message: error.message } };
      }
      return { ok: true, configured: true, data: (data as DriverDocumentRecord[]) ?? [] };
    },

    async uploadDocument(driverId, docType, file) {
      const supabase = getSupabaseClient();
      if (!supabase) return backendNotConfigured('Uploading private KYC document');
      const path = `${driverId}/${docType}_${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from('kyc-documents').upload(path, file, {
        upsert: true,
      });
      if (uploadErr) {
        return { ok: false, configured: true, error: { code: 'NETWORK_ERROR', message: uploadErr.message } };
      }

      const { data, error } = await supabase
        .from('driver_documents')
        .upsert(
          {
            driver_id: driverId,
            document_type: docType,
            storage_path: path,
            file_name: file.name,
            status: 'pending_review',
            uploaded_at: new Date().toISOString(),
          },
          { onConflict: 'driver_id,document_type' }
        )
        .select('*')
        .single();

      if (error) {
        return { ok: false, configured: true, error: { code: 'NETWORK_ERROR', message: error.message } };
      }
      return { ok: true, configured: true, data: data as DriverDocumentRecord };
    },

    async submitForApproval(driverId: string) {
      const supabase = getSupabaseClient();
      if (!supabase) return backendNotConfigured('Submitting KYC for admin review');
      const { data, error } = await supabase
        .from('drivers')
        .update({
          documents_uploaded: true,
          kyc_status: 'under_review',
          account_status: 'pending_approval',
        })
        .eq('driver_id', driverId)
        .select('*')
        .single();
      if (error) {
        return { ok: false, configured: true, error: { code: 'NETWORK_ERROR', message: error.message } };
      }
      return { ok: true, configured: true, data: data as DriverProfile };
    },
  },

  rides: {
    subscribeOffers(driverId: string, category: VehicleCategory, onOffer: (ride: RideRecord) => void) {
      const supabase = getSupabaseClient();
      if (!supabase) return () => {};

      const channel = supabase
        .channel(`driver-offers-${driverId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'rides',
            filter: `vehicle_category=eq.${category}`,
          },
          (payload) => {
            const ride = payload.new as RideRecord;
            if (ride.status === 'offered' && !ride.driver_id) {
              onOffer(ride);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    },

    async acceptRide(rideId: string, driverId: string): Promise<ServiceResult<AcceptRideResponse>> {
      const supabase = getSupabaseClient();
      if (!supabase) return backendNotConfigured('Accepting ride atomically');

      const { data, error } = await supabase.functions.invoke('accept-ride', {
        body: { ride_id: rideId, driver_id: driverId },
      });

      if (error) {
        return {
          ok: false,
          configured: true,
          error: {
            code: error.message.includes('ALREADY_TAKEN') ? 'RIDE_ALREADY_TAKEN' : 'NETWORK_ERROR',
            message: error.message,
          },
        };
      }
      return { ok: true, configured: true, data: data as AcceptRideResponse };
    },

    async rejectRide(rideId: string, driverId: string, reason?: string) {
      const supabase = getSupabaseClient();
      if (!supabase) return backendNotConfigured('Declining ride offer');
      const { error } = await supabase.from('ride_events').insert({
        ride_id: rideId,
        actor_driver_id: driverId,
        event_type: 'driver_declined',
        metadata: { reason: reason || 'declined_by_driver' },
      });
      if (error) {
        return { ok: false, configured: true, error: { code: 'NETWORK_ERROR', message: error.message } };
      }
      return { ok: true, configured: true };
    },

    async markArrived(rideId: string, driverId: string) {
      const supabase = getSupabaseClient();
      if (!supabase) return backendNotConfigured('Updating arrival at pickup');
      const { data, error } = await supabase
        .from('rides')
        .update({ status: 'arrived' })
        .eq('ride_id', rideId)
        .eq('driver_id', driverId)
        .select('*')
        .single();
      if (error) {
        return { ok: false, configured: true, error: { code: 'NETWORK_ERROR', message: error.message } };
      }
      return { ok: true, configured: true, data: data as RideRecord };
    },

    async verifyPickupOtp(payload: VerifyPickupOtpPayload) {
      const supabase = getSupabaseClient();
      if (!supabase) return backendNotConfigured('Verifying pickup OTP');
      const { data, error } = await supabase.functions.invoke('verify-pickup-otp', {
        body: payload,
      });
      if (error || !data?.ride) {
        return {
          ok: false,
          configured: true,
          error: { code: 'INVALID_OTP', message: error?.message || 'OTP verification returned no ride state.' },
        };
      }
      return { ok: true, configured: true, data: data.ride as RideRecord };
    },

    async completeRide(payload: CompleteRidePayload) {
      const supabase = getSupabaseClient();
      if (!supabase) return backendNotConfigured('Completing ride and updating ledger');
      const { data, error } = await supabase.functions.invoke('complete-ride', {
        body: payload,
      });
      if (error || !data?.ride) {
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: error?.message || 'Ride completion returned no ride state.' },
        };
      }
      return { ok: true, configured: true, data: data.ride as RideRecord };
    },

    async cancelRide(rideId: string, driverId: string, reason: string) {
      const supabase = getSupabaseClient();
      if (!supabase) return backendNotConfigured('Cancelling active ride');
      const { data, error } = await supabase
        .from('rides')
        .update({ status: 'cancelled' })
        .eq('ride_id', rideId)
        .eq('driver_id', driverId)
        .select('*')
        .single();
      if (error) {
        return { ok: false, configured: true, error: { code: 'NETWORK_ERROR', message: error.message } };
      }
      await supabase.from('ride_events').insert({
        ride_id: rideId,
        actor_driver_id: driverId,
        event_type: 'driver_cancelled',
        metadata: { reason: reason || 'cancelled_by_driver' },
      });
      return { ok: true, configured: true, data: data as RideRecord };
    },

    async getActiveRide(driverId: string) {
      const supabase = getSupabaseClient();
      if (!supabase) return backendNotConfigured('Loading active assigned ride');
      const { data, error } = await supabase
        .from('rides')
        .select('*')
        .eq('driver_id', driverId)
        .in('status', ['accepted', 'arriving', 'arrived', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        return { ok: false, configured: true, error: { code: 'NETWORK_ERROR', message: error.message } };
      }
      return { ok: true, configured: true, data: (data as RideRecord | null) ?? null };
    },

    async getRideHistory(driverId: string) {
      const supabase = getSupabaseClient();
      if (!supabase) return backendNotConfigured('Loading ride history');
      const { data, error } = await supabase
        .from('rides')
        .select('*')
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) {
        return { ok: false, configured: true, error: { code: 'NETWORK_ERROR', message: error.message } };
      }
      return { ok: true, configured: true, data: (data as RideRecord[]) ?? [] };
    },
  },

  finance: {
    async getEarnings(driverId: string, period: EarningsSummary['period']) {
      const supabase = getSupabaseClient();
      if (!supabase) return backendNotConfigured('Loading verified earnings');
      const { data, error } = await supabase.rpc('get_driver_earnings_summary', {
        p_driver_id: driverId,
        p_period: period,
      });
      if (error) {
        return { ok: false, configured: true, error: { code: 'NETWORK_ERROR', message: error.message } };
      }
      return { ok: true, configured: true, data: data as EarningsSummary };
    },

    async getWallet(driverId: string) {
      const supabase = getSupabaseClient();
      if (!supabase) return backendNotConfigured('Loading wallet ledger');
      const { data, error } = await supabase
        .from('wallet_accounts')
        .select('*')
        .eq('driver_id', driverId)
        .maybeSingle();
      if (error) {
        return { ok: false, configured: true, error: { code: 'NETWORK_ERROR', message: error.message } };
      }
      return { ok: true, configured: true, data: (data as WalletAccount | null) ?? null };
    },

    async updatePayoutMethod(driverId: string, payload: PayoutMethodPayload) {
      const supabase = getSupabaseClient();
      if (!supabase) return backendNotConfigured('Saving bank or UPI payout account');
      const digits = (payload.bank_account_number || '').replace(/\D/g, '');
      const masked =
        digits.length >= 4
          ? `XXXX-${digits.slice(-4)}${payload.ifsc_code ? ` (${payload.ifsc_code.toUpperCase()})` : ''}`
          : undefined;
      const upsertRow: Record<string, unknown> = {
        driver_id: driverId,
        updated_at: new Date().toISOString(),
      };
      if (payload.upi_id !== undefined) {
        upsertRow.upi_id = payload.upi_id.trim() || null;
      }
      if (masked) {
        upsertRow.bank_account_masked = masked;
        upsertRow.bank_account_verified = true;
      }
      const { data, error } = await supabase
        .from('wallet_accounts')
        .upsert(upsertRow, { onConflict: 'driver_id' })
        .select('*')
        .single();
      if (error) {
        return { ok: false, configured: true, error: { code: 'NETWORK_ERROR', message: error.message } };
      }
      return { ok: true, configured: true, data: data as WalletAccount };
    },

    async getPayoutHistory(driverId: string) {
      const supabase = getSupabaseClient();
      if (!supabase) return backendNotConfigured('Loading payout history');
      const { data, error } = await supabase
        .from('payouts')
        .select('*')
        .eq('driver_id', driverId)
        .order('requested_at', { ascending: false });
      if (error) {
        return { ok: false, configured: true, error: { code: 'NETWORK_ERROR', message: error.message } };
      }
      return { ok: true, configured: true, data: (data as PayoutRecord[]) ?? [] };
    },

    async requestPayout(driverId: string, amountInr: number) {
      const supabase = getSupabaseClient();
      if (!supabase) return backendNotConfigured('Requesting bank payout');
      const { data, error } = await supabase.functions.invoke('request-driver-payout', {
        body: { driver_id: driverId, amount_inr: amountInr },
      });
      if (error) {
        return { ok: false, configured: true, error: { code: 'NETWORK_ERROR', message: error.message } };
      }
      return { ok: true, configured: true, data: data as PayoutRecord };
    },
  },

  account: {
    async getRatings(driverId: string) {
      const supabase = getSupabaseClient();
      if (!supabase) return backendNotConfigured('Loading customer ratings');
      const { data, error } = await supabase
        .from('ratings')
        .select('*, rides(pickup_address, dropoff_address)')
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false });
      if (error) {
        return { ok: false, configured: true, error: { code: 'NETWORK_ERROR', message: error.message } };
      }
      const mapped = (data ?? []).map((row: Record<string, unknown>) => {
        const rideRel = row.rides as { pickup_address?: string; dropoff_address?: string } | null;
        return {
          ...(row as unknown as DriverRatingRecord),
          pickup_address: rideRel?.pickup_address ?? null,
          dropoff_address: rideRel?.dropoff_address ?? null,
        };
      });
      return { ok: true, configured: true, data: mapped };
    },

    subscribeRatings(driverId: string, onRating: (rating: DriverRatingRecord) => void) {
      const supabase = getSupabaseClient();
      if (!supabase) return () => {};

      const channel = supabase
        .channel(`driver-ratings-${driverId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'ratings',
            filter: `driver_id=eq.${driverId}`,
          },
          (payload) => {
            onRating(payload.new as DriverRatingRecord);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    },

    async getNotifications(driverId: string) {
      const supabase = getSupabaseClient();
      if (!supabase) return backendNotConfigured('Loading notifications');
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false });
      if (error) {
        return { ok: false, configured: true, error: { code: 'NETWORK_ERROR', message: error.message } };
      }
      return { ok: true, configured: true, data: (data as DriverNotification[]) ?? [] };
    },

    subscribeNotifications(driverId: string, onNotification: (notification: DriverNotification) => void) {
      const supabase = getSupabaseClient();
      if (!supabase) return () => {};

      const channel = supabase
        .channel(`driver-notifications-${driverId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `driver_id=eq.${driverId}`,
          },
          (payload) => {
            onNotification(payload.new as DriverNotification);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    },

    async markNotificationRead(notificationId: string) {
      const supabase = getSupabaseClient();
      if (!supabase) return backendNotConfigured('Updating notification');
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('notification_id', notificationId);
      if (error) {
        return { ok: false, configured: true, error: { code: 'NETWORK_ERROR', message: error.message } };
      }
      return { ok: true, configured: true };
    },

    async markAllNotificationsRead(driverId: string) {
      const supabase = getSupabaseClient();
      if (!supabase) return backendNotConfigured('Marking all notifications read');
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('driver_id', driverId)
        .eq('read', false);
      if (error) {
        return { ok: false, configured: true, error: { code: 'NETWORK_ERROR', message: error.message } };
      }
      return { ok: true, configured: true };
    },

    async getSupportTickets(driverId: string) {
      const supabase = getSupabaseClient();
      if (!supabase) return backendNotConfigured('Loading support tickets');
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false });
      if (error) {
        return { ok: false, configured: true, error: { code: 'NETWORK_ERROR', message: error.message } };
      }
      return { ok: true, configured: true, data: (data as SupportTicket[]) ?? [] };
    },

    async createSupportTicket(driverId: string, subject: string, description: string, rideId?: string) {
      const supabase = getSupabaseClient();
      if (!supabase) return backendNotConfigured('Submitting support ticket');
      const { data, error } = await supabase
        .from('support_tickets')
        .insert({ driver_id: driverId, ride_id: rideId || null, subject, description })
        .select('*')
        .single();
      if (error) {
        return { ok: false, configured: true, error: { code: 'NETWORK_ERROR', message: error.message } };
      }
      return { ok: true, configured: true, data: data as SupportTicket };
    },

    async triggerSos(driverId: string, rideId?: string, location?: GeoPoint) {
      const supabase = getSupabaseClient();
      if (!supabase) return backendNotConfigured('Dispatching Emergency SOS alert');
      const { data, error } = await supabase
        .from('sos_alerts')
        .insert({
          driver_id: driverId,
          ride_id: rideId || null,
          lat: location?.lat ?? null,
          lng: location?.lng ?? null,
          status: 'triggered',
        })
        .select('*')
        .single();
      if (error) {
        return { ok: false, configured: true, error: { code: 'NETWORK_ERROR', message: error.message } };
      }
      return { ok: true, configured: true, data: data as SosAlertRecord };
    },
  },
};
