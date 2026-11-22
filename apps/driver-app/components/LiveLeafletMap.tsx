import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Compass, Gauge, LocateFixed, Navigation } from 'lucide-react';
import type { GeoPoint } from '../contracts/types';
import { fetchOsrmDrivingRoute, type OsrmRouteResult } from '../services/osrmRouteService';

export interface LiveLeafletMapProps {
  driverLocation: GeoPoint | null;
  destination?: {
    lat: number;
    lng: number;
    label: string;
    kind: 'pickup' | 'dropoff';
  } | null;
  heightClass?: string;
  showSpeedometer?: boolean;
  onCenterGps?: () => void;
}

function buildDriverIcon(heading?: number | null): L.DivIcon {
  const rot = typeof heading === 'number' && Number.isFinite(heading) ? heading : 0;
  return L.divIcon({
    className: 'shine-driver-marker',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    html: `
      <div style="width:34px;height:34px;border-radius:9999px;background:#1E1E1E;border:3px solid #F5C518;box-shadow:0 4px 12px rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;transform:rotate(${rot}deg);">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#F5C518">
          <path d="M12 2L19 20L12 16L5 20L12 2Z" />
        </svg>
      </div>
    `,
  });
}

function buildTargetIcon(kind: 'pickup' | 'dropoff'): L.DivIcon {
  const color = kind === 'pickup' ? '#16A34A' : '#DC2626';
  const label = kind === 'pickup' ? 'P' : 'D';
  return L.divIcon({
    className: 'shine-target-marker',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    html: `
      <div style="width:30px;height:30px;border-radius:9999px;background:${color};border:3px solid #FFFFFF;color:#FFFFFF;font-weight:800;font-size:12px;box-shadow:0 4px 12px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;">
        ${label}
      </div>
    `,
  });
}

export const LiveLeafletMap: React.FC<LiveLeafletMapProps> = ({
  driverLocation,
  destination = null,
  heightClass = 'h-56',
  showSpeedometer = true,
  onCenterGps,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const [routeMeta, setRouteMeta] = useState<OsrmRouteResult | null>(null);

  const centerLat = driverLocation?.lat ?? destination?.lat ?? null;
  const centerLng = driverLocation?.lng ?? destination?.lng ?? null;

  useEffect(() => {
    if (!containerRef.current || centerLat === null || centerLng === null) return;
    if (mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [centerLat, centerLng],
      zoom: 15,
      zoomControl: false,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      driverMarkerRef.current = null;
      destMarkerRef.current = null;
      routeLineRef.current = null;
    };
  }, [centerLat !== null && centerLng !== null]);

  // Update markers & map framing smoothly when GPS or destination updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (driverLocation) {
      const icon = buildDriverIcon(driverLocation.heading);
      if (!driverMarkerRef.current) {
        driverMarkerRef.current = L.marker([driverLocation.lat, driverLocation.lng], { icon })
          .addTo(map)
          .bindTooltip('You (SHINE CAPTAIN)', { direction: 'top' });
      } else {
        driverMarkerRef.current.setLatLng([driverLocation.lat, driverLocation.lng]);
        driverMarkerRef.current.setIcon(icon);
      }
    } else if (driverMarkerRef.current) {
      driverMarkerRef.current.remove();
      driverMarkerRef.current = null;
    }

    if (destination) {
      const dIcon = buildTargetIcon(destination.kind);
      if (!destMarkerRef.current) {
        destMarkerRef.current = L.marker([destination.lat, destination.lng], { icon: dIcon })
          .addTo(map)
          .bindTooltip(destination.label, { direction: 'top' });
      } else {
        destMarkerRef.current.setLatLng([destination.lat, destination.lng]);
        destMarkerRef.current.setIcon(dIcon);
      }
    } else if (destMarkerRef.current) {
      destMarkerRef.current.remove();
      destMarkerRef.current = null;
    }

    if (driverLocation && destination) {
      const bounds = L.latLngBounds(
        [driverLocation.lat, driverLocation.lng],
        [destination.lat, destination.lng]
      );
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 16 });
    } else if (driverLocation) {
      map.setView([driverLocation.lat, driverLocation.lng], Math.max(map.getZoom(), 15), {
        animate: true,
      });
    } else if (destination) {
      map.setView([destination.lat, destination.lng], 15, { animate: true });
    }
  }, [
    driverLocation?.lat,
    driverLocation?.lng,
    driverLocation?.heading,
    destination?.lat,
    destination?.lng,
    destination?.kind,
    destination?.label,
  ]);

  // Fetch free OSRM route polyline whenever both driver & destination exist
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !driverLocation || !destination) {
      if (routeLineRef.current) {
        routeLineRef.current.remove();
        routeLineRef.current = null;
      }
      setRouteMeta(null);
      return;
    }

    const controller = new AbortController();
    void fetchOsrmDrivingRoute(
      driverLocation.lat,
      driverLocation.lng,
      destination.lat,
      destination.lng,
      controller.signal
    ).then((res) => {
      if (controller.signal.aborted || !mapRef.current) return;
      setRouteMeta(res);
      if (routeLineRef.current) {
        routeLineRef.current.remove();
      }
      routeLineRef.current = L.polyline(res.coordinates, {
        color: '#F5C518',
        weight: 5,
        opacity: 0.92,
        dashArray: res.isFallback ? '8 8' : undefined,
      }).addTo(mapRef.current);
    });

    return () => controller.abort();
  }, [
    driverLocation?.lat,
    driverLocation?.lng,
    destination?.lat,
    destination?.lng,
  ]);

  const speedKmh = Math.max(0, Math.round(driverLocation?.speed_kmh ?? 0));

  if (centerLat === null || centerLng === null) {
    return (
      <div
        className={`flex ${heightClass} flex-col items-center justify-center rounded-2xl border border-neutral-800 bg-[#1E1E1E] p-5 text-center text-white`}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F5C518]/15 text-[#F5C518]">
          <Compass className="h-6 w-6" />
        </div>
        <p className="mt-2.5 text-sm font-bold">OpenStreetMap Live GPS Ready</p>
        <p className="mt-1 max-w-xs text-xs text-neutral-400">
          Tap Sync GPS to acquire your device coordinates and render the live OpenStreetMap + OSRM map.
        </p>
      </div>
    );
  }

  return (
    <div className={`relative w-full overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800 ${heightClass}`}>
      <div ref={containerRef} className="z-0 h-full w-full" />

      {/* Top-Left Live Speedometer HUD Badge */}
      {showSpeedometer && (
        <div className="pointer-events-none absolute top-2.5 left-2.5 z-[400] flex items-center gap-2 rounded-xl border border-[#F5C518]/50 bg-[#1E1E1E]/95 px-2.5 py-1.5 text-white shadow-lg backdrop-blur-xs">
          <Gauge className="h-4 w-4 text-[#F5C518]" />
          <div className="leading-none">
            <span className="font-mono-num text-sm font-extrabold text-[#F5C518]">
              {speedKmh}
            </span>
            <span className="ml-1 text-[10px] font-bold text-neutral-300">km/h</span>
          </div>
          {driverLocation?.accuracy_m != null && (
            <span className="font-mono-num border-l border-neutral-700 pl-2 text-[10px] text-emerald-400">
              ±{driverLocation.accuracy_m}m
            </span>
          )}
        </div>
      )}

      {/* Top-Right Route Distance & ETA Pill (from free OSRM) */}
      {routeMeta && (
        <div className="pointer-events-none absolute top-2.5 right-2.5 z-[400] flex items-center gap-1.5 rounded-xl border border-neutral-700 bg-[#1E1E1E]/95 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-lg">
          <Navigation className="h-3.5 w-3.5 text-[#F5C518]" />
          <span className="font-mono-num">
            {routeMeta.distanceKm} km · {routeMeta.durationMin} min
          </span>
        </div>
      )}

      {/* Bottom-Right Re-Center GPS Button */}
      {onCenterGps && (
        <button
          type="button"
          onClick={onCenterGps}
          aria-label="Center map on GPS location"
          className="absolute right-2.5 bottom-7 z-[400] flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-700 bg-[#1E1E1E]/95 text-[#F5C518] shadow-md active:scale-95"
        >
          <LocateFixed className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
