import React, { useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  MapPin,
  Navigation,
  Phone,
  Share2,
  ShieldAlert,
  Star,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { PrimaryButton, ScreenHeader, StateNotice } from '../components/UiPrimitives';
import { mapsProviderAdapter } from '../services/adapters/externalAdapters';
import { driverBackendService } from '../services/driverBackendService';
import { useDriverApp } from '../state/DriverAppContext';

const CANCEL_REASONS = [
  'Customer requested cancellation',
  'Unable to reach pickup point / heavy blockage',
  'Vehicle mechanical issue / puncture',
  'Rider did not arrive after waiting',
] as const;

function buildOsmEmbedUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/export/embed.html?bbox=${(lng - 0.012).toFixed(
    5
  )}%2C${(lat - 0.012).toFixed(5)}%2C${(lng + 0.012).toFixed(5)}%2C${(lat + 0.012).toFixed(
    5
  )}&layer=mapnik&marker=${lat.toFixed(5)}%2C${lng.toFixed(5)}`;
}

const CancelRideDrawer: React.FC<{
  rideId: string;
  driverId: string;
  onCancelled: () => Promise<void>;
}> = ({ rideId, driverId, onCancelled }) => {
  const { setFeedback } = useDriverApp();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(CANCEL_REASONS[0]);
  const [busy, setBusy] = useState(false);

  const handleConfirmCancel = async () => {
    setBusy(true);
    const res = await driverBackendService.rides.cancelRide(rideId, driverId, reason);
    setBusy(false);
    if (!res.ok) {
      setFeedback({
        type: 'error',
        title: 'Cancellation Failed',
        message: res.error?.message || 'Unable to cancel active ride.',
      });
      return;
    }
    setOpen(false);
    setFeedback({
      type: 'info',
      title: 'Ride Cancelled',
      message: `Cancellation logged with reason: ${reason}`,
    });
    await onCancelled();
  };

  if (!open) {
    return (
      <PrimaryButton variant="outline" onClick={() => setOpen(true)}>
        <XCircle className="h-4 w-4 text-red-600" />
        Cancel Ride
      </PrimaryButton>
    );
  }

  return (
    <div className="mt-4 space-y-3 rounded-2xl border border-red-200 bg-red-50/60 p-4 dark:border-red-900/50 dark:bg-red-950/20">
      <p className="text-xs font-bold text-red-700 dark:text-red-300">
        Select Cancellation Reason
      </p>
      <div className="space-y-1.5">
        {CANCEL_REASONS.map((opt) => (
          <label
            key={opt}
            className="flex min-h-[38px] cursor-pointer items-center gap-2.5 rounded-xl bg-white px-3 py-2 text-xs font-medium dark:bg-[#14161A]"
          >
            <input
              type="radio"
              name={`cancel-reason-${rideId}`}
              checked={reason === opt}
              onChange={() => setReason(opt)}
              className="accent-red-600"
            />
            <span>{opt}</span>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <PrimaryButton
          variant="danger"
          disabled={busy}
          onClick={() => void handleConfirmCancel()}
        >
          {busy ? 'Cancelling…' : 'Confirm Cancel Ride'}
        </PrimaryButton>
        <PrimaryButton variant="outline" onClick={() => setOpen(false)}>
          Keep Ride
        </PrimaryButton>
      </div>
    </div>
  );
};

export const PickupNavigationScreen: React.FC = () => {
  const {
    activeRide,
    setActiveRide,
    driverProfile,
    liveLocation,
    requestGpsFix,
    refreshDriverWorkspace,
    setFeedback,
    navigate,
  } = useDriverApp();
  const mapsReady = mapsProviderAdapter.isConfigured();
  const [arriving, setArriving] = useState(false);

  const handleMarkArrived = async () => {
    if (!activeRide || !driverProfile) {
      setFeedback({
        type: 'error',
        title: 'No Active Assigned Ride',
        message: 'Arrival updates require an active ride accepted via the shared backend.',
      });
      return;
    }
    setArriving(true);
    const res = await driverBackendService.rides.markArrived(
      activeRide.ride_id,
      driverProfile.driver_id
    );
    setArriving(false);
    if (!res.ok) {
      setFeedback({
        type: 'error',
        title: 'Status Update Failed',
        message: res.error?.message || 'Unable to mark arrival.',
      });
      return;
    }
    if (res.data) setActiveRide(res.data);
    navigate('pickup_otp');
  };

  return (
    <div className="space-y-4">
      <ScreenHeader
        title="Pickup Navigation"
        subtitle="Route to customer pickup point using real maps and GPS"
        action={
          <PrimaryButton variant="outline" onClick={() => void requestGpsFix()}>
            <Navigation className="h-4 w-4" />
            Sync GPS
          </PrimaryButton>
        }
      />

      {!mapsReady && (
        <StateNotice
          variant="unconfigured"
          title="Google Maps Embedded Navigation Not Configured"
          description="Turn-by-turn external Maps routing and OpenStreetMap viewport preview remain active for every assigned ride."
          missingEnvVars={['VITE_GOOGLE_MAPS_API_KEY']}
        />
      )}

      {!activeRide ? (
        <StateNotice
          variant="empty"
          title="No Assigned Pickup Route"
          description="Pickup navigation populates strictly from an accepted backend ride (pickup_lat, pickup_lng, pickup_address). No simulated map pins or fake routes are rendered."
          actionLabel="View Customer Details Screen"
          onAction={() => navigate('customer_details')}
        />
      ) : (
        <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#14161A]">
          <div className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
            <iframe
              title="Customer Pickup Map"
              src={buildOsmEmbedUrl(activeRide.pickup_lat, activeRide.pickup_lng)}
              className="h-48 w-full border-0"
            />
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-neutral-500">Pickup Address</p>
              <p className="mt-1 text-base font-bold">{activeRide.pickup_address}</p>
              <p className="font-mono-num mt-1 text-xs text-neutral-500">
                Target: {activeRide.pickup_lat.toFixed(5)}, {activeRide.pickup_lng.toFixed(5)}
                {liveLocation
                  ? ` · GPS: ${liveLocation.lat.toFixed(5)}, ${liveLocation.lng.toFixed(5)}`
                  : ''}
              </p>
            </div>
            <MapPin className="h-6 w-6 shrink-0 text-[#FFC928]" />
          </div>

          <div className="flex flex-wrap gap-2.5">
            <a
              href={mapsProviderAdapter.openExternalTurnByTurn(
                activeRide.pickup_lat,
                activeRide.pickup_lng,
                activeRide.pickup_address
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-300 px-3.5 text-xs font-semibold hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              <span>Turn-by-Turn Maps</span>
              <ExternalLink className="h-4 w-4" />
            </a>
            {activeRide.customer?.masked_phone && (
              <a
                href={`tel:${activeRide.customer.masked_phone}`}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-300 px-3.5 text-xs font-semibold dark:border-neutral-700"
              >
                <Phone className="h-4 w-4 text-[#FFC928]" />
                Call Rider
              </a>
            )}
            <PrimaryButton variant="brand" disabled={arriving} onClick={() => void handleMarkArrived()}>
              {arriving ? 'Updating…' : 'Arrived at Pickup'}
            </PrimaryButton>
            {driverProfile && (
              <CancelRideDrawer
                rideId={activeRide.ride_id}
                driverId={driverProfile.driver_id}
                onCancelled={async () => {
                  setActiveRide(null);
                  await refreshDriverWorkspace();
                  navigate('dashboard');
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const CustomerDetailsScreen: React.FC = () => {
  const { activeRide, navigate } = useDriverApp();

  return (
    <div className="space-y-4">
      <ScreenHeader
        title="Customer Details"
        subtitle="Shared customer identity & pickup instructions for assigned ride"
      />

      {!activeRide?.customer ? (
        <StateNotice
          variant="empty"
          title="No Assigned Customer"
          description="Customer details (name, masked phone, rating, pickup instructions) are visible strictly after a real ride is atomically assigned to you."
          actionLabel="Proceed to Pickup OTP Screen"
          onAction={() => navigate('pickup_otp')}
        />
      ) : (
        <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-[#14161A]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#111111] text-[#FFC928]">
                <UserCheck className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold">
                  {activeRide.customer.display_name}
                </h2>
                <p className="font-mono-num flex items-center gap-2 text-xs text-neutral-500">
                  <span>ID: {activeRide.customer.customer_id}</span>
                  {activeRide.customer.rating != null && (
                    <span className="inline-flex items-center gap-1 font-bold text-[#111111] dark:text-[#FFC928]">
                      <Star className="h-3.5 w-3.5 fill-[#FFC928] text-[#FFC928]" />
                      {activeRide.customer.rating.toFixed(1)}
                    </span>
                  )}
                </p>
              </div>
            </div>
            {activeRide.customer.masked_phone && (
              <a
                href={`tel:${activeRide.customer.masked_phone}`}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#FFC928] px-4 text-xs font-bold text-[#111111]"
              >
                <Phone className="h-4 w-4" />
                Call Customer
              </a>
            )}
          </div>

          <div className="space-y-2 rounded-xl bg-[#F7F8FA] p-3.5 text-xs dark:bg-[#1A1D23]">
            <p>
              <span className="font-semibold text-neutral-500">Pickup: </span>
              <span className="font-semibold">{activeRide.pickup_address}</span>
            </p>
            <p>
              <span className="font-semibold text-neutral-500">Dropoff: </span>
              <span className="font-semibold">{activeRide.dropoff_address}</span>
            </p>
            <p className="font-mono-num text-neutral-500">
              {activeRide.estimated_distance_km} km · {activeRide.estimated_duration_min} min ·{' '}
              {activeRide.payment_mode.toUpperCase()} · ₹{activeRide.estimated_fare_inr.toFixed(0)}
            </p>
          </div>

          {activeRide.customer.pickup_note && (
            <p className="rounded-xl border border-[#FFC928]/40 bg-[#FFC928]/10 p-3 text-xs font-medium text-neutral-800 dark:text-neutral-200">
              Pickup note: {activeRide.customer.pickup_note}
            </p>
          )}

          <div className="flex flex-wrap gap-2.5">
            <PrimaryButton variant="outline" onClick={() => navigate('pickup_navigation')}>
              <MapPin className="h-4 w-4" />
              Pickup Map
            </PrimaryButton>
            <PrimaryButton variant="brand" onClick={() => navigate('pickup_otp')}>
              <KeyRound className="h-4 w-4" />
              Enter Pickup OTP
            </PrimaryButton>
          </div>
        </div>
      )}
    </div>
  );
};

export const PickupOtpScreen: React.FC = () => {
  const {
    backendConfigured,
    activeRide,
    setActiveRide,
    driverProfile,
    setFeedback,
    navigate,
  } = useDriverApp();
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 4) {
      setFeedback({
        type: 'error',
        title: '4-Digit OTP Required',
        message: 'Ask the customer for their 4-digit SHINE CAPTAIN ride start PIN.',
      });
      return;
    }

    if (!backendConfigured || !activeRide || !driverProfile) {
      setFeedback({
        type: 'error',
        title: 'Backend Verification Required',
        message:
          'Pickup OTP validation executes server-side via the verify-pickup-otp Edge Function against pickup_otp_hash.',
        missingEnvVars: backendConfigured ? undefined : ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
      });
      return;
    }

    setVerifying(true);
    const res = await driverBackendService.rides.verifyPickupOtp({
      ride_id: activeRide.ride_id,
      driver_id: driverProfile.driver_id,
      otp_code: otp,
    });
    setVerifying(false);

    if (!res.ok) {
      setFeedback({
        type: 'error',
        title: 'OTP Verification Failed',
        message: res.error?.message || 'Incorrect pickup OTP.',
      });
      return;
    }
    if (res.data) setActiveRide(res.data);
    navigate('active_ride');
  };

  return (
    <div className="space-y-4">
      <ScreenHeader
        title="Pickup OTP Verification"
        subtitle="Verify the customer's 4-digit PIN before starting the trip"
      />

      <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-[#14161A]">
        <form onSubmit={handleVerify} className="max-w-sm space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <KeyRound className="h-4 w-4 text-[#FFC928]" />
            <span>Customer Ride PIN</span>
          </div>
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            placeholder="••••"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            className="font-mono-num min-h-[54px] w-full rounded-xl border border-neutral-300 bg-neutral-50 px-4 text-center text-2xl font-bold tracking-[0.5em] outline-none focus:border-[#FFC928] dark:border-neutral-700 dark:bg-[#1A1D23]"
          />
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Validated strictly on the backend Edge Function (`verify-pickup-otp`). Rides cannot
            transition to `in_progress` without verified OTP.
          </p>
          <PrimaryButton type="submit" variant="brand" disabled={verifying} className="w-full">
            {verifying ? 'Verifying PIN…' : 'Verify OTP & Start Ride'}
          </PrimaryButton>
        </form>
      </div>
    </div>
  );
};

export const ActiveRideScreen: React.FC = () => {
  const {
    activeRide,
    setActiveRide,
    setLastCompletedRide,
    driverProfile,
    liveLocation,
    setFeedback,
    refreshDriverWorkspace,
    navigate,
  } = useDriverApp();
  const [completing, setCompleting] = useState(false);

  const handleShareTrip = async () => {
    if (!activeRide) return;
    const gpsText = liveLocation
      ? `https://maps.google.com/?q=${liveLocation.lat.toFixed(5)},${liveLocation.lng.toFixed(5)}`
      : `https://maps.google.com/?q=${activeRide.dropoff_lat.toFixed(5)},${activeRide.dropoff_lng.toFixed(5)}`;
    const shareText = `SHINE CAB Live Trip (${activeRide.ride_id})\nFrom: ${activeRide.pickup_address}\nTo: ${activeRide.dropoff_address}\nTrack GPS: ${gpsText}`;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'SHINE CAB Live Trip', text: shareText });
        return;
      } catch {
        // User cancelled or share unsupported, fall back to clipboard
      }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareText);
        setFeedback({
          type: 'success',
          title: 'Trip Link Copied',
          message: 'Live trip status & GPS coordinates copied to clipboard.',
        });
        return;
      } catch {
        // Clipboard permission denied in embedded browser context
      }
    }
    setFeedback({
      type: 'info',
      title: 'Live Trip Coordinates',
      message: gpsText,
    });
  };

  const handleCompleteRide = async () => {
    if (!activeRide || !driverProfile) {
      setFeedback({
        type: 'error',
        title: 'No Active In-Progress Ride',
        message: 'Only rides with verified pickup OTP in `in_progress` status can be completed.',
      });
      return;
    }

    setCompleting(true);
    const res = await driverBackendService.rides.completeRide({
      ride_id: activeRide.ride_id,
      driver_id: driverProfile.driver_id,
      actual_distance_km: activeRide.estimated_distance_km,
      actual_duration_min: activeRide.estimated_duration_min,
    });
    setCompleting(false);

    if (!res.ok) {
      setFeedback({
        type: 'error',
        title: 'Completion Blocked',
        message: res.error?.message || 'Unable to complete ride.',
      });
      return;
    }
    if (res.data) setLastCompletedRide(res.data);
    setActiveRide(null);
    await refreshDriverWorkspace();
    navigate('ride_completion');
  };

  return (
    <div className="space-y-4">
      <ScreenHeader
        title="Active Ride Screen"
        subtitle="Trip telemetry, dropoff guidance, and emergency safety control"
        action={
          <PrimaryButton variant="danger" onClick={() => navigate('emergency_sos')}>
            <ShieldAlert className="h-4 w-4" />
            SOS
          </PrimaryButton>
        }
      />

      {!activeRide ? (
        <StateNotice
          variant="empty"
          title="No Ride Currently In Progress"
          description="Active trip telemetry appears once a pickup OTP is verified on the backend."
          actionLabel="View Ride Completion Layout"
          onAction={() => navigate('ride_completion')}
        />
      ) : (
        <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#14161A]">
          <div className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
            <iframe
              title="Dropoff Navigation Map"
              src={buildOsmEmbedUrl(activeRide.dropoff_lat, activeRide.dropoff_lng)}
              className="h-48 w-full border-0"
            />
          </div>

          <div>
            <p className="text-xs font-semibold text-neutral-500">Dropoff Destination</p>
            <p className="mt-1 text-base font-bold">{activeRide.dropoff_address}</p>
            <p className="font-mono-num mt-1.5 text-xs text-neutral-500">
              Fare: ₹{activeRide.estimated_fare_inr.toFixed(2)} ·{' '}
              {activeRide.payment_mode.toUpperCase()} · {activeRide.estimated_distance_km} km
              {liveLocation ? ` · GPS ${liveLocation.lat.toFixed(4)}, ${liveLocation.lng.toFixed(4)}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href={mapsProviderAdapter.openExternalTurnByTurn(
                activeRide.dropoff_lat,
                activeRide.dropoff_lng,
                activeRide.dropoff_address
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-neutral-300 px-3.5 text-xs font-semibold dark:border-neutral-700"
            >
              Turn-by-Turn Maps
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            {activeRide.customer?.masked_phone && (
              <a
                href={`tel:${activeRide.customer.masked_phone}`}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-neutral-300 px-3.5 text-xs font-semibold dark:border-neutral-700"
              >
                <Phone className="h-3.5 w-3.5 text-[#FFC928]" />
                Call Rider
              </a>
            )}
            <PrimaryButton variant="outline" onClick={() => void handleShareTrip()}>
              <Share2 className="h-3.5 w-3.5" />
              Share Trip
            </PrimaryButton>
          </div>

          <PrimaryButton
            variant="brand"
            className="w-full"
            disabled={completing}
            onClick={() => void handleCompleteRide()}
          >
            {completing ? 'Finalizing Ledger…' : 'Complete Ride & Settle Fare'}
          </PrimaryButton>

          {driverProfile && (
            <CancelRideDrawer
              rideId={activeRide.ride_id}
              driverId={driverProfile.driver_id}
              onCancelled={async () => {
                setActiveRide(null);
                await refreshDriverWorkspace();
                navigate('dashboard');
              }}
            />
          )}
        </div>
      )}
    </div>
  );
};

export const RideCompletionScreen: React.FC = () => {
  const { lastCompletedRide, rideHistory, navigate } = useDriverApp();
  const latestCompleted = lastCompletedRide || rideHistory.find((r) => r.status === 'completed');

  const finalFare = latestCompleted?.final_fare_inr ?? latestCompleted?.estimated_fare_inr ?? 0;
  const isCash = latestCompleted?.payment_mode === 'cash';

  return (
    <div className="space-y-4">
      <ScreenHeader
        title="Ride Completion & Fare Summary"
        subtitle="Server-calculated fare, commission, and net driver payout"
      />

      {!latestCompleted ? (
        <StateNotice
          variant="empty"
          title="No Verified Completed Ride Summary"
          description="Fare breakdowns, commission deductions, and cash collection confirmations are populated exclusively from the complete-ride Edge Function."
          actionLabel="Go to Earnings Dashboard"
          onAction={() => navigate('earnings')}
        />
      ) : (
        <div className="space-y-4">
          {/* Payment Collection Prompt */}
          <div
            className={`rounded-2xl border p-4 ${
              isCash
                ? 'border-[#FFC928] bg-[#FFC928]/15 text-[#111111] dark:text-white'
                : 'border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200'
            }`}
          >
            <div className="flex items-center gap-3">
              {isCash ? (
                <Banknote className="h-6 w-6 shrink-0 text-[#111111] dark:text-[#FFC928]" />
              ) : (
                <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
              )}
              <div>
                <p className="text-sm font-extrabold">
                  {isCash
                    ? `Collect ₹${finalFare.toFixed(2)} Cash from Customer`
                    : `Paid Online (${latestCompleted.payment_mode.replace('_', ' ').toUpperCase()})`}
                </p>
                <p className="text-xs opacity-80">
                  {isCash
                    ? 'Net earnings & platform commission due updated in Partner Wallet.'
                    : 'Net driver payout credited directly to your wallet balance.'}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-[#14161A]">
            <p className="font-mono-num text-xs text-neutral-500">
              Ride {latestCompleted.ride_id} · {latestCompleted.estimated_distance_km} km ·{' '}
              {latestCompleted.estimated_duration_min} min
            </p>
            <div className="mt-3 space-y-1 text-xs">
              <p className="truncate font-semibold">From: {latestCompleted.pickup_address}</p>
              <p className="truncate text-neutral-600 dark:text-neutral-300">
                To: {latestCompleted.dropoff_address}
              </p>
            </div>
            <div className="mt-4 space-y-2.5 border-t border-neutral-200 pt-3.5 text-sm dark:border-neutral-800">
              <div className="flex justify-between">
                <span className="text-neutral-600 dark:text-neutral-400">Final Gross Fare</span>
                <span className="font-mono-num font-semibold">₹{finalFare.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600 dark:text-neutral-400">Platform Commission</span>
                <span className="font-mono-num text-red-600 dark:text-red-400">
                  -₹{(latestCompleted.commission_inr ?? 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between border-t border-neutral-200 pt-2.5 text-base font-bold dark:border-neutral-800">
                <span>Net Driver Earnings</span>
                <span className="font-mono-num text-emerald-700 dark:text-emerald-400">
                  ₹{(latestCompleted.driver_net_inr ?? finalFare).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <PrimaryButton variant="brand" className="flex-1" onClick={() => navigate('dashboard')}>
                Back to Home Cockpit
              </PrimaryButton>
              <PrimaryButton variant="outline" onClick={() => navigate('earnings')}>
                Earnings
              </PrimaryButton>
              <PrimaryButton variant="outline" onClick={() => navigate('ride_history')}>
                History
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
