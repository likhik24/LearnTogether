export const CUSTOMER_LOCATION_KEY = 'learn-together-location';
export const CUSTOMER_LOCATION_EVENT = 'learn-together-location-change';
export const CUSTOMER_DISCOVERY_RADIUS_METERS = 25_000;

export interface CustomerLocation {
  label: string;
  lat: number;
  lng: number;
}

export const customerLocations: CustomerLocation[] = [
  { label: 'Hitech City, Hyderabad', lat: 17.4485, lng: 78.3915 },
  { label: 'Financial District, Hyderabad', lat: 17.4153, lng: 78.3405 },
  { label: 'Gachibowli, Hyderabad', lat: 17.4401, lng: 78.3489 },
  { label: 'Kondapur, Hyderabad', lat: 17.4698, lng: 78.3638 },
  { label: 'Visakhapatnam', lat: 17.6868, lng: 83.2185 },
];

export const defaultCustomerLocation = customerLocations[0];

export function readCustomerLocation(): CustomerLocation | null {
  if (typeof window === 'undefined') return null;
  const saved = window.localStorage.getItem(CUSTOMER_LOCATION_KEY);
  return customerLocations.find((item) => item.label === saved) ?? null;
}

export function saveCustomerLocation(location: CustomerLocation): void {
  window.localStorage.setItem(CUSTOMER_LOCATION_KEY, location.label);
  window.dispatchEvent(
    new CustomEvent<CustomerLocation>(CUSTOMER_LOCATION_EVENT, { detail: location }),
  );
}

export function clearCustomerLocation(): void {
  window.localStorage.removeItem(CUSTOMER_LOCATION_KEY);
  window.dispatchEvent(
    new CustomEvent<CustomerLocation | null>(CUSTOMER_LOCATION_EVENT, { detail: null }),
  );
}

export function customerDiscoveryCoordinates(location: CustomerLocation): {
  lat: number;
  lng: number;
  radiusMeters: number;
};
export function customerDiscoveryCoordinates(location: null): Record<string, never>;
export function customerDiscoveryCoordinates(location: CustomerLocation | null): {
  lat?: number;
  lng?: number;
  radiusMeters?: number;
};
export function customerDiscoveryCoordinates(location: CustomerLocation | null) {
  return location
    ? {
        lat: location.lat,
        lng: location.lng,
        radiusMeters: CUSTOMER_DISCOVERY_RADIUS_METERS,
      }
    : {};
}

export function subscribeCustomerLocation(
  listener: (location: CustomerLocation | null) => void,
): () => void {
  const onChange = (event: Event) =>
    listener((event as CustomEvent<CustomerLocation | null>).detail);
  window.addEventListener(CUSTOMER_LOCATION_EVENT, onChange);
  return () => window.removeEventListener(CUSTOMER_LOCATION_EVENT, onChange);
}
