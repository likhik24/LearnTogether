import { Test, type TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController (voice)', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns status ok for the voice service', () => {
    const result = controller.check();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('voice');
    expect(typeof result.timestamp).toBe('string');
    expect(typeof result.uptime).toBe('number');
  });
});
