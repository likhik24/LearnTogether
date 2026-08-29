import type { DiscoverClassDto } from '@learn-and-build/types';
import type { ClassCardData } from '../app/data';

export function toClassCard(item: DiscoverClassDto): ClassCardData {
  const occurrence = item.nextOccurrence ? new Date(item.nextOccurrence.start) : null;
  const availability: string[] = [];
  if (occurrence) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const occurrenceDay = new Date(
      occurrence.getFullYear(),
      occurrence.getMonth(),
      occurrence.getDate(),
    ).getTime();
    if (occurrenceDay === today) availability.push('Today');
    if (occurrenceDay === today + 86_400_000) availability.push('Tomorrow');
    if (occurrence.getDay() === 0 || occurrence.getDay() === 6) availability.push('Weekend');
  }
  if (item.distanceMeters !== null && item.distanceMeters <= 2_000) availability.push('Nearby');
  return {
    backendId: item.id,
    slug: item.slug ?? item.id,
    title: item.activity,
    category: item.category,
    age: `${item.ageMin}–${item.ageMax} years`,
    time: occurrence
      ? new Intl.DateTimeFormat('en-IN', {
          weekday: 'short',
          hour: 'numeric',
          minute: '2-digit',
        }).format(occurrence)
      : 'Schedule coming soon',
    distance:
      item.distanceMeters === null
        ? 'Location TBA'
        : `${(item.distanceMeters / 1_000).toFixed(1)} km`,
    rating: item.rating.toFixed(1),
    reviews: item.reviewCount,
    price: item.priceMinor / 100,
    spots: item.nextOccurrence?.seatsAvailable ?? 0,
    image: item.imageUrl ?? '/images/build-a-car-workshop.jpg',
    tone: item.tone,
    availability,
    occurrenceStart: item.nextOccurrence?.start,
    latitude: item.location?.lat,
    longitude: item.location?.lng,
    venueName: item.venueName ?? undefined,
    durationMinutes: item.durationMinutes,
    description: item.description ?? undefined,
  };
}
