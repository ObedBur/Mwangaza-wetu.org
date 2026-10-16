import { Test, TestingModule } from '@nestjs/testing';
import { RemboursementsController } from './remboursements.controller';
import { RemboursementsService } from './remboursements.service';

describe('RemboursementsController', () => {
  let controller: RemboursementsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RemboursementsController],
      providers: [{ provide: RemboursementsService, useValue: {} }],
    }).compile();

    controller = module.get<RemboursementsController>(RemboursementsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
