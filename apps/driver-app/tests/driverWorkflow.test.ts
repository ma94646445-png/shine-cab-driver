import assert from 'node:assert/strict';
import test from 'node:test';
import { SCREEN_DIRECTORY, SCREEN_TITLES } from '../components/screenDirectory.ts';
import type { DriverProfile, ScreenId, VehicleRecord } from '../contracts/types.ts';
import {
  canDriverGoOnline,
  canTransitionRideState,
  validateAdultDob,
  validateEmail,
  validateIfscCode,
  validateIndianPhone,
  validateUpiId,
  validateVehicleRegNumber,
  validateVehicleYear,
} from '../contracts/validators.ts';
import { getAllIntegrationStatuses, isSupabaseConfigured } from '../services/config.ts';
import { driverBackendService } from '../services/driverBackendService.ts';

const baseDriver: DriverProfile = {
  driver_id: 'drv_001',
  user_id: 'usr_001',
  full_name: 'Ramesh Kumar',
  phone: '+919876543210',
  city: 'Bengaluru',
  profile_completed: true,
  documents_uploaded: true,
  vehicle_verified: true,
  kyc_status: 'approved',
  admin_approved: true,
  account_status: 'active',
  is_online: false,
  rating_average: null,
  total_rides: 0,
  created_at: '2026-11-20T00:00:00Z',
  updated_at: '2026-11-20T00:00:00Z',
};

const verifiedVehicle: VehicleRecord = {
  vehicle_id: 'veh_001',
  driver_id: 'drv_001',
  category: 'cab',
  make: 'Maruti',
  model: 'Dzire',
  year: 2024,
  color: 'White',
  registration_number: 'KA01AB1234',
  verification_status: 'verified',
  is_active: true,
};

test('allows online duty only when all 5 compliance gates and verified vehicle pass', () => {
  const result = canDriverGoOnline(baseDriver, verifiedVehicle);
  assert.equal(result.allowed, true);
  assert.equal(result.blockers.length, 0);
});

test('blocks online duty if admin approval or vehicle verification is missing', () => {
  const unapproved = canDriverGoOnline({ ...baseDriver, admin_approved: false }, verifiedVehicle);
  assert.equal(unapproved.allowed, false);
  assert.ok(unapproved.blockers.some((b) => b.includes('Super Admin approval')));

  const unverifiedVehicle = canDriverGoOnline(baseDriver, {
    ...verifiedVehicle,
    verification_status: 'pending',
  });
  assert.equal(unverifiedVehicle.allowed, false);
  assert.ok(unverifiedVehicle.blockers.some((b) => b.includes('Vehicle verification')));
});

test('enforces valid ride state machine transitions', () => {
  assert.equal(canTransitionRideState('offered', 'accepted'), true);
  assert.equal(canTransitionRideState('arrived', 'in_progress'), true);
  assert.equal(canTransitionRideState('in_progress', 'completed'), true);
  assert.equal(canTransitionRideState('accepted', 'cancelled'), true);
  assert.equal(canTransitionRideState('in_progress', 'cancelled'), true);
  assert.equal(canTransitionRideState('offered', 'completed'), false);
  assert.equal(canTransitionRideState('completed', 'in_progress'), false);
  assert.equal(canTransitionRideState('completed', 'cancelled'), false);
});

test('validates Indian phone numbers, plates, UPI IDs, IFSC codes, emails, DOBs, and vehicle years', () => {
  assert.equal(validateIndianPhone('9876543210').valid, true);
  assert.equal(validateIndianPhone('9876543210').normalized, '+919876543210');
  assert.equal(validateIndianPhone('12345').valid, false);
  assert.equal(validateVehicleRegNumber('KA01AB1234'), true);
  assert.equal(validateVehicleRegNumber('24BH1234AB'), true);
  assert.equal(validateVehicleRegNumber('INVALID'), false);
  assert.equal(validateUpiId('ramesh.driver@okicici'), true);
  assert.equal(validateUpiId('invalid-upi'), false);
  assert.equal(validateIfscCode('SBIN0001234'), true);
  assert.equal(validateIfscCode('INVALID123'), false);
  assert.equal(validateEmail('captain@shine.in'), true);
  assert.equal(validateEmail('bad-email'), false);
  assert.equal(validateAdultDob('1995-05-15'), true);
  assert.equal(validateAdultDob('2015-05-15'), false);
  assert.equal(validateVehicleYear('2023'), true);
  assert.equal(validateVehicleYear('1980'), false);
});

test('exposes all 28 unique driver screens in directory and title map', () => {
  const expectedScreens: ScreenId[] = [
    'splash',
    'onboarding',
    'login_otp',
    'registration',
    'personal_details',
    'vehicle_selection',
    'vehicle_details',
    'document_upload',
    'kyc_pending',
    'kyc_decision',
    'dashboard',
    'online_mode',
    'incoming_ride',
    'ride_accept_decision',
    'pickup_navigation',
    'customer_details',
    'pickup_otp',
    'active_ride',
    'ride_completion',
    'earnings',
    'wallet',
    'payout_history',
    'ride_history',
    'ratings',
    'notifications',
    'profile',
    'support',
    'emergency_sos',
  ];
  assert.equal(SCREEN_DIRECTORY.length, 28);
  for (const id of expectedScreens) {
    assert.ok(SCREEN_TITLES[id], `Missing title for screen: ${id}`);
  }
});

test('reports unconfigured backend and integrations honestly without fake data', async () => {
  const statuses = getAllIntegrationStatuses();
  assert.equal(statuses.length, 7);

  if (!isSupabaseConfigured()) {
    const profileRes = await driverBackendService.driver.getProfile();
    assert.equal(profileRes.ok, false);
    assert.equal(profileRes.configured, false);
    assert.equal(profileRes.error?.code, 'BACKEND_NOT_CONFIGURED');

    const acceptRes = await driverBackendService.rides.acceptRide('ride_1', 'drv_1');
    assert.equal(acceptRes.ok, false);
    assert.equal(acceptRes.configured, false);

    const sosRes = await driverBackendService.account.triggerSos('drv_1');
    assert.equal(sosRes.ok, false);
    assert.equal(sosRes.configured, false);

    const payoutRes = await driverBackendService.finance.requestPayout('drv_1', 500);
    assert.equal(payoutRes.ok, false);
    assert.equal(payoutRes.configured, false);
  }
});
