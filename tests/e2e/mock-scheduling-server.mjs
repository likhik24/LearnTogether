import http from 'node:http';

const start = new Date('2031-05-17T05:00:00.000Z');
const item = {
  id: '11111111-1111-4111-8111-111111111111',
  teacherId: '22222222-2222-4222-8222-222222222222',
  slug: 'build-a-car',
  activity: 'Build-a-Car STEM Workshop',
  description: 'Build and test a toy car.',
  category: 'STEM',
  ageMin: 4,
  ageMax: 12,
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
  location: { type: 'Point', coordinates: [78.3847, 17.4483] },
  timings: [{ weekday: 6, startMinute: 630 }],
  status: 'active',
  moderationStatus: 'approved',
  moderationReason: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  distanceMeters: 2300,
  nextOccurrence: {
    start: start.toISOString(),
    end: new Date(start.getTime() + 3_600_000).toISOString(),
    seatsTotal: 8,
    seatsAvailable: 6,
  },
};

http
  .createServer((request, response) => {
    response.setHeader('content-type', 'application/json');
    if (request.url?.startsWith('/classes/discover')) response.end(JSON.stringify([item]));
    else {
      response.statusCode = 404;
      response.end('{}');
    }
  })
  .listen(3004, '127.0.0.1', () => console.log('E2E scheduling fixture listening on 3004'));
