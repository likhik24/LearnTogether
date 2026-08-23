export type ClassCardData = {
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
    image: 'https://images.unsplash.com/photo-1598880940080-ff9a29891b85?auto=format&fit=crop&w=700&q=85',
    tone: 'peach',
    availability: ['Today', 'Nearby'],
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
    image: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=700&q=85',
    tone: 'sky',
    availability: ['Tomorrow', 'Nearby'],
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
    image: 'https://images.unsplash.com/photo-1602030028438-4cf153cbae9e?auto=format&fit=crop&w=700&q=85',
    tone: 'lilac',
    availability: ['Weekend'],
  },
];

export const categories = [
  { name: 'Art & Craft', query: 'Art', count: 13, icon: '✿', tone: 'peach' },
  { name: 'Music', query: 'Music', count: 10, icon: '♪', tone: 'sky' },
  { name: 'Dance', query: 'Dance', count: 14, icon: '⌁', tone: 'pink' },
  { name: 'STEM / Robotics', query: 'STEM', count: 20, icon: '⚙', tone: 'lilac' },
  { name: 'Stories & Culture', query: 'Stories', count: 10, icon: '▤', tone: 'butter' },
  { name: 'Sports & Fitness', query: 'Sports', count: 16, icon: '↗', tone: 'lime' },
];
