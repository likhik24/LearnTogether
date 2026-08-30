'use client';

import { useEffect, useRef, useState } from 'react';
import type { ClassCardData } from '../data';

export function RealDiscoveryMap({
  items,
  selectedSlug,
  onSelect,
  recenterKey,
  origin = { lat: 17.4485, lng: 78.3915 },
}: {
  items: ClassCardData[];
  selectedSlug?: string;
  onSelect: (slug: string) => void;
  recenterKey: number;
  origin?: { lat: number; lng: number };
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('maplibre-gl').Map | null>(null);
  const markersRef = useRef<import('maplibre-gl').Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let disposed = false;
    void import('maplibre-gl').then(({ default: maplibregl }) => {
      if (disposed || !container.current || mapRef.current) return;
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      const style = token
        ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12?access_token=${encodeURIComponent(token)}`
        : 'https://tiles.openfreemap.org/styles/liberty';
      const map = new maplibregl.Map({
        container: container.current,
        style,
        center: [origin.lng, origin.lat],
        zoom: 13.5,
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      mapRef.current = map;
      setMapReady(true);
    });
    return () => {
      disposed = true;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    void import('maplibre-gl').then(({ default: maplibregl }) => {
      if (disposed || !mapRef.current) return;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = items.flatMap((item) => {
        if (item.latitude === undefined || item.longitude === undefined) return [];
        const button = document.createElement('button');
        button.type = 'button';
        button.className =
          selectedSlug === item.slug ? 'real-map-price-pin active' : 'real-map-price-pin';
        button.textContent = `₹${item.price}`;
        button.setAttribute('aria-label', `Select ${item.title}, ₹${item.price}`);
        button.addEventListener('click', () => onSelect(item.slug));
        return [
          new maplibregl.Marker({ element: button, anchor: 'bottom' })
            .setLngLat([item.longitude, item.latitude])
            .addTo(mapRef.current!),
        ];
      });
    });
    return () => {
      disposed = true;
    };
  }, [items, mapReady, onSelect, selectedSlug]);

  useEffect(() => {
    const selected = items.find((item) => item.slug === selectedSlug);
    const center: [number, number] =
      selected?.longitude !== undefined && selected.latitude !== undefined
        ? [selected.longitude, selected.latitude]
        : [origin.lng, origin.lat];
    mapRef.current?.flyTo({ center, zoom: selected ? 14.5 : 13.5, essential: true });
  }, [items, mapReady, origin.lat, origin.lng, recenterKey, selectedSlug]);

  return (
    <div
      ref={container}
      className="discovery-map real-map"
      role="application"
      aria-label="Interactive map of nearby classes"
    />
  );
}
