import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ZktecoService } from './zkteco.service';

describe('ZktecoService', () => {
  let service: ZktecoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ZktecoService,
        // Mock ConfigService → toutes les variables absentes = défauts ZKTECO_*
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).compile();

    service = module.get<ZktecoService>(ZktecoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
