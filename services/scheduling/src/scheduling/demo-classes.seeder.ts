import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InstructorGender } from '@learn-and-build/types';
import { ClassOffering } from './class-offering.entity';
import { ClassModerationStatus, ClassOfferingStatus } from '@learn-and-build/types';

const demoClasses: Array<
  Omit<Partial<ClassOffering>, 'slug' | 'activity'> & { slug: string; activity: string }
> = [
  {
    slug: 'build-a-car',
    activity: 'Build-a-Car STEM Workshop',
    description: 'Build, test, and take home a working toy car while learning simple engineering.',
    category: 'STEM',
    ageMin: 4,
    ageMax: 6,
    priceMinor: 49900,
    imageUrl: '/images/build-a-car-workshop.jpg',
    tone: 'mint',
    rating: 4.9,
    reviewCount: 118,
    seats: 8,
    timings: [{ weekday: 6, startMinute: 10 * 60 + 30 }],
    location: { type: 'Point', coordinates: [78.3847, 17.4483] },
    venueName: 'Little Makers Studio',
  },
  {
    slug: 'messy-art-play',
    activity: 'Messy Art Play',
    description:
      'A joyful sensory art class with paint, texture, and plenty of room to experiment.',
    category: 'Art & Craft',
    ageMin: 3,
    ageMax: 6,
    priceMinor: 39900,
    imageUrl:
      'https://images.unsplash.com/photo-1598880940080-ff9a29891b85?auto=format&fit=crop&w=700&q=85',
    tone: 'peach',
    rating: 4.8,
    reviewCount: 31,
    seats: 6,
    timings: [{ weekday: 6, startMinute: 10 * 60 }],
    location: { type: 'Point', coordinates: [78.3971, 17.4474] },
    venueName: 'Colour Cloud Studio',
  },
  {
    slug: 'rhythm-and-rhyme',
    activity: 'Rhythm & Rhyme',
    description: 'Music, movement, rhythm games, and friendly group singing for young children.',
    category: 'Music',
    ageMin: 3,
    ageMax: 5,
    priceMinor: 39900,
    imageUrl:
      'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=700&q=85',
    tone: 'sky',
    rating: 4.8,
    reviewCount: 27,
    seats: 8,
    timings: [{ weekday: 6, startMinute: 11 * 60 }],
    location: { type: 'Point', coordinates: [78.3916, 17.4419] },
    venueName: 'Little Notes House',
  },
  {
    slug: 'story-time',
    activity: 'Story Time Adventures',
    description: 'Interactive stories, role play, and simple crafts inspired by books and culture.',
    category: 'Stories',
    ageMin: 3,
    ageMax: 6,
    priceMinor: 29900,
    imageUrl:
      'https://images.unsplash.com/photo-1602030028438-4cf153cbae9e?auto=format&fit=crop&w=700&q=85',
    tone: 'lilac',
    rating: 4.8,
    reviewCount: 22,
    seats: 7,
    timings: [{ weekday: 6, startMinute: 16 * 60 }],
    location: { type: 'Point', coordinates: [78.3788, 17.4548] },
    venueName: 'Kondapur Reading Room',
  },
];

@Injectable()
export class DemoClassesSeeder implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(ClassOffering) private readonly classes: Repository<ClassOffering>,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const defaultSeed = this.config.get<string>('NODE_ENV') === 'production' ? 'false' : 'true';
    if (this.config.get<string>('SEED_DEMO_CLASSES', defaultSeed) !== 'true') return;
    for (const input of demoClasses) {
      if (await this.classes.findOne({ where: { slug: input.slug } })) continue;
      await this.classes.save(
        this.classes.create({
          teacherId: 'demo-teacher',
          status: ClassOfferingStatus.ACTIVE,
          moderationStatus: ClassModerationStatus.APPROVED,
          moderationReason: null,
          instructorGender: InstructorGender.ANY,
          durationMinutes: 60,
          currency: 'INR',
          ...input,
        }),
      );
    }
  }
}
