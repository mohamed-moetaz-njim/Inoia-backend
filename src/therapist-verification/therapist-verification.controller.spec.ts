import { Test, TestingModule } from '@nestjs/testing';
import { TherapistVerificationController } from './therapist-verification.controller';
import { TherapistVerificationService } from './therapist-verification.service';

describe('TherapistVerificationController', () => {
  let controller: TherapistVerificationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TherapistVerificationController],
      providers: [
        {
          provide: TherapistVerificationService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<TherapistVerificationController>(
      TherapistVerificationController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
