export const CUSTOMER_LOCATION_KEY = 'learn-together-location';
export const CUSTOMER_LOCATION_EVENT = 'learn-together-location-change';

export interface CustomerLocation {
  label: string;
  lat: number;
  lng: number;
}

export const customerLocations: CustomerLocation[] = [
  { label: 'Hitech City, Hyderabad', lat: 17.4485, lng: 78.3915 },
  { label: 'Gachibowli, Hyderabad', lat: 17.4401, lng: 78.3489 },
  { label: 'Kondapur, Hyderabad', lat: 17.4698, lng: 78.3638 },
];

export const defaultCustomerLocation = customerLocations[0];

export function readCustomerLocation(): CustomerLocation {
  if (typeof window === 'undefined') return defaultCustomerLocation;
  const saved = window.localStorage.getItem(CUSTOMER_LOCATION_KEY);
  return customerLocations.find((item) => item.label === saved) ?? defaultCustomerLocation;
}

export function saveCustomerLocation(location: CustomerLocation): void {
  window.localStorage.setItem(CUSTOMER_LOCATION_KEY, location.label);
  window.dispatchEvent(
    new CustomEvent<CustomerLocation>(CUSTOMER_LOCATION_EVENT, { detail: location }),
  );
}

export function subscribeCustomerLocation(
  listener: (location: CustomerLocation) => void,
): () => void {
  const onChange = (event: Event) => listener((event as CustomEvent<CustomerLocation>).detail);
  window.addEventListener(CUSTOMER_LOCATION_EVENT, onChange);
  return () => window.removeEventListener(CUSTOMER_LOCATION_EVENT, onChange);
}
