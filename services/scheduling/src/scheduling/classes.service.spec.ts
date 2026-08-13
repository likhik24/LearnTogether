import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InstructorGender } from '@learn-and-build/types';
import { ClassesService } from './classes.service';
import { ClassOffering } from './class-offering.entity';
import { CreateClassDto } from './dto/create-class.dto';

function baseDto(overrides: Partial<CreateClassDto> = {}): CreateClassDto {
  return {
    activity: 'Jiu Jitsu',
    description: 'Beginner friendly',
    instructorGender: InstructorGender.ANY,
    durationMinutes: 60,
    seats: 8,
    timings: [{ weekday: 2, startMinute: 18 * 60 }],
    ...overrides,
  };
}

describe('ClassesService', () => {
  let repo: jest.Mocked<
    Pick<Repository<ClassOffering>, 'create' | 'save' | 'findOne'>
  >;
  let service: ClassesService;

  beforeEach(() => {
    repo = { create: jest.fn(), save: jest.fn(), findOne: jest.fn() };
    repo.create.mockImplementation((v) => {
      const c = new ClassOffering();
      Object.assign(c, v);
      return c;
    });
    repo.save.mockImplementation(async (c) => c as ClassOffering);
    service = new ClassesService(repo as unknown as Repository<ClassOffering>);
  });

  it('creates a valid weekday-evening class', async () => {
    const result = await service.create('teacher-1', baseDto());
    expect(result.activity).toBe('Jiu Jitsu');
    expect(result.seats).toBe(8);
    expect(result.teacherId).toBe('teacher-1');
  });

  it('stores location as a GeoJSON point [lng, lat]', async () => {
    const result = await service.create(
      'teacher-1',
      baseDto({ location: { lat: 12.9, lng: 77.6 } }),
    );
    expect(result.location).toEqual({ type: 'Point', coordinates: [77.6, 12.9] });
  });

  it('rejects a class whose timing falls outside the evening window', async () => {
    await expect(
      service.create('teacher-1', baseDto({ timings: [{ weekday: 2, startMinute: 9 * 60 }] })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('computes availability for a stored class', async () => {
    const offering = new ClassOffering();
    Object.assign(offering, {
      id: 'c-1',
      seats: 8,
      durationMinutes: 60,
      timings: [{ weekday: 1, startMinute: 18 * 60 }],
    });
    repo.findOne.mockResolvedValue(offering);
    const occ = await service.availability('c-1', 14);
    expect(occ.length).toBeGreaterThanOrEqual(1);
    expect(occ[0].seatsTotal).toBe(8);
  });
});
