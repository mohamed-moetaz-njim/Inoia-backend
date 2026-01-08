import { Test, TestingModule } from '@nestjs/testing';
import { TherapistVerificationService } from './therapist-verification.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

describe('TherapistVerificationService', () => {
  let service: TherapistVerificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TherapistVerificationService,
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: UsersService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<TherapistVerificationService>(
      TherapistVerificationService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
