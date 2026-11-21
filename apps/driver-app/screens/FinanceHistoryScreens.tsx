import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  HelpCircle,
  IndianRupee,
  Landmark,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { PrimaryButton, ScreenHeader, StateNotice } from '../components/UiPrimitives';
import { validateIfscCode, validateUpiId } from '../contracts/validators';
import { payoutProviderAdapter, razorpayAdapter } from '../services/adapters/externalAdapters';
import { driverBackendService } from '../services/driverBackendService';
import { useDriverApp } from '../state/DriverAppContext';

export const EarningsScreen: React.FC = () => {
  const {
    backendConfigured,
    loading,
    driverProfile,
    earningsPeriod,
    setEarningsPeriod,
    earnings,
    wallet,
    rideHistory,
    refreshDriverWorkspace,
    navigate,
  } = useDriverApp();

  const completedRides = rideHistory.filter((r) => r.status === 'completed');
  const recentCompleted = completedRides.slice(0, 4);

  const gross = earnings?.gross_fare_inr ?? 0;
  const cashSharePct = gross > 0 ? Math.round(((earnings?.cash_collected_inr ?? 0) / gross) * 100) : 0;
  const onlineSharePct = gross > 0 ? 100 - cashSharePct : 0;
  const avgPerRide =
    earnings && earnings.completed_rides > 0
      ? earnings.net_earnings_inr / earnings.completed_rides
      : null;
  const avgPerHour =
    earnings && earnings.online_hours > 0
      ? earnings.net_earnings_inr / earnings.online_hours
      : null;

  return (
    <div className="space-y-4">
      {/* 1. OBSIDIAN & SHINE YELLOW EARNINGS HERO */}
      <section className="rounded-3xl bg-[#111111] p-4 text-white shadow-sm dark:border dark:border-neutral-800 dark:bg-[#14161A]">
        <div className="flex flex-col gap-3.5">
          <div>
            <p className="text-xs font-semibold tracking-wider text-[#FFC928]">
              SHINE CAPTAIN LEDGER · {earningsPeriod.toUpperCase()}
            </p>
            <div className="mt-1.5 flex items-baseline gap-2.5">
              <h1 className="font-mono-num text-3xl font-extrabold tracking-tight text-white">
                {earnings ? `₹${earnings.net_earnings_inr.toFixed(2)}` : '₹—'}
              </h1>
              <span className="text-xs font-medium text-neutral-400">Net Take-Home</span>
            </div>
            <p className="mt-1 text-xs text-neutral-400">
              {driverProfile
                ? `${driverProfile.full_name} · Reconciled from verified completed rides`
                : 'Reconciled strictly from PostgreSQL completed trips'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl bg-[#1B1E24] p-1">
              {(['daily', 'weekly', 'monthly'] as const).map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => setEarningsPeriod(period)}
                  className={`min-h-[36px] rounded-lg px-3 text-xs font-semibold capitalize transition-colors ${
                    earningsPeriod === period
                      ? 'bg-[#FFC928] text-[#111111]'
                      : 'text-neutral-300 hover:text-white'
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void refreshDriverWorkspace()}
              disabled={loading}
              aria-label="Refresh earnings ledger"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-neutral-700 bg-[#1B1E24] text-white hover:border-neutral-500"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Hero Summary Strip */}
        <div className="mt-4 grid grid-cols-2 gap-3.5 border-t border-neutral-800 pt-3.5">
          <div>
            <p className="text-[11px] text-neutral-400">Gross Fare</p>
            <p className="font-mono-num mt-0.5 text-lg font-bold text-white">
              {earnings ? `₹${earnings.gross_fare_inr.toFixed(2)}` : '—'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-neutral-400">Platform Commission</p>
            <p className="font-mono-num mt-0.5 text-lg font-bold text-red-400">
              {earnings ? `-₹${earnings.platform_commission_inr.toFixed(2)}` : '—'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-neutral-400">Completed Trips</p>
            <p className="font-mono-num mt-0.5 text-lg font-bold text-white">
              {earnings ? earnings.completed_rides : '—'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-neutral-400">Online Hours</p>
            <p className="font-mono-num mt-0.5 text-lg font-bold text-[#FFC928]">
              {earnings ? `${earnings.online_hours.toFixed(1)} hrs` : '—'}
            </p>
          </div>
        </div>
      </section>

      {!backendConfigured && (
        <StateNotice
          variant="unconfigured"
          title="Earnings Ledger Requires Backend Connection"
          description="SHINE CAPTAIN never invents trip fares, commissions, or net payouts. Verified accounting figures populate from PostgreSQL (`get_driver_earnings_summary`) once rides are completed."
          missingEnvVars={['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']}
          actionLabel="Open Wallet & Payouts"
          onAction={() => navigate('wallet')}
        />
      )}

      {/* 2. MOBILE FINANCIAL STATEMENT & WALLET SNAPSHOT */}
      <div className="space-y-4">
        {/* Detailed Fare & Payment Statement */}
        <section className="flex flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#14161A]">
          <div>
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3 dark:border-neutral-800">
              <div>
                <h2 className="font-display text-base font-bold">
                  Fare &amp; Commission Statement
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Server-verified accounting breakdown ({earningsPeriod})
                </p>
              </div>
              <TrendingUp className="h-4 w-4 text-[#FFC928]" />
            </div>

            <div className="mt-2 divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
              <div className="flex items-center justify-between py-3">
                <span className="text-neutral-600 dark:text-neutral-300">Gross Customer Fares</span>
                <span className="font-mono-num font-semibold">
                  {earnings ? `₹${earnings.gross_fare_inr.toFixed(2)}` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-neutral-600 dark:text-neutral-300">
                  Platform Service Commission
                </span>
                <span className="font-mono-num font-semibold text-red-600 dark:text-red-400">
                  {earnings ? `-₹${earnings.platform_commission_inr.toFixed(2)}` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="font-semibold text-[#111111] dark:text-white">
                  Net Driver Earnings
                </span>
                <span className="font-mono-num text-base font-extrabold text-emerald-700 dark:text-emerald-400">
                  {earnings ? `₹${earnings.net_earnings_inr.toFixed(2)}` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-neutral-600 dark:text-neutral-300">
                  Cash Collected Directly
                </span>
                <span className="font-mono-num font-semibold">
                  {earnings ? `₹${earnings.cash_collected_inr.toFixed(2)}` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-neutral-600 dark:text-neutral-300">
                  Online / UPI Ride Payments
                </span>
                <span className="font-mono-num font-semibold">
                  {earnings ? `₹${earnings.online_payments_inr.toFixed(2)}` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-neutral-600 dark:text-neutral-300">
                  Avg. Net per Trip · Avg. per Hour
                </span>
                <span className="font-mono-num font-semibold">
                  {avgPerRide !== null ? `₹${avgPerRide.toFixed(0)}` : '—'} ·{' '}
                  {avgPerHour !== null ? `₹${avgPerHour.toFixed(0)}/hr` : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Channel Split Bar */}
          <div className="mt-5 rounded-xl bg-[#F7F8FA] p-4 dark:bg-[#1A1D23]">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span>Payment Mix (Online vs Cash)</span>
              <span className="font-mono-num text-neutral-500">
                {gross > 0 ? `${onlineSharePct}% Online · ${cashSharePct}% Cash` : 'No recorded rides'}
              </span>
            </div>
            <div className="mt-2.5 flex h-2.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
              {gross > 0 && (
                <>
                  <div
                    style={{ width: `${onlineSharePct}%` }}
                    className="bg-emerald-600 transition-all"
                  />
                  <div
                    style={{ width: `${cashSharePct}%` }}
                    className="bg-[#FFC928] transition-all"
                  />
                </>
              )}
            </div>
          </div>
        </section>

        {/* Wallet Settlement & Recent Completed Trips */}
        <section className="flex flex-col justify-between gap-4">
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-[#14161A]">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3 dark:border-neutral-800">
              <div>
                <h2 className="font-display text-base font-bold">Wallet &amp; Settlement</h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {wallet?.bank_account_verified
                    ? `Verified Bank: ${wallet.bank_account_masked}`
                    : 'Bank / UPI payout account'}
                </p>
              </div>
              <Wallet className="h-4 w-4 text-[#FFC928]" />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[#F7F8FA] p-3.5 dark:bg-[#1A1D23]">
                <p className="text-[11px] text-neutral-500">Available</p>
                <p className="font-mono-num mt-1 text-lg font-extrabold">
                  {wallet ? `₹${wallet.available_balance_inr.toFixed(2)}` : '—'}
                </p>
              </div>
              <div className="rounded-xl bg-[#F7F8FA] p-3.5 dark:bg-[#1A1D23]">
                <p className="text-[11px] text-neutral-500">Cash Dues</p>
                <p className="font-mono-num mt-1 text-lg font-extrabold text-amber-700 dark:text-[#FFC928]">
                  {wallet ? `₹${wallet.cash_commission_due_inr.toFixed(2)}` : '—'}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <PrimaryButton variant="brand" className="flex-1" onClick={() => navigate('wallet')}>
                Manage Wallet
                <ArrowUpRight className="h-4 w-4" />
              </PrimaryButton>
              <PrimaryButton
                variant="outline"
                className="flex-1"
                onClick={() => navigate('payout_history')}
              >
                Payout Log
              </PrimaryButton>
            </div>
          </div>

          <div className="flex-1 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-[#14161A]">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3 dark:border-neutral-800">
              <h2 className="font-display text-base font-bold">Recent Settled Trips</h2>
              <button
                type="button"
                onClick={() => navigate('ride_history')}
                className="text-xs font-semibold text-neutral-600 hover:underline dark:text-neutral-300"
              >
                All Rides →
              </button>
            </div>

            {recentCompleted.length === 0 ? (
              <div className="py-6 text-center">
                <IndianRupee className="mx-auto h-6 w-6 text-neutral-400" />
                <p className="mt-2 text-xs font-semibold">No Completed Rides Yet</p>
                <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                  Trip-level net earnings appear after rides complete on the backend.
                </p>
              </div>
            ) : (
              <div className="mt-2 divide-y divide-neutral-200 dark:divide-neutral-800">
                {recentCompleted.map((ride) => (
                  <div key={ride.ride_id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">
                        {ride.pickup_address} → {ride.dropoff_address}
                      </p>
                      <p className="font-mono-num text-[11px] text-neutral-500">
                        {ride.completed_at
                          ? new Date(ride.completed_at).toLocaleDateString()
                          : ''}{' '}
                        · {ride.payment_mode.toUpperCase()}
                      </p>
                    </div>
                    <span className="font-mono-num shrink-0 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                      +₹{(ride.driver_net_inr ?? ride.estimated_fare_inr).toFixed(0)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export const WalletScreen: React.FC = () => {
  const {
    backendConfigured,
    loading,
    driverProfile,
    wallet,
    setWallet,
    payouts,
    rideHistory,
    refreshDriverWorkspace,
    setFeedback,
    navigate,
  } = useDriverApp();
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutChannel, setPayoutChannel] = useState<'bank' | 'upi'>('bank');
  const [busy, setBusy] = useState(false);
  const [settlingDues, setSettlingDues] = useState(false);

  const [upiId, setUpiId] = useState(wallet?.upi_id ?? '');
  const [holderName, setHolderName] = useState(driverProfile?.full_name ?? '');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);

  const withdrawInputRef = useRef<HTMLInputElement | null>(null);
  const bankSectionRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (wallet?.upi_id) setUpiId(wallet.upi_id);
  }, [wallet?.upi_id]);

  useEffect(() => {
    if (driverProfile?.full_name && !holderName) {
      setHolderName(driverProfile.full_name);
    }
  }, [driverProfile?.full_name, holderName]);

  const recentLedgerEntries = useMemo(() => {
    const payoutItems = payouts.map((p) => ({
      id: p.payout_id,
      kind: 'payout' as const,
      title: `Withdrawal · ${p.destination_label}`,
      subtitle: `${p.status.toUpperCase()}${p.provider_reference ? ` · UTR ${p.provider_reference}` : ''}`,
      amount: -p.amount_inr,
      date: p.settled_at || p.requested_at,
      status: p.status,
    }));

    const rideItems = rideHistory
      .filter((r) => r.status === 'completed')
      .slice(0, 6)
      .map((r) => ({
        id: r.ride_id,
        kind: 'ride' as const,
        title: `${r.payment_mode === 'cash' ? 'Cash Trip' : 'Online Credit'} · ${r.pickup_address}`,
        subtitle: `Ride ${r.ride_id} · ${r.payment_mode.replace('_', ' ').toUpperCase()}`,
        amount: r.driver_net_inr ?? r.final_fare_inr ?? r.estimated_fare_inr,
        date: r.completed_at || r.created_at,
        status: r.payment_status,
      }));

    return [...payoutItems, ...rideItems]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8);
  }, [payouts, rideHistory]);

  const netWithdrawableInr = wallet
    ? Math.max(0, wallet.available_balance_inr - wallet.cash_commission_due_inr)
    : null;

  const hasLinkedDestination = Boolean(wallet?.bank_account_verified || wallet?.upi_id);

  const handleSavePayoutAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedUpi = upiId.trim();
    const cleanedAcct = accountNumber.replace(/\D/g, '');
    const cleanedIfsc = ifscCode.trim().toUpperCase();

    if (!cleanedUpi && !cleanedAcct) {
      setFeedback({
        type: 'error',
        title: 'UPI or Bank Details Required',
        message: 'Enter a valid UPI ID (e.g. name@okaxis) or bank account number + IFSC code.',
      });
      return;
    }

    if (cleanedUpi && !validateUpiId(cleanedUpi)) {
      setFeedback({
        type: 'error',
        title: 'Invalid UPI ID',
        message: 'Enter a valid UPI handle such as ramesh@okicici or 9876543210@ybl.',
      });
      return;
    }

    if (cleanedAcct && (cleanedAcct.length < 9 || !validateIfscCode(cleanedIfsc))) {
      setFeedback({
        type: 'error',
        title: 'Invalid Bank Account or IFSC',
        message: 'Bank account must be 9+ digits with a valid 11-character IFSC code (e.g. SBIN0001234).',
      });
      return;
    }

    if (cleanedAcct && holderName.trim().length < 2) {
      setFeedback({
        type: 'error',
        title: 'Account Holder Name Required',
        message: 'Enter the account holder full name matching your bank passbook.',
      });
      return;
    }

    if (!driverProfile || !backendConfigured) {
      setFeedback({
        type: 'error',
        title: 'Backend Sign-In Required',
        message: 'Bank & UPI payout accounts are stored securely in wallet_accounts after OTP sign-in.',
        missingEnvVars: backendConfigured ? undefined : ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
      });
      return;
    }

    setSavingAccount(true);
    const res = await driverBackendService.finance.updatePayoutMethod(driverProfile.driver_id, {
      upi_id: cleanedUpi || undefined,
      account_holder_name: holderName.trim() || undefined,
      bank_account_number: cleanedAcct || undefined,
      ifsc_code: cleanedIfsc || undefined,
    });
    setSavingAccount(false);

    if (!res.ok) {
      setFeedback({
        type: 'error',
        title: 'Unable to Save Payout Method',
        message: res.error?.message || 'Could not update bank/UPI details.',
      });
      return;
    }

    if (res.data) setWallet(res.data);
    setAccountNumber('');
    setIfscCode('');
    setFeedback({
      type: 'success',
      title: 'Bank / UPI Payout Account Linked',
      message: 'Your payout destination is saved for driver settlements.',
    });
  };

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(payoutAmount);
    if (!Number.isFinite(amount) || amount < 100) {
      setFeedback({
        type: 'error',
        title: 'Minimum ₹100 Required',
        message: 'Enter a valid payout withdrawal amount of at least ₹100.',
      });
      return;
    }
    if (!driverProfile) {
      setFeedback({
        type: 'error',
        title: 'Backend Configuration Required',
        message: 'Bank & UPI payouts execute exclusively server-side after authentication and verification.',
        missingEnvVars: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
      });
      return;
    }
    if (payoutChannel === 'bank' && !wallet?.bank_account_verified) {
      setFeedback({
        type: 'error',
        title: 'Bank Account Not Linked',
        message: 'Link your Bank Account & IFSC below first, or switch transfer channel to Instant UPI.',
      });
      return;
    }
    if (payoutChannel === 'upi' && !wallet?.upi_id) {
      setFeedback({
        type: 'error',
        title: 'UPI ID Not Linked',
        message: 'Link your verified UPI ID below first, or switch transfer channel to Bank IMPS.',
      });
      return;
    }
    if (wallet && amount > wallet.available_balance_inr) {
      setFeedback({
        type: 'error',
        title: 'Insufficient Available Balance',
        message: `Available wallet balance is ₹${wallet.available_balance_inr.toFixed(2)}.`,
      });
      return;
    }
    setBusy(true);
    const res = await payoutProviderAdapter.initiateBankPayout(
      driverProfile.driver_id,
      amount,
      payoutChannel
    );
    setBusy(false);
    if (!res.ok) {
      setFeedback({
        type: 'error',
        title: 'Payout Unavailable',
        message: res.error?.message || 'Unable to request payout.',
        missingEnvVars: res.error?.missingEnvVars,
      });
      return;
    }
    setPayoutAmount('');
    await refreshDriverWorkspace();
    setFeedback({
      type: 'success',
      title: 'Payout Initiated',
      message: `Reference: ${res.data?.payoutReference}`,
    });
  };

  const handleSettleDues = async () => {
    if (!driverProfile || !wallet) {
      setFeedback({
        type: 'error',
        title: 'Razorpay / Backend Not Configured',
        message: 'Dues settlement requires Razorpay Checkout key and authenticated wallet ledger.',
        missingEnvVars: razorpayAdapter.getStatus().missingEnvVars,
      });
      return;
    }
    if (wallet.cash_commission_due_inr <= 0) {
      setFeedback({
        type: 'info',
        title: 'No Pending Commission Dues',
        message: 'Your cash commission balance is completely settled.',
      });
      return;
    }
    setSettlingDues(true);
    const res = await razorpayAdapter.createDuesSettlementOrder(
      wallet.cash_commission_due_inr,
      driverProfile.driver_id
    );
    setSettlingDues(false);
    if (!res.ok) {
      setFeedback({
        type: 'error',
        title: 'Razorpay Order Failed',
        message: res.error?.message || 'Could not initiate Razorpay checkout.',
        missingEnvVars: res.error?.missingEnvVars,
      });
      return;
    }
    await refreshDriverWorkspace();
    setFeedback({
      type: 'success',
      title: 'Dues Settlement Order Created',
      message: `Order ID: ${res.data?.orderId}`,
    });
  };

  return (
    <div className="space-y-4">
      {/* 1. OBSIDIAN & SHINE YELLOW PARTNER WALLET HERO */}
      <section className="rounded-3xl bg-[#111111] p-4 text-white shadow-sm dark:border dark:border-neutral-800 dark:bg-[#14161A]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wider text-[#FFC928]">
              SHINE CAPTAIN WALLET · INSTANT SETTLEMENTS
            </p>
            <div className="mt-1.5 flex items-baseline gap-2">
              <h1 className="font-mono-num text-3xl font-extrabold tracking-tight text-white">
                {wallet ? `₹${wallet.available_balance_inr.toFixed(2)}` : '₹—'}
              </h1>
              <span className="text-xs font-medium text-neutral-400">Available</span>
            </div>
            <p className="mt-1 text-xs text-neutral-400">
              {hasLinkedDestination
                ? `Linked: ${wallet?.bank_account_masked || wallet?.upi_id}`
                : 'Link your Bank Account or UPI ID below to enable withdrawals'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshDriverWorkspace()}
            disabled={loading}
            aria-label="Refresh wallet balance"
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-neutral-700 bg-[#1B1E24] text-white hover:border-[#FFC928]"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Wallet Metrics Strip */}
        <div className="mt-4 grid grid-cols-3 gap-2.5 border-t border-neutral-800 pt-3.5">
          <div>
            <p className="text-[10px] text-neutral-400">Pending Hold</p>
            <p className="font-mono-num mt-0.5 text-sm font-bold text-white">
              {wallet ? `₹${wallet.pending_settlement_inr.toFixed(0)}` : '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-neutral-400">Cash Dues</p>
            <p
              className={`font-mono-num mt-0.5 text-sm font-bold ${
                wallet && wallet.cash_commission_due_inr > 0 ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {wallet ? `₹${wallet.cash_commission_due_inr.toFixed(0)}` : '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-neutral-400">Net Eligible</p>
            <p className="font-mono-num mt-0.5 text-sm font-bold text-[#FFC928]">
              {netWithdrawableInr !== null ? `₹${netWithdrawableInr.toFixed(0)}` : '—'}
            </p>
          </div>
        </div>

        {/* Wallet Quick Action Strip */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => withdrawInputRef.current?.focus()}
            className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-[#FFC928] px-2.5 text-xs font-extrabold text-[#111111]"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            Withdraw
          </button>
          <button
            type="button"
            onClick={() => bankSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-neutral-700 bg-[#1B1E24] px-2.5 text-xs font-semibold text-white hover:border-[#FFC928]"
          >
            <Landmark className="h-3.5 w-3.5 text-[#FFC928]" />
            Bank / UPI
          </button>
          <button
            type="button"
            onClick={() => navigate('payout_history')}
            className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-neutral-700 bg-[#1B1E24] px-2.5 text-xs font-semibold text-white hover:border-[#FFC928]"
          >
            <Clock className="h-3.5 w-3.5 text-[#FFC928]" />
            Payout Log
          </button>
        </div>
      </section>

      {!backendConfigured && (
        <StateNotice
          variant="unconfigured"
          title="Wallet Ledger & Razorpay Settlement Unconfigured"
          description="Wallet balances and commission dues are read strictly from wallet_accounts via RLS. Payouts never succeed locally without server verification."
          missingEnvVars={['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_RAZORPAY_KEY_ID']}
        />
      )}

      {/* 2. INSTANT BANK / UPI WITHDRAWAL FORM WITH PRESET CHIPS */}
      <form
        onSubmit={handleRequestPayout}
        className="space-y-3.5 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#14161A]"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 pb-3 dark:border-neutral-800">
          <div>
            <h2 className="font-display text-base font-bold">Withdraw Money to Bank / UPI</h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Minimum ₹100 · Instant IMPS / UPI transfer
            </p>
          </div>
          <Wallet className="h-4 w-4 text-[#FFC928]" />
        </div>

        {/* Transfer Channel Selector */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setPayoutChannel('bank')}
            className={`flex min-h-[44px] flex-col items-start justify-center rounded-xl border px-3 py-2 text-left transition-colors ${
              payoutChannel === 'bank'
                ? 'border-[#111111] bg-[#111111] text-white dark:border-[#FFC928] dark:bg-[#FFC928] dark:text-[#111111]'
                : 'border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-[#1A1D23] dark:text-neutral-300'
            }`}
          >
            <span className="text-xs font-bold">Bank IMPS</span>
            <span className="font-mono-num truncate text-[10px] opacity-80">
              {wallet?.bank_account_masked || 'Not linked'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setPayoutChannel('upi')}
            className={`flex min-h-[44px] flex-col items-start justify-center rounded-xl border px-3 py-2 text-left transition-colors ${
              payoutChannel === 'upi'
                ? 'border-[#111111] bg-[#111111] text-white dark:border-[#FFC928] dark:bg-[#FFC928] dark:text-[#111111]'
                : 'border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-[#1A1D23] dark:text-neutral-300'
            }`}
          >
            <span className="text-xs font-bold">Instant UPI</span>
            <span className="font-mono-num truncate text-[10px] opacity-80">
              {wallet?.upi_id || 'Not linked'}
            </span>
          </button>
        </div>

        {/* Amount Input + Quick Chips */}
        <div className="space-y-2.5">
          <div className="flex items-center rounded-xl border border-neutral-300 bg-neutral-50 px-3 dark:border-neutral-700 dark:bg-[#1A1D23]">
            <IndianRupee className="h-4 w-4 text-neutral-500" />
            <input
              ref={withdrawInputRef}
              type="number"
              min="100"
              placeholder="Enter withdrawal amount (min ₹100)"
              value={payoutAmount}
              onChange={(e) => setPayoutAmount(e.target.value)}
              className="font-mono-num min-h-[46px] w-full bg-transparent px-2 text-sm font-bold outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[200, 500, 1000, 2000].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setPayoutAmount(String(preset))}
                className="font-mono-num min-h-[34px] rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-xs font-semibold hover:border-[#FFC928] dark:border-neutral-700 dark:bg-[#1A1D23]"
              >
                +₹{preset}
              </button>
            ))}
            {wallet && wallet.available_balance_inr >= 100 && (
              <button
                type="button"
                onClick={() => setPayoutAmount(String(Math.floor(wallet.available_balance_inr)))}
                className="font-mono-num min-h-[34px] rounded-xl border border-[#FFC928] bg-[#FFC928]/15 px-3 text-xs font-bold text-[#111111] dark:text-[#FFC928]"
              >
                Max (₹{Math.floor(wallet.available_balance_inr)})
              </button>
            )}
          </div>
        </div>

        <PrimaryButton type="submit" variant="brand" className="w-full" disabled={busy}>
          {busy
            ? 'Submitting Payout…'
            : `Withdraw via ${payoutChannel === 'upi' ? 'Instant UPI' : 'Verified Bank'}`}
        </PrimaryButton>
      </form>

      {/* 3. CASH COMMISSION DUES SETTLEMENT (RAZORPAY) */}
      <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#14161A]">
        <div className="flex items-center justify-between border-b border-neutral-200 pb-3 dark:border-neutral-800">
          <div>
            <h2 className="font-display text-base font-bold">Cash Commission Dues</h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Clear cash-ride platform commission via UPI, NetBanking or Card
            </p>
          </div>
          <CreditCard className="h-4 w-4 text-[#FFC928]" />
        </div>

        <div className="flex items-center justify-between rounded-xl bg-[#F7F8FA] p-3.5 dark:bg-[#1A1D23]">
          <div>
            <p className="text-[11px] text-neutral-500">Outstanding Dues</p>
            <p className="font-mono-num text-xl font-extrabold text-amber-700 dark:text-[#FFC928]">
              {wallet ? `₹${wallet.cash_commission_due_inr.toFixed(2)}` : '₹—'}
            </p>
          </div>
          <span className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-600 dark:bg-[#14161A] dark:text-neutral-300">
            Razorpay Verified
          </span>
        </div>

        <PrimaryButton
          type="button"
          variant="dark"
          className="w-full"
          disabled={settlingDues}
          onClick={() => void handleSettleDues()}
        >
          {settlingDues
            ? 'Opening Razorpay Order…'
            : wallet && wallet.cash_commission_due_inr > 0
              ? `Pay ₹${wallet.cash_commission_due_inr.toFixed(0)} Dues via Razorpay`
              : 'Pay Dues via Razorpay'}
        </PrimaryButton>
      </section>

      {/* 4. BANK ACCOUNT & UPI PAYOUT METHOD LINKING */}
      <form
        ref={bankSectionRef}
        onSubmit={handleSavePayoutAccount}
        className="space-y-3.5 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#14161A]"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 pb-3 dark:border-neutral-800">
          <div>
            <h2 className="font-display text-base font-bold">Link Bank Account &amp; UPI ID</h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {wallet?.bank_account_verified
                ? `Verified: ${wallet.bank_account_masked}${wallet.upi_id ? ` · ${wallet.upi_id}` : ''}`
                : wallet?.upi_id
                ? `Linked UPI: ${wallet.upi_id}`
                : 'Add your Indian Bank Account or UPI handle for settlements'}
            </p>
          </div>
          <Landmark className="h-4 w-4 text-[#FFC928]" />
        </div>

        {(wallet?.bank_account_verified || wallet?.upi_id) && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50/70 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              {wallet.bank_account_masked || ''} {wallet.upi_id ? `· ${wallet.upi_id}` : ''}
            </span>
          </div>
        )}

        <div className="space-y-2.5">
          <input
            type="text"
            placeholder="UPI ID (e.g. drivername@okicici)"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            className="min-h-[44px] w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 text-sm outline-none focus:border-[#FFC928] dark:border-neutral-700 dark:bg-[#1A1D23]"
          />
          <input
            type="text"
            placeholder="Account Holder Name (As on Bank Passbook)"
            value={holderName}
            onChange={(e) => setHolderName(e.target.value)}
            className="min-h-[44px] w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 text-sm outline-none focus:border-[#FFC928] dark:border-neutral-700 dark:bg-[#1A1D23]"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              inputMode="numeric"
              placeholder="Bank Account No."
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
              className="font-mono-num min-h-[44px] w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3 text-sm outline-none focus:border-[#FFC928] dark:border-neutral-700 dark:bg-[#1A1D23]"
            />
            <input
              type="text"
              maxLength={11}
              placeholder="IFSC (SBIN0001234)"
              value={ifscCode}
              onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
              className="font-mono-num min-h-[44px] w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3 text-sm uppercase outline-none focus:border-[#FFC928] dark:border-neutral-700 dark:bg-[#1A1D23]"
            />
          </div>
        </div>

        <PrimaryButton type="submit" variant="dark" className="w-full" disabled={savingAccount}>
          {savingAccount ? 'Saving Payout Method…' : 'Save Bank / UPI Account'}
        </PrimaryButton>
      </form>

      {/* 5. RECENT WALLET TRANSACTIONS & CREDITS LEDGER */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#14161A]">
        <div className="flex items-center justify-between border-b border-neutral-200 pb-3 dark:border-neutral-800">
          <div>
            <h2 className="font-display text-base font-bold">Wallet Passbook &amp; Ledger</h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Recent trip net credits &amp; bank/UPI withdrawals
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('payout_history')}
            className="text-xs font-bold text-[#111111] hover:underline dark:text-[#FFC928]"
          >
            All Payouts →
          </button>
        </div>

        {recentLedgerEntries.length === 0 ? (
          <div className="py-6 text-center">
            <IndianRupee className="mx-auto h-6 w-6 text-neutral-400" />
            <p className="mt-2 text-xs font-semibold">No Wallet Transactions Yet</p>
            <p className="mt-0.5 text-[11px] text-neutral-500">
              Completed ride payouts and bank withdrawals from Supabase appear here automatically.
            </p>
          </div>
        ) : (
          <div className="mt-1 divide-y divide-neutral-200 dark:divide-neutral-800">
            {recentLedgerEntries.map((item) => {
              const isCredit = item.amount >= 0;
              return (
                <div key={`${item.kind}-${item.id}`} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        isCredit
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-[#FFC928]'
                      }`}
                    >
                      {isCredit ? (
                        <ArrowDownLeft className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold">{item.title}</p>
                      <p className="font-mono-num truncate text-[11px] text-neutral-500">
                        {new Date(item.date).toLocaleDateString()} · {item.subtitle}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`font-mono-num shrink-0 text-sm font-extrabold ${
                      isCredit
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-[#111111] dark:text-white'
                    }`}
                  >
                    {isCredit ? '+' : '-'}₹{Math.abs(item.amount).toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 6. SETTLEMENT RULES & PAYOUT SUPPORT */}
      <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#14161A]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#FFC928]" />
            <h2 className="font-display text-sm font-bold">Settlement Rules &amp; Help</h2>
          </div>
          <button
            type="button"
            onClick={() => navigate('earnings')}
            className="text-xs font-semibold text-neutral-600 hover:underline dark:text-neutral-300"
          >
            Earnings Statement →
          </button>
        </div>
        <ul className="space-y-1.5 text-xs text-neutral-600 dark:text-neutral-400">
          <li>• Online / UPI customer payments credit directly to Available Balance after trip completion.</li>
          <li>• Cash ride platform commission adds to Cash Dues — settle anytime via Razorpay.</li>
          <li>• Bank IMPS &amp; UPI withdrawals require minimum ₹100 and KYC + Bank verification.</li>
        </ul>
        <PrimaryButton variant="outline" className="w-full" onClick={() => navigate('support')}>
          <HelpCircle className="h-4 w-4 text-[#FFC928]" />
          Report Payout or Wallet Issue
        </PrimaryButton>
      </section>
    </div>
  );
};

export const PayoutHistoryScreen: React.FC = () => {
  const { backendConfigured, payouts } = useDriverApp();

  return (
    <div className="space-y-4">
      <ScreenHeader
        title="Payout History"
        subtitle="Audit log of bank and UPI withdrawals"
      />

      {!backendConfigured || payouts.length === 0 ? (
        <StateNotice
          variant={backendConfigured ? 'empty' : 'unconfigured'}
          title={backendConfigured ? 'No Payout Transactions Yet' : 'Payout Ledger Unconfigured'}
          description="Verified settlement records from the payouts table appear here after withdrawals are processed by the backend."
          missingEnvVars={backendConfigured ? undefined : ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']}
        />
      ) : (
        <div className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-[#14161A]">
          {payouts.map((p) => {
            const statusClass =
              p.status === 'settled'
                ? 'text-emerald-700 dark:text-emerald-400'
                : p.status === 'failed'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-amber-700 dark:text-[#FFC928]';
            return (
              <div key={p.payout_id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{p.destination_label}</p>
                  <p className="font-mono-num text-xs text-neutral-500">
                    {p.payout_id} · {new Date(p.requested_at).toLocaleDateString()}
                  </p>
                  <p className={`font-mono-num mt-0.5 text-[11px] font-bold uppercase ${statusClass}`}>
                    {p.status}
                    {p.provider_reference ? ` · UTR ${p.provider_reference}` : ''}
                  </p>
                </div>
                <span className="font-mono-num shrink-0 text-base font-bold">
                  ₹{p.amount_inr.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const RideHistoryScreen: React.FC = () => {
  const { backendConfigured, loading, rideHistory, refreshDriverWorkspace, navigate } = useDriverApp();
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'cancelled'>('all');
  const [vehicleFilter, setVehicleFilter] = useState<'all' | 'bike' | 'auto' | 'cab'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRideId, setExpandedRideId] = useState<string | null>(null);

  const summary = useMemo(() => {
    const completed = rideHistory.filter((r) => r.status === 'completed');
    const cancelled = rideHistory.filter((r) => r.status === 'cancelled');
    const totalDistanceKm = completed.reduce((acc, r) => acc + (r.estimated_distance_km || 0), 0);
    const totalNetEarned = completed.reduce(
      (acc, r) => acc + (r.driver_net_inr ?? r.final_fare_inr ?? r.estimated_fare_inr ?? 0),
      0
    );
    return {
      total: rideHistory.length,
      completedCount: completed.length,
      cancelledCount: cancelled.length,
      totalDistanceKm,
      totalNetEarned,
    };
  }, [rideHistory]);

  const filteredRides = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rideHistory.filter((ride) => {
      if (statusFilter !== 'all' && ride.status !== statusFilter) return false;
      if (vehicleFilter !== 'all' && ride.vehicle_category !== vehicleFilter) return false;
      if (q) {
        const hay = `${ride.ride_id} ${ride.pickup_address} ${ride.dropoff_address} ${ride.customer?.display_name ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rideHistory, statusFilter, vehicleFilter, searchQuery]);

  const hasActiveFilters = statusFilter !== 'all' || vehicleFilter !== 'all' || searchQuery.trim() !== '';

  return (
    <div className="space-y-4">
      {/* 1. OBSIDIAN TRIP ARCHIVE HERO */}
      <section className="rounded-3xl bg-[#111111] p-4 text-white shadow-sm dark:border dark:border-neutral-800 dark:bg-[#14161A]">
        <div className="flex flex-col gap-3.5">
          <div>
            <p className="text-xs font-semibold tracking-wider text-[#FFC928]">
              SHINE CAPTAIN TRIP ARCHIVE · SHARED LEDGER
            </p>
            <div className="mt-1.5 flex items-baseline gap-2.5">
              <h1 className="font-mono-num text-3xl font-extrabold tracking-tight text-white">
                {backendConfigured ? summary.total : '—'}
              </h1>
              <span className="text-xs font-medium text-neutral-400">Recorded Trips</span>
            </div>
            <p className="mt-1 text-xs text-neutral-400">
              Synchronized across Customer App, Driver App &amp; Super Admin Panel
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl bg-[#1B1E24] p-1">
              {(['all', 'completed', 'cancelled'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStatusFilter(tab)}
                  className={`min-h-[36px] rounded-lg px-3 text-xs font-semibold capitalize transition-colors ${
                    statusFilter === tab
                      ? 'bg-[#FFC928] text-[#111111]'
                      : 'text-neutral-300 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void refreshDriverWorkspace()}
              disabled={loading}
              aria-label="Refresh ride history"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-neutral-700 bg-[#1B1E24] text-white hover:border-neutral-500"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Hero Summary Strip */}
        <div className="mt-4 grid grid-cols-2 gap-3.5 border-t border-neutral-800 pt-3.5">
          <div>
            <p className="text-[11px] text-neutral-400">Completed</p>
            <p className="font-mono-num mt-0.5 text-lg font-bold text-emerald-400">
              {backendConfigured ? summary.completedCount : '—'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-neutral-400">Cancelled</p>
            <p className="font-mono-num mt-0.5 text-lg font-bold text-red-400">
              {backendConfigured ? summary.cancelledCount : '—'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-neutral-400">Distance Covered</p>
            <p className="font-mono-num mt-0.5 text-lg font-bold text-white">
              {backendConfigured && summary.completedCount > 0
                ? `${summary.totalDistanceKm.toFixed(1)} km`
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-neutral-400">Net Trip Earnings</p>
            <p className="font-mono-num mt-0.5 text-lg font-bold text-[#FFC928]">
              {backendConfigured && summary.completedCount > 0
                ? `₹${summary.totalNetEarned.toFixed(2)}`
                : '—'}
            </p>
          </div>
        </div>
      </section>

      {/* 2. SEARCH & VEHICLE CATEGORY TOOLBAR */}
      <section className="flex flex-col gap-2.5 rounded-2xl border border-neutral-200 bg-white p-3.5 dark:border-neutral-800 dark:bg-[#14161A]">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search pickup, dropoff, customer, or ride ID…"
            aria-label="Search ride history"
            className="min-h-[44px] w-full rounded-xl border border-neutral-200 bg-[#F7F8FA] pl-10 pr-3.5 text-sm text-[#111111] outline-none placeholder:text-neutral-400 focus:border-[#FFC928] dark:border-neutral-700 dark:bg-[#1A1D23] dark:text-white"
          />
        </div>

        <div className="flex items-center gap-1 rounded-xl bg-[#F7F8FA] p-1 dark:bg-[#1A1D23]">
          {(['all', 'bike', 'auto', 'cab'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setVehicleFilter(cat)}
              className={`min-h-[36px] rounded-lg px-3 text-xs font-semibold capitalize transition-colors ${
                vehicleFilter === cat
                  ? 'bg-[#111111] text-white dark:bg-[#FFC928] dark:text-[#111111]'
                  : 'text-neutral-600 hover:text-[#111111] dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* 3. HONEST EMPTY / UNCONFIGURED OR TRIP LIST */}
      {!backendConfigured || rideHistory.length === 0 ? (
        <StateNotice
          variant={backendConfigured ? 'empty' : 'unconfigured'}
          title={backendConfigured ? 'No Trips Completed Yet' : 'Ride History Requires Backend'}
          description="Historical rides are queried directly from the shared rides table with your driver_id. Zero placeholder trips are fabricated."
          missingEnvVars={backendConfigured ? undefined : ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']}
          actionLabel="Open Earnings Ledger"
          onAction={() => navigate('earnings')}
        />
      ) : filteredRides.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-[#14161A]">
          <Calendar className="mx-auto h-7 w-7 text-neutral-400" />
          <p className="mt-2.5 text-sm font-bold">No Matching Rides Found</p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Adjust your status, vehicle category, or search filter to view recorded rides.
          </p>
          {hasActiveFilters && (
            <PrimaryButton
              variant="outline"
              className="mt-4"
              onClick={() => {
                setStatusFilter('all');
                setVehicleFilter('all');
                setSearchQuery('');
              }}
            >
              Reset Filters
            </PrimaryButton>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRides.map((ride) => {
            const isExpanded = expandedRideId === ride.ride_id;
            const grossFare = ride.final_fare_inr ?? ride.estimated_fare_inr;
            const netFare = ride.driver_net_inr ?? grossFare;
            const statusColor =
              ride.status === 'completed'
                ? 'text-emerald-700 dark:text-emerald-400'
                : ride.status === 'cancelled'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-amber-700 dark:text-[#FFC928]';

            return (
              <article
                key={ride.ride_id}
                className="overflow-hidden rounded-2xl border border-neutral-200 bg-white transition-colors dark:border-neutral-800 dark:bg-[#14161A]"
              >
                <div className="p-4">
                  {/* Top Metadata Strip */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
                      <span className="font-semibold uppercase text-[#111111] dark:text-white">
                        {ride.vehicle_category}
                      </span>
                      <span>·</span>
                      <span className="font-mono-num">
                        {new Date(ride.completed_at ?? ride.created_at).toLocaleString()}
                      </span>
                      <span>·</span>
                      <span className="font-mono-num">{ride.ride_id}</span>
                    </div>
                    <span className={`font-semibold uppercase tracking-wide ${statusColor}`}>
                      {ride.status.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Route Track + Fare Column */}
                  <div className="mt-3.5 flex flex-col gap-3.5">
                    <div className="min-w-0 flex-1 space-y-2.5">
                      <div className="flex items-start gap-2.5">
                        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-600" />
                        <p className="truncate text-sm font-semibold text-[#111111] dark:text-white">
                          {ride.pickup_address}
                        </p>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-sm bg-[#111111] dark:bg-[#FFC928]" />
                        <p className="truncate text-sm font-medium text-neutral-600 dark:text-neutral-300">
                          {ride.dropoff_address}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 border-t border-neutral-100 pt-3 dark:border-neutral-800">
                      <div>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                          {ride.status === 'cancelled' ? 'Estimated Fare' : 'Driver Net'}
                        </p>
                        <p className="font-mono-num text-xl font-extrabold text-[#111111] dark:text-white">
                          ₹{netFare.toFixed(2)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setExpandedRideId(isExpanded ? null : ride.ride_id)}
                        className="flex min-h-[38px] items-center gap-1 rounded-xl border border-neutral-200 bg-[#F7F8FA] px-3 text-xs font-semibold text-[#111111] hover:border-neutral-400 dark:border-neutral-700 dark:bg-[#1A1D23] dark:text-white"
                      >
                        Receipt
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Trip Specs Footer */}
                  <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                    <span className="font-mono-num">
                      {(ride.estimated_distance_km ?? 0).toFixed(1)} km
                    </span>
                    <span>·</span>
                    <span className="font-mono-num">{ride.estimated_duration_min} min</span>
                    <span>·</span>
                    <span className="uppercase">{ride.payment_mode.replace('_', ' ')}</span>
                    <span>·</span>
                    <span className="capitalize">Payment: {ride.payment_status}</span>
                    {ride.customer?.display_name && (
                      <>
                        <span>·</span>
                        <span>Rider: {ride.customer.display_name}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Expandable Fare Breakdown Drawer */}
                {isExpanded && (
                  <div className="border-t border-neutral-200 bg-[#F7F8FA] p-4 dark:border-neutral-800 dark:bg-[#1A1D23]">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-neutral-500 dark:text-neutral-400">Gross Customer Fare</p>
                        <p className="font-mono-num mt-0.5 text-sm font-bold">
                          ₹{grossFare.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-neutral-500 dark:text-neutral-400">Platform Commission</p>
                        <p className="font-mono-num mt-0.5 text-sm font-bold text-red-600 dark:text-red-400">
                          {ride.commission_inr != null ? `-₹${ride.commission_inr.toFixed(2)}` : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-neutral-500 dark:text-neutral-400">Driver Take-Home</p>
                        <p className="font-mono-num mt-0.5 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                          ₹{netFare.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-neutral-500 dark:text-neutral-400">Pickup OTP Check</p>
                        <p className="mt-0.5 text-sm font-bold">
                          {ride.pickup_otp_verified ? 'Verified' : 'Not Verified'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-700">
                      <p className="font-mono-num text-[11px] text-neutral-500 dark:text-neutral-400">
                        Created: {new Date(ride.created_at).toLocaleString()}
                        {ride.completed_at
                          ? ` · Completed: ${new Date(ride.completed_at).toLocaleString()}`
                          : ''}
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate('support')}
                        className="flex min-h-[36px] items-center gap-1.5 text-xs font-semibold text-[#111111] hover:underline dark:text-[#FFC928]"
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                        Report Trip Issue
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const RatingsScreen: React.FC = () => {
  const {
    backendConfigured,
    loading,
    ratings,
    rideHistory,
    driverProfile,
    refreshDriverWorkspace,
    navigate,
  } = useDriverApp();
  const [starFilter, setStarFilter] = useState<'all' | '5' | '4' | '3' | 'low'>('all');
  const [commentsOnly, setCommentsOnly] = useState(false);

  const stats = useMemo(() => {
    const total = ratings.length;
    const counts: Record<1 | 2 | 3 | 4 | 5, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sum = 0;
    let withComments = 0;

    for (const r of ratings) {
      const clamped = Math.min(5, Math.max(1, Math.round(r.stars))) as 1 | 2 | 3 | 4 | 5;
      counts[clamped] += 1;
      sum += r.stars;
      if (r.comment && r.comment.trim()) withComments += 1;
    }

    const avg =
      driverProfile?.rating_average ?? (total > 0 ? Number((sum / total).toFixed(2)) : null);
    const positivePct =
      total > 0 ? Math.round(((counts[5] + counts[4]) / total) * 100) : null;

    return { total, counts, avg, positivePct, withComments };
  }, [ratings, driverProfile?.rating_average]);

  const rideLookup = useMemo(() => {
    const map = new Map<string, { pickup: string; dropoff: string }>();
    for (const ride of rideHistory) {
      map.set(ride.ride_id, {
        pickup: ride.pickup_address,
        dropoff: ride.dropoff_address,
      });
    }
    return map;
  }, [rideHistory]);

  const filteredRatings = useMemo(() => {
    return ratings.filter((r) => {
      if (starFilter === '5' && r.stars !== 5) return false;
      if (starFilter === '4' && r.stars !== 4) return false;
      if (starFilter === '3' && r.stars !== 3) return false;
      if (starFilter === 'low' && r.stars > 2) return false;
      if (commentsOnly && (!r.comment || !r.comment.trim())) return false;
      return true;
    });
  }, [ratings, starFilter, commentsOnly]);

  const roundedStars = stats.avg ? Math.round(stats.avg) : 0;

  return (
    <div className="space-y-4">
      {/* 1. OBSIDIAN CUSTOMER RATING HERO */}
      <section className="rounded-3xl bg-[#111111] p-4 text-white shadow-sm dark:border dark:border-neutral-800 dark:bg-[#14161A]">
        <div className="flex flex-col gap-3.5">
          <div>
            <p className="text-xs font-semibold tracking-wider text-[#FFC928]">
              CUSTOMER APP RATINGS · LIVE DRIVER REPUTATION
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="font-mono-num text-3xl font-extrabold tracking-tight text-white">
                {stats.avg !== null ? stats.avg.toFixed(2) : '—'}
              </h1>
              <div className="flex items-center gap-1" aria-label="Average star rating">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-5 w-5 ${
                      star <= roundedStars
                        ? 'fill-[#FFC928] text-[#FFC928]'
                        : 'text-neutral-600'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs font-medium text-neutral-400">
                {backendConfigured
                  ? `From ${stats.total} verified Customer App review${stats.total === 1 ? '' : 's'}`
                  : 'Customer feedback sync ready'}
              </span>
            </div>
            <p className="mt-1 text-xs text-neutral-400">
              Submitted directly by passengers in SHINE CAB Customer App after completed rides
            </p>
          </div>

          <button
            type="button"
            onClick={() => void refreshDriverWorkspace()}
            disabled={loading}
            aria-label="Refresh customer ratings"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center self-start rounded-xl border border-neutral-700 bg-[#1B1E24] px-3.5 text-xs font-semibold text-white hover:border-neutral-500"
          >
            <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Hero Summary Strip */}
        <div className="mt-4 grid grid-cols-2 gap-3.5 border-t border-neutral-800 pt-3.5">
          <div>
            <p className="text-[11px] text-neutral-400">5-Star Trips</p>
            <p className="font-mono-num mt-0.5 text-lg font-bold text-[#FFC928]">
              {backendConfigured ? stats.counts[5] : '—'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-neutral-400">Positive (4★–5★)</p>
            <p className="font-mono-num mt-0.5 text-lg font-bold text-emerald-400">
              {stats.positivePct !== null ? `${stats.positivePct}%` : '—'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-neutral-400">Written Reviews</p>
            <p className="font-mono-num mt-0.5 text-lg font-bold text-white">
              {backendConfigured ? stats.withComments : '—'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-neutral-400">Total Rated Rides</p>
            <p className="font-mono-num mt-0.5 text-lg font-bold text-white">
              {backendConfigured ? stats.total : '—'}
            </p>
          </div>
        </div>
      </section>

      {/* 2. STAR DISTRIBUTION & CUSTOMER APP SYNC ARCHITECTURE */}
      <div className="space-y-4">
        <section className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#14161A]">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-3 dark:border-neutral-800">
            <div>
              <h2 className="font-display text-base font-bold">Star Rating Breakdown</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Distribution across all verified customer submissions
              </p>
            </div>
            <Star className="h-4 w-4 text-[#FFC928]" />
          </div>

          <div className="mt-4 space-y-3">
            {([5, 4, 3, 2, 1] as const).map((level) => {
              const count = stats.counts[level];
              const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
              return (
                <div key={level} className="flex items-center gap-3 text-xs">
                  <span className="font-mono-num w-9 shrink-0 font-bold text-[#111111] dark:text-white">
                    {level} ★
                  </span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                    <div
                      style={{ width: `${pct}%` }}
                      className={`h-full transition-all ${
                        level >= 4
                          ? 'bg-[#FFC928]'
                          : level === 3
                            ? 'bg-neutral-500'
                            : 'bg-red-500'
                      }`}
                    />
                  </div>
                  <span className="font-mono-num w-16 shrink-0 text-right text-neutral-500 dark:text-neutral-400">
                    {count} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#14161A]">
          <div>
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3 dark:border-neutral-800">
              <div>
                <h2 className="font-display text-base font-bold">Customer App Rating Sync</h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  How passenger ratings reach your profile
                </p>
              </div>
              <ShieldCheck className="h-4 w-4 text-[#FFC928]" />
            </div>

            <ul className="mt-3.5 space-y-2.5 text-xs text-neutral-600 dark:text-neutral-300">
              <li>
                1. After a ride completes, the Customer App submits stars (1–5), feedback tags, and
                remarks to the shared <span className="font-mono-num font-semibold">ratings</span>{' '}
                table.
              </li>
              <li>
                2. PostgreSQL enforces one verified rating per completed{' '}
                <span className="font-mono-num font-semibold">ride_id</span> and automatically
                updates your overall driver score.
              </li>
              <li>
                3. New customer ratings appear here in real time via Supabase Realtime without
                restarting the app.
              </li>
            </ul>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <PrimaryButton variant="outline" className="flex-1" onClick={() => navigate('ride_history')}>
              View Ride History
            </PrimaryButton>
            <PrimaryButton variant="dark" className="flex-1" onClick={() => navigate('support')}>
              Dispute Review
            </PrimaryButton>
          </div>
        </section>
      </div>

      {/* 3. INTERACTIVE REVIEW FILTERS */}
      <section className="flex flex-col gap-2.5 rounded-2xl border border-neutral-200 bg-white p-3.5 dark:border-neutral-800 dark:bg-[#14161A]">
        <div className="flex flex-wrap items-center gap-1 rounded-xl bg-[#F7F8FA] p-1 dark:bg-[#1A1D23]">
          {(
            [
              { id: 'all', label: 'All Ratings' },
              { id: '5', label: '5 ★' },
              { id: '4', label: '4 ★' },
              { id: '3', label: '3 ★' },
              { id: 'low', label: '1–2 ★' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStarFilter(tab.id)}
              className={`min-h-[36px] rounded-lg px-3 text-xs font-semibold transition-colors ${
                starFilter === tab.id
                  ? 'bg-[#111111] text-white dark:bg-[#FFC928] dark:text-[#111111]'
                  : 'text-neutral-600 hover:text-[#111111] dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setCommentsOnly((v) => !v)}
          className={`flex min-h-[40px] items-center justify-center gap-2 rounded-xl border px-3.5 text-xs font-semibold transition-colors ${
            commentsOnly
              ? 'border-[#111111] bg-[#111111] text-white dark:border-[#FFC928] dark:bg-[#FFC928] dark:text-[#111111]'
              : 'border-neutral-200 bg-[#F7F8FA] text-neutral-700 dark:border-neutral-700 dark:bg-[#1A1D23] dark:text-neutral-200'
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          With Comments Only
        </button>
      </section>

      {/* 4. HONEST EMPTY / UNCONFIGURED OR REVIEW FEED */}
      {!backendConfigured || ratings.length === 0 ? (
        <StateNotice
          variant={backendConfigured ? 'empty' : 'unconfigured'}
          title={backendConfigured ? 'No Customer Reviews Yet' : 'Customer Ratings Sync Requires Backend'}
          description="Ratings appear here strictly after customers submit reviews on completed rides in the SHINE CAB Customer App. Zero fake reviews or scores are fabricated."
          missingEnvVars={backendConfigured ? undefined : ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']}
          actionLabel="Open Ride History"
          onAction={() => navigate('ride_history')}
        />
      ) : filteredRatings.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-[#14161A]">
          <Star className="mx-auto h-7 w-7 text-neutral-400" />
          <p className="mt-2.5 text-sm font-bold">No Reviews Match Selected Filter</p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Clear your star or comment filter to see all customer ratings.
          </p>
          <PrimaryButton
            variant="outline"
            className="mt-4"
            onClick={() => {
              setStarFilter('all');
              setCommentsOnly(false);
            }}
          >
            Reset Filters
          </PrimaryButton>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRatings.map((r) => {
            const matchedRide = rideLookup.get(r.ride_id);
            const pickup = r.pickup_address || matchedRide?.pickup;
            const dropoff = r.dropoff_address || matchedRide?.dropoff;

            return (
              <article
                key={r.rating_id}
                className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#14161A]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-4 w-4 ${
                            star <= r.stars
                              ? 'fill-[#FFC928] text-[#FFC928]'
                              : 'text-neutral-300 dark:text-neutral-700'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="font-mono-num text-sm font-extrabold">
                      {(r.stars ?? 0).toFixed(1)} / 5
                    </span>
                  </div>

                  <span className="font-mono-num text-xs text-neutral-500 dark:text-neutral-400">
                    {new Date(r.created_at).toLocaleString()} · {r.ride_id}
                  </span>
                </div>

                {pickup && dropoff && (
                  <p className="mt-2.5 truncate text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    Trip: {pickup} → {dropoff}
                  </p>
                )}

                {r.feedback_tags && r.feedback_tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {r.feedback_tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-lg border border-neutral-200 bg-[#F7F8FA] px-2.5 py-1 text-[11px] font-semibold text-[#111111] dark:border-neutral-700 dark:bg-[#1A1D23] dark:text-neutral-200"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <p className="mt-3 text-sm text-[#111111] dark:text-neutral-200">
                  {r.comment && r.comment.trim()
                    ? `"${r.comment}"`
                    : 'Customer submitted a star rating without a written remark.'}
                </p>

                <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-2.5 text-xs dark:border-neutral-800">
                  <span className="text-neutral-500 dark:text-neutral-400">
                    Verified Customer App Feedback
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate('support')}
                    className="font-semibold text-[#111111] hover:underline dark:text-[#FFC928]"
                  >
                    Report Issue
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
