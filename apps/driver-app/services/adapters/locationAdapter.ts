import type { LiveLocationAdapter } from '../../contracts/integrations';
import type { GeoPoint, ServiceResult } from '../../contracts/types';

export const liveLocationAdapter: LiveLocationAdapter = {
  getStatus() {
    const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator;
    return {
      id: 'live_gps',
      label: 'Device GPS Telemetry',
      configured: supported,
      mode: supported ? 'browser_native' : 'unconfigured',
      missingEnvVars: [],
      notes: supported
        ? 'Reads authentic coordinates via browser Geolocation API.'
        : 'Geolocation API not supported.',
    };
  },

  async getCurrentPosition(highAccuracy = true): Promise<ServiceResult<GeoPoint>> {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      return {
        ok: false,
        configured: false,
        error: {
          code: 'INTEGRATION_NOT_CONFIGURED',
          message: 'Device GPS / Geolocation API is not available in this browser.',
        },
      };
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            ok: true,
            configured: true,
            data: {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              heading: pos.coords.heading,
              speed_kmh: pos.coords.speed !== null ? Math.round(pos.coords.speed * 3.6) : null,
              accuracy_m: Math.round(pos.coords.accuracy),
              recorded_at: new Date(pos.timestamp).toISOString(),
            },
          });
        },
        (err) => {
          resolve({
            ok: false,
            configured: true,
            error: {
              code: 'NETWORK_ERROR',
              message:
                err.code === err.PERMISSION_DENIED
                  ? 'Location permission was denied. Enable GPS permission to broadcast driver position.'
                  : err.message || 'Unable to acquire GPS fix.',
            },
          });
        },
        { enableHighAccuracy: highAccuracy, timeout: 10000, maximumAge: 5000 }
      );
    });
  },

  watchPosition(onPoint, onError, highAccuracy = true) {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      onError('Device Geolocation API is unavailable.');
      return () => {};
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        onPoint({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading,
          speed_kmh: pos.coords.speed !== null ? Math.round(pos.coords.speed * 3.6) : null,
          accuracy_m: Math.round(pos.coords.accuracy),
          recorded_at: new Date(pos.timestamp).toISOString(),
        });
      },
      (err) => {
        onError(err.message || 'GPS tracking interrupted.');
      },
      { enableHighAccuracy: highAccuracy, timeout: 15000, maximumAge: 3000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  },
};
