import { Test, TestingModule } from '@nestjs/testing';
import { AiChatService } from './ai-chat.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AiSender } from '@prisma/client';

const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn().mockReturnValue({
  generateContent: mockGenerateContent,
});

jest.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => {
      return {
        getGenerativeModel: mockGetGenerativeModel,
      };
    }),
  };
});

describe('AiChatService', () => {
  let service: AiChatService;
  let prisma: PrismaService;

  const mockPrismaService = {
    aiConversation: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    aiMessage: {
      create: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'GEMINI_API_KEY') return 'fake-api-key';
      if (key === 'GEMINI_MODEL') return 'gemini-2.5-flash';
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiChatService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AiChatService>(AiChatService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processUserMessage', () => {
    const userId = 'user-1';
    const conversationId = 'conv-1';
    const content = 'I feel sad';

    it('should process message and return response', async () => {
      mockPrismaService.aiConversation.findUnique.mockResolvedValue({
        id: conversationId,
        userId,
        messages: [],
      });
      mockPrismaService.aiMessage.create
        .mockResolvedValueOnce({ id: 'msg-1', content, sender: AiSender.USER })
        .mockResolvedValueOnce({
          id: 'msg-2',
          content: 'Supportive response',
          sender: AiSender.AI,
        });

      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => 'Conversation Title',
        },
      });

      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () =>
            JSON.stringify({
              emotionalState: 'sad',
              themes: ['sadness'],
              riskLevel: 2,
              recommendedApproach: 'support',
            }),
        },
      });

      // Mock Gemini response generation
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => 'Supportive response',
        },
      });

      const result = await service.processUserMessage(
        userId,
        conversationId,
        content,
      );

      expect(result.userMessage.content).toBe(content);
      expect(result.aiMessage.content).toBe('Supportive response');
      expect(mockPrismaService.aiMessage.create).toHaveBeenCalledTimes(2);
      expect(mockGenerateContent).toHaveBeenCalledTimes(3);
    });

    it('should trigger safety fallback if risk level is high', async () => {
      mockPrismaService.aiConversation.findUnique.mockResolvedValue({
        id: conversationId,
        userId,
        messages: [],
      });
      mockPrismaService.aiMessage.create.mockResolvedValue({
        id: 'msg-id',
        content: '...',
        sender: AiSender.AI,
      });

      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => 'Crisis Title',
        },
      });

      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () =>
            JSON.stringify({
              emotionalState: 'crisis',
              themes: ['harm'],
              riskLevel: 9,
              recommendedApproach: 'alert',
            }),
        },
      });

      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => 'Supportive response',
        },
      });

      await service.processUserMessage(
        userId,
        conversationId,
        'I want to hurt myself',
      );

      expect(mockPrismaService.aiMessage.create).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            content: expect.stringContaining('please consider reaching out'),
          }),
        }),
      );

      expect(mockGenerateContent).toHaveBeenCalledTimes(3);
    });
  });
});
