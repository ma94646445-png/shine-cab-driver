import type { DriverProfile, RideStatus, VehicleRecord } from './types';

export interface OnlineEligibilityResult {
  allowed: boolean;
  blockers: string[];
}

/**
 * Enforces the production SHINE CAB DRIVER approval gate:
 * A driver cannot go online or receive rides until profile, documents,
 * vehicle verification, admin approval, and active account status are all satisfied.
 */
export function canDriverGoOnline(
  driver: DriverProfile | null | undefined,
  vehicle: VehicleRecord | null | undefined
): OnlineEligibilityResult {
  const blockers: string[] = [];

  if (!driver) {
    blockers.push('Driver profile is not authenticated or synced with the backend.');
    return { allowed: false, blockers };
  }

  if (!driver.profile_completed) {
    blockers.push('Personal details must be completed.');
  }
  if (!driver.documents_uploaded) {
    blockers.push('Required KYC documents must be uploaded.');
  }
  if (!vehicle || vehicle.verification_status !== 'verified' || !driver.vehicle_verified) {
    blockers.push('Vehicle verification must be completed.');
  }
  if (driver.kyc_status !== 'approved' || !driver.admin_approved) {
    blockers.push('Super Admin approval is pending or not granted.');
  }
  if (driver.account_status !== 'active') {
    blockers.push(`Driver account status is "${driver.account_status}" (must be "active").`);
  }

  return {
    allowed: blockers.length === 0,
    blockers,
  };
}

const VALID_RIDE_TRANSITIONS: Record<RideStatus, RideStatus[]> = {
  requested: ['offered', 'cancelled'],
  offered: ['accepted', 'cancelled'],
  accepted: ['arriving', 'arrived', 'cancelled'],
  arriving: ['arrived', 'cancelled'],
  arrived: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function canTransitionRideState(current: RideStatus, next: RideStatus): boolean {
  return VALID_RIDE_TRANSITIONS[current].includes(next);
}

export function validateIndianPhone(input: string): { valid: boolean; normalized: string } {
  const digits = input.replace(/\D/g, '');
  const trimmed = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  const valid = /^[6-9]\d{9}$/.test(trimmed);
  return {
    valid,
    normalized: valid ? `+91${trimmed}` : input,
  };
}

export function validateVehicleRegNumber(reg: string): boolean {
  const cleaned = reg.trim().toUpperCase().replace(/\s+/g, '');
  return (
    /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{3,4}$/.test(cleaned) ||
    /^\d{2}BH\d{4}[A-Z]{1,2}$/.test(cleaned)
  );
}

export function validateEmail(email: string): boolean {
  const cleaned = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned);
}

export function validateAdultDob(dob: string, minAge = 18): boolean {
  if (!dob.trim()) return true;
  const parsed = new Date(dob);
  if (Number.isNaN(parsed.getTime())) return false;
  const today = new Date();
  let age = today.getFullYear() - parsed.getFullYear();
  const monthDiff = today.getMonth() - parsed.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < parsed.getDate())) {
    age -= 1;
  }
  return age >= minAge && age <= 100;
}

export function validateVehicleYear(yearStr: string): boolean {
  if (!yearStr.trim()) return true;
  const year = Number(yearStr);
  const maxYear = new Date().getFullYear() + 1;
  return Number.isInteger(year) && year >= 1995 && year <= maxYear;
}

export function validateUpiId(upi: string): boolean {
  const cleaned = upi.trim();
  return /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,64}$/.test(cleaned);
}

export function validateIfscCode(ifsc: string): boolean {
  const cleaned = ifsc.trim().toUpperCase();
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleaned);
}

