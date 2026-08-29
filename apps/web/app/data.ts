export type ClassCardData = {
  backendId?: string;
  slug: string;
  title: string;
  category: string;
  age: string;
  time: string;
  distance: string;
  rating: string;
  reviews: number;
  price: number;
  spots: number;
  image: string;
  tone: string;
  availability: string[];
  occurrenceStart?: string;
  latitude?: number;
  longitude?: number;
  venueName?: string;
  durationMinutes?: number;
  description?: string;
};

export const classes: ClassCardData[] = [
  {
    slug: 'build-a-car',
    title: 'Build-a-Car STEM Workshop',
    category: 'STEM',
    age: '4–6 years',
    time: 'Sat, 10:30 AM',
    distance: '2.3 km',
    rating: '4.9',
    reviews: 118,
    price: 499,
    spots: 6,
    image: '/images/build-a-car-workshop.jpg',
    tone: 'mint',
    availability: ['Weekend'],
    latitude: 17.4483,
    longitude: 78.3847,
  },
  {
    slug: 'messy-art-play',
    title: 'Messy Art Play',
    category: 'Art & Craft',
    age: '3–6 years',
    time: 'Sat, 10:00 AM',
    distance: '1.4 km',
    rating: '4.8',
    reviews: 31,
    price: 399,
    spots: 2,
    image:
      'https://images.unsplash.com/photo-1598880940080-ff9a29891b85?auto=format&fit=crop&w=700&q=85',
    tone: 'peach',
    availability: ['Today', 'Nearby'],
    latitude: 17.4474,
    longitude: 78.3971,
  },
  {
    slug: 'rhythm-and-rhyme',
    title: 'Rhythm & Rhyme',
    category: 'Music',
    age: '3–5 years',
    time: 'Sat, 11:00 AM',
    distance: '1.1 km',
    rating: '4.8',
    reviews: 27,
    price: 399,
    spots: 4,
    image:
      'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=700&q=85',
    tone: 'sky',
    availability: ['Tomorrow', 'Nearby'],
    latitude: 17.4419,
    longitude: 78.3916,
  },
  {
    slug: 'story-time',
    title: 'Story Time Adventures',
    category: 'Stories',
    age: '3–6 years',
    time: 'Sat, 4:00 PM',
    distance: '2.2 km',
    rating: '4.8',
    reviews: 22,
    price: 299,
    spots: 5,
    image:
      'https://images.unsplash.com/photo-1602030028438-4cf153cbae9e?auto=format&fit=crop&w=700&q=85',
    tone: 'lilac',
    availability: ['Weekend'],
    latitude: 17.4548,
    longitude: 78.3788,
  },
];

import { discoverQueryForCategory, ProviderCategory } from '@learn-and-build/api-client';

export type DiscoverCategory = {
  name: string;
  /** Search key used by discover/search (also the provider category mapping). */
  query: string;
  icon: string;
  tone: string;
  /** Provider categories whose declared category maps onto this tile. */
  providerCategories: ProviderCategory[];
};

/**
 * Customer-facing discover categories. `query` is the search key; it lines up
 * with `discoverQueryForCategory()` from the shared taxonomy so a provider's
 * declared category (e.g. Music -> Carnatic music) surfaces under the matching
 * tile. `providerCategories` records that mapping explicitly.
 */
export const categories: DiscoverCategory[] = [
  {
    name: 'Art & Craft',
    query: 'Art',
    icon: '✿',
    tone: 'peach',
    providerCategories: [ProviderCategory.ART_CRAFT],
  },
  {
    name: 'Music',
    query: 'Music',
    icon: '♪',
    tone: 'sky',
    providerCategories: [ProviderCategory.MUSIC],
  },
  {
    name: 'Dance',
    query: 'Dance',
    icon: '⌁',
    tone: 'pink',
    providerCategories: [ProviderCategory.DANCE],
  },
  {
    name: 'STEM / Robotics',
    query: 'STEM',
    icon: '⚙',
    tone: 'lilac',
    providerCategories: [ProviderCategory.STEM],
  },
  {
    name: 'Stories & Culture',
    query: 'Stories',
    icon: '▤',
    tone: 'butter',
    providerCategories: [ProviderCategory.STORIES_CULTURE, ProviderCategory.LIFE_SKILLS],
  },
  {
    name: 'Sports & Fitness',
    query: 'Sports',
    icon: '↗',
    tone: 'lime',
    providerCategories: [ProviderCategory.SPORTS_FITNESS],
  },
];

/**
 * The discover `query` key a provider category should surface under. Single
 * source of truth is the shared taxonomy; this resolves the tile whose search
 * key equals the taxonomy's `discoverQuery`.
 */
export function discoverCategoryForProvider(category: ProviderCategory): DiscoverCategory | null {
  const query = discoverQueryForCategory(category);
  if (!query) return null;
  return categories.find((c) => c.query === query) ?? null;
}
