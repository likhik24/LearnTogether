import { createServer } from 'node:http';

const occurrence = {
  start: '2031-05-17T05:00:00.000Z',
  end: '2031-05-17T06:00:00.000Z',
  seatsTotal: 8,
  seatsAvailable: 6,
};

const offering = {
  id: '11111111-1111-4111-8111-111111111111',
  teacherId: '22222222-2222-4222-8222-222222222222',
  slug: 'build-a-car',
  activity: 'Build-a-Car STEM Workshop',
  description: 'Build, test, and take home a working toy car.',
  category: 'STEM',
  ageMin: 4,
  ageMax: 6,
  priceMinor: 49900,
  currency: 'INR',
  imageUrl: '/images/build-a-car-workshop.jpg',
  tone: 'mint',
  rating: 4.9,
  reviewCount: 118,
  venueName: 'Little Makers Studio',
  instructorGender: 'any',
  durationMinutes: 60,
  seats: 8,
  location: { lat: 17.4483, lng: 78.3847 },
  timings: [{ weekday: 6, startMinute: 630 }],
  status: 'active',
  moderationStatus: 'approved',
  moderationReason: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  distanceMeters: 900,
  nextOccurrence: occurrence,
};

const port = Number(process.env.SCHEDULING_STUB_PORT ?? 3904);
createServer((request, response) => {
  response.setHeader('content-type', 'application/json');
  if (request.url?.startsWith('/classes/discover')) {
    response.end(JSON.stringify([offering]));
    return;
  }
  if (request.url?.includes('/availability')) {
    response.end(JSON.stringify([occurrence]));
    return;
  }
  if (request.url?.startsWith('/classes/')) {
    response.end(JSON.stringify(offering));
    return;
  }
  response.statusCode = 404;
  response.end(JSON.stringify({ message: 'Not found' }));
}).listen(port, '127.0.0.1', () => {
  process.stdout.write(`Scheduling stub listening on ${port}\n`);
});
