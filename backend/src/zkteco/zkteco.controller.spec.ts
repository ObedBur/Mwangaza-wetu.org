import { Test, TestingModule } from '@nestjs/testing';
import { ZktecoController } from './zkteco.controller';
import { ZktecoService } from './zkteco.service';
import { SyncService } from './sync/sync.service';

describe('ZktecoController', () => {
  let controller: ZktecoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ZktecoController],
      providers: [
        { provide: ZktecoService, useValue: {} },
        { provide: SyncService, useValue: {} },
      ],
    }).compile();

    controller = module.get<ZktecoController>(ZktecoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
